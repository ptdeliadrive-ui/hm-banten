import { describe, expect, it } from "vitest";
import { Workbook } from "exceljs";
import { parseAnggotaExcel, parseRekeningExcel } from "./excel-parser";

async function createXlsxFile(name: string, headers: string[], rows: string[][]): Promise<File> {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("excel-parser", () => {
  it("parses anggota from CSV", async () => {
    const csv = [
      "Nama PT,Bidang Usaha,Wilayah,Telepon,Email,Status,No SPBU",
      "PT Satu,SPBU,Banten,08123,a@contoh.com,Aktif,123456",
      "PT Dua,Logistik,Jakarta,08234,b@contoh.com,Inactive,",
    ].join("\n");

    const file = new File([csv], "anggota.csv", { type: "text/csv" });
    const rows = await parseAnggotaExcel(file);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      namaPT: "PT Satu",
      bidangUsaha: "SPBU",
      status: "active",
      noSPBU: "123456",
    });
    expect(rows[1]).toMatchObject({
      namaPT: "PT Dua",
      bidangUsaha: "Logistik",
      status: "inactive",
      noSPBU: undefined,
    });
  });

  it("validates no SPBU for anggota SPBU", async () => {
    const csv = [
      "Nama PT,Bidang Usaha,Wilayah,Telepon,Email,Status,No SPBU",
      "PT Satu,SPBU,Banten,08123,a@contoh.com,Aktif,",
    ].join("\n");

    const file = new File([csv], "anggota.csv", { type: "text/csv" });

    await expect(parseAnggotaExcel(file)).rejects.toThrow(
      "No SPBU wajib diisi untuk anggota dengan bidang usaha SPBU"
    );
  });

  it("parses rekening from XLSX", async () => {
    const file = await createXlsxFile(
      "rekening.xlsx",
      ["Atas Nama", "Bank Code", "No Rekening"],
      [["PT Alpha", "BCA", "1234567890"]]
    );

    const rows = await parseRekeningExcel(file);

    expect(rows).toEqual([
      {
        atasNama: "PT Alpha",
        bankCode: "BCA",
        rekening: "1234567890",
      },
    ]);
  });

  it("parses rekening with flexible header variants", async () => {
    const file = await createXlsxFile(
      "rekening-variasi.xlsx",
      ["Atas_Nama", "Kode-Bank", "Nomor Rekening"],
      [["PT Beta", "002", "99887766"]]
    );

    const rows = await parseRekeningExcel(file);

    expect(rows).toEqual([
      {
        atasNama: "PT Beta",
        bankCode: "002",
        rekening: "99887766",
      },
    ]);
  });

  it("rejects legacy XLS files", async () => {
    const fake = new File(["legacy"], "data.xls", {
      type: "application/vnd.ms-excel",
    });

    await expect(parseRekeningExcel(fake)).rejects.toThrow(
      "Format .xls belum didukung"
    );
  });
});
