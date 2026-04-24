import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Anggota from "./Anggota";
import MasterRekening from "./MasterRekening";

const setMembersMock = vi.fn();
const parseAnggotaExcelMock = vi.fn();
const parseRekeningExcelMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const upsertSavedAccountsMock = vi.fn();
const insertSavedAccountsMock = vi.fn();
const selectExistingSavedAccountsMock = vi.fn();
const orderSavedAccountsMock = vi.fn();

vi.mock("@/lib/member-context", () => ({
  useMembers: () => ({
    members: [],
    setMembers: setMembersMock,
  }),
}));

vi.mock("@/lib/excel-parser", () => ({
  parseAnggotaExcel: (...args: unknown[]) => parseAnggotaExcelMock(...args),
  parseRekeningExcel: (...args: unknown[]) => parseRekeningExcelMock(...args),
  downloadAnggotaTemplate: vi.fn(),
  downloadRekeningTemplate: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "saved_accounts") {
        return {
          select: (columns?: string) => {
            if (columns && columns.includes("id") && columns.includes("bank_code") && columns.includes("rekening")) {
              return selectExistingSavedAccountsMock();
            }

            return {
              order: (...args: unknown[]) => orderSavedAccountsMock(...args),
            };
          },
          insert: (...args: unknown[]) => insertSavedAccountsMock(...args),
          upsert: (...args: unknown[]) => upsertSavedAccountsMock(...args),
        };
      }

      return {
        select: () => ({ order: vi.fn(async () => ({ data: [], error: null })) }),
      };
    },
  },
}));

function getFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) {
    throw new Error("File input not found");
  }
  return input as HTMLInputElement;
}

describe("import UI flow", () => {
  beforeEach(() => {
    setMembersMock.mockReset();
    parseAnggotaExcelMock.mockReset();
    parseRekeningExcelMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    selectExistingSavedAccountsMock.mockReset();
    insertSavedAccountsMock.mockReset();
    upsertSavedAccountsMock.mockReset();
    orderSavedAccountsMock.mockReset();

    orderSavedAccountsMock.mockResolvedValue({ data: [], error: null });
    selectExistingSavedAccountsMock.mockResolvedValue({ data: [], error: null });
    insertSavedAccountsMock.mockResolvedValue({ error: null });
    upsertSavedAccountsMock.mockResolvedValue({ error: null });
  });

  it("imports anggota file and updates members", async () => {
    parseAnggotaExcelMock.mockResolvedValue([
      {
        namaPT: "PT Maju",
        bidangUsaha: "SPBU",
        wilayah: "Banten",
        phone: "081234",
        email: "pt@maju.test",
        status: "active",
        noSPBU: "123456",
      },
    ]);

    render(<Anggota />);

    fireEvent.click(screen.getByRole("button", { name: /import excel/i }));

    const file = new File(["csv"], "anggota.csv", { type: "text/csv" });
    fireEvent.change(getFileInput(), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(parseAnggotaExcelMock).toHaveBeenCalledWith(file);
      expect(setMembersMock).toHaveBeenCalledTimes(1);
      expect(toastSuccessMock).toHaveBeenCalledWith("1 anggota berhasil ditambahkan");
    });
  });

  it("shows anggota import error when parser fails", async () => {
    parseAnggotaExcelMock.mockRejectedValue(new Error("format tidak valid"));

    render(<Anggota />);

    fireEvent.click(screen.getByRole("button", { name: /import excel/i }));

    const file = new File(["csv"], "anggota.csv", { type: "text/csv" });
    fireEvent.change(getFileInput(), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Error: format tidak valid");
    });
  });

  it("imports rekening file and upserts to Supabase", async () => {
    parseRekeningExcelMock.mockResolvedValue([
      {
        atasNama: "PT Alpha",
        bankCode: "2",
        rekening: "1234567890",
      },
    ]);

    render(<MasterRekening />);

    fireEvent.click(screen.getByRole("button", { name: /import excel/i }));

    const file = new File(["csv"], "rekening.csv", { type: "text/csv" });
    fireEvent.change(getFileInput(), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(parseRekeningExcelMock).toHaveBeenCalledWith(file);
      expect(insertSavedAccountsMock).toHaveBeenCalledTimes(1);
      expect(toastSuccessMock).toHaveBeenCalledWith("1 rekening berhasil diproses (1 baru, 0 diperbarui)");
    });

    const [payload] = insertSavedAccountsMock.mock.calls[0];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toEqual(
      expect.objectContaining({
        bank_code: "002",
        bank_name: "Bank BCA",
        rekening: "1234567890",
        atas_nama: "PT Alpha",
      })
    );
  });
});
