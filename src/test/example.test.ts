import { describe, expect, it } from "vitest";
import { isSPMApproved, normalizeSPMStatus } from "@/lib/spm-store";

describe("spm status helpers", () => {
  it("normalizes legacy approved status to ketua approval", () => {
    expect(normalizeSPMStatus("disetujui")).toBe("disetujui_ketua");
  });

  it("marks ketua-approved and paid SPM as approved expenses", () => {
    expect(isSPMApproved("disetujui_ketua")).toBe(true);
    expect(isSPMApproved("dibayar")).toBe(true);
    expect(isSPMApproved("disetujui_bendahara")).toBe(false);
  });
});
