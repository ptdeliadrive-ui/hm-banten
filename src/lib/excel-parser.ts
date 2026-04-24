type ExcelJSImport = typeof import("exceljs");

export interface AnggotaRow {
  namaPT: string;
  bidangUsaha: string;
  wilayah: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  noSPBU?: string;
}

export interface RekenigRow {
  atasNama: string;
  bankCode: string;
  rekening: string;
}

export interface TabungRow {
  memberId?: string;
  namaAgen: string;
  noSPBU?: string;
  bulan: string;
  tahun: number | null;
  totalTabung: number;
}

type RowData = Record<string, string>;

let excelJSImportPromise: Promise<ExcelJSImport> | null = null;

async function getWorkbook() {
  if (!excelJSImportPromise) {
    excelJSImportPromise = import("exceljs");
  }

  const { Workbook } = await excelJSImportPromise;
  return new Workbook();
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getValue(row: RowData, aliases: string[]): string {
  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const hit = Object.keys(row).find((key) => normalizeKey(key) === target);
    if (hit) {
      return String(row[hit] || "").trim();
    }
  }
  return "";
}

function parseMonthYearLabel(value: string): { bulan: string; tahun: number | null } {
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return { bulan: "", tahun: null };
  }

  const month = months.find((m) => cleaned.toLowerCase().includes(m.toLowerCase())) || "";
  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  return { bulan: month, tahun: year };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

async function parseCsvFile(file: File): Promise<RowData[]> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: RowData = {};
    headers.forEach((header, index) => {
      row[header] = String(cells[index] || "").trim();
    });
    return row;
  });
}

async function parseXlsxFile(file: File): Promise<RowData[]> {
  if (file.name.toLowerCase().endsWith(".xls")) {
    throw new Error("Format .xls belum didukung. Silakan simpan ulang file ke .xlsx atau .csv.");
  }

  const workbook = await getWorkbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(new Uint8Array(buffer));

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Sheet pertama tidak ditemukan pada file Excel.");
  }

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values
    .slice(1)
    .map((value) => String(value || "").trim());

  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new Error("Header kolom tidak ditemukan pada baris pertama.");
  }

  const rows: RowData[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row.hasValues) continue;

    const rowData: RowData = {};
    headers.forEach((header, index) => {
      const value = row.getCell(index + 1).text;
      rowData[header] = String(value || "").trim();
    });

    const hasValue = Object.values(rowData).some((value) => value !== "");
    if (hasValue) {
      rows.push(rowData);
    }
  }

  return rows;
}

async function parseSpreadsheet(file: File): Promise<RowData[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    return parseCsvFile(file);
  }
  return parseXlsxFile(file);
}

async function downloadWorkbook(headers: string[], values: string[], fileName: string, sheetName: string) {
  const workbook = await getWorkbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.addRow(headers);
  worksheet.addRow(values);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const parseAnggotaExcel = async (file: File): Promise<AnggotaRow[]> => {
  const rawRows = await parseSpreadsheet(file);

  return rawRows.map((row, idx) => {
    const namaPT = getValue(row, ["Nama PT", "Nama Pt", "nama PT", "nama Pt"]);
    const bidangUsaha = getValue(row, ["Bidang Usaha", "bidang Usaha", "bidang usaha"]);
    const wilayah = getValue(row, ["Wilayah", "wilayah"]);
    const phone = getValue(row, ["Telepon", "telepon", "Phone", "phone"]);
    const email = getValue(row, ["Email", "email"]);
    const statusStr = getValue(row, ["Status", "status"]).toLowerCase() || "active";
    const status = statusStr === "nonaktif" || statusStr === "inactive" ? "inactive" : "active";
    const noSPBU = getValue(row, ["No SPBU", "noSPBU"]);

    if (!namaPT || !bidangUsaha || !wilayah || !phone || !email) {
      throw new Error(`Baris ${idx + 1}: Kolom tidak lengkap. Pastikan ada: Nama PT, Bidang Usaha, Wilayah, Telepon, Email`);
    }

    if (bidangUsaha.trim().toLowerCase() === "spbu" && !noSPBU) {
      throw new Error(`Baris ${idx + 1}: No SPBU wajib diisi untuk anggota dengan bidang usaha SPBU`);
    }

    return { namaPT, bidangUsaha, wilayah, phone, email, status, noSPBU: noSPBU || undefined };
  });
};

export const parseRekeningExcel = async (file: File): Promise<RekenigRow[]> => {
  const rawRows = await parseSpreadsheet(file);

  return rawRows.map((row, idx) => {
    const atasNama = getValue(row, ["Atas Nama", "atas Nama", "atas nama", "AtasNama", "Nama Pemilik", "Nama Pemilik Rekening"]);
    const bankCode = getValue(row, ["Bank Code", "bank Code", "Bank", "bank", "BankCode", "Kode Bank"]);
    const rekening = getValue(row, ["No Rekening", "no Rekening", "Rekening", "rekening", "NoRekening", "Nomor Rekening"]);

    if (!atasNama || !bankCode || !rekening) {
      throw new Error(`Baris ${idx + 1}: Kolom tidak lengkap. Pastikan ada: Atas Nama, Bank Code (atau Bank), No Rekening`);
    }

    return { atasNama, bankCode, rekening };
  });
};

export const parseTabungExcel = async (file: File): Promise<TabungRow[]> => {
  const rawRows = await parseSpreadsheet(file);

  return rawRows.map((row, idx) => {
    const memberId = getValue(row, ["Member ID", "MemberID", "ID Anggota", "Id Anggota", "id"]);
    const namaAgen = getValue(row, ["NAMA AGEN", "Nama Agen", "Nama PT", "Nama Anggota", "Nama"]);
    const bulanRaw = getValue(row, ["BULAN", "Bulan", "Periode", "Month"]);
    const noSPBU = getValue(row, ["No SPBU", "NoSPBU", "SPBU"]);
    const totalTabungRaw = getValue(row, ["JUMLAH TABUNG", "Jumlah Tabung", "Total Tabung", "Total Realisasi", "Realisasi", "Tabung"])
      .replace(/\./g, "")
      .replace(/,/g, "")
      .replace(/[^0-9-]/g, "");
    const period = parseMonthYearLabel(bulanRaw);

    const totalTabung = Number(totalTabungRaw);

    if (!namaAgen) {
      throw new Error(`Baris ${idx + 1}: NAMA AGEN wajib diisi.`);
    }

    if (!period.bulan) {
      throw new Error(`Baris ${idx + 1}: BULAN tidak valid. Gunakan nama bulan Indonesia, contoh: Maret 2026.`);
    }

    if (!Number.isFinite(totalTabung) || totalTabung < 0) {
      throw new Error(`Baris ${idx + 1}: JUMLAH TABUNG harus angka valid >= 0.`);
    }

    return {
      memberId: memberId || undefined,
      namaAgen,
      noSPBU: noSPBU || undefined,
      bulan: period.bulan,
      tahun: period.tahun,
      totalTabung,
    };
  });
};

export const downloadAnggotaTemplate = async () => {
  await downloadWorkbook(
    ["Nama PT", "Bidang Usaha", "Wilayah", "Telepon", "Email", "Status", "No SPBU"],
    ["PT. Contoh Usaha", "SPBU", "Banten", "0812345678", "contact@example.com", "Aktif", "123456"],
    "template_anggota.xlsx",
    "Anggota"
  );
};

export const downloadRekeningTemplate = async () => {
  await downloadWorkbook(
    ["Atas Nama", "Bank Code", "No Rekening"],
    ["PT. Contoh", "BCA", "1234567890"],
    "template_rekening.xlsx",
    "Rekening"
  );
};

export const downloadTabungTemplate = async (memberNames?: string[]) => {
  const workbook = await getWorkbook();
  const worksheet = workbook.addWorksheet("Total Tabung");

  worksheet.addRow(["NAMA AGEN", "BULAN", "JUMLAH TABUNG"]);

  if (memberNames && memberNames.length > 0) {
    memberNames.forEach((name) => {
      worksheet.addRow([name, "", ""]);
    });
  } else {
    worksheet.addRow(["PT. CONTOH AGEN", "Maret 2026", "120000"]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "template_total_tabung.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export interface PemasukanRow {
  namaAgen: string;
  tanggal: string;       // YYYY-MM-DD
  bulan: string;         // e.g. "April"
  tahun: number;         // e.g. 2026
  jumlah: number;
  status: "lunas" | "belum";
  keterangan: string;    // free text, may contain "IURAN HISWANA | IURAN TRANSPORT FEE"
}

export const parsePemasukanExcel = async (file: File): Promise<PemasukanRow[]> => {
  const rawRows = await parseSpreadsheet(file);

  const months = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember",
  ];

  return rawRows.map((row, idx) => {
    const namaAgen = getValue(row, ["NAMA AGEN", "Nama Agen", "Nama PT", "Nama Anggota", "Nama"]);
    if (!namaAgen) throw new Error(`Baris ${idx + 1}: NAMA AGEN wajib diisi.`);

    const tanggalRaw = getValue(row, ["TANGGAL", "Tanggal", "Tanggal Bayar", "Date"]);
    // Accept: YYYY-MM-DD | DD/MM/YYYY | DD-Mon-YY | DD-Mon-YYYY
    const MONTH_ABBR: Record<string, string> = {
      jan:"01", feb:"02", mar:"03", apr:"04", may:"05", mei:"05",
      jun:"06", jul:"07", aug:"08", agu:"08", sep:"09", oct:"10", okt:"10",
      nov:"11", dec:"12", des:"12",
    };
    let tanggal = "";
    if (tanggalRaw) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(tanggalRaw)) {
        tanggal = tanggalRaw;
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(tanggalRaw)) {
        const [d, m, y] = tanggalRaw.split("/");
        tanggal = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      } else if (/^\d{1,2}-[a-zA-Z]{3}-(\d{2}|\d{4})$/.test(tanggalRaw)) {
        const [d, mon, y] = tanggalRaw.split("-");
        const mm = MONTH_ABBR[mon.toLowerCase()] || "01";
        const yyyy = y.length === 2 ? `20${y}` : y;
        tanggal = `${yyyy}-${mm}-${String(d).padStart(2, "0")}`;
      } else {
        tanggal = tanggalRaw;
      }
    }

    const bulanRaw = getValue(row, ["BULAN", "Bulan", "Periode Bulan", "Month"]);
    const bulan = months.find((m) => m.toLowerCase() === bulanRaw.trim().toLowerCase()) || "";
    if (!bulan) throw new Error(`Baris ${idx + 1}: BULAN tidak valid. Gunakan nama bulan Indonesia, contoh: April.`);

    const tahunRaw = getValue(row, ["TAHUN", "Tahun", "Year"]).replace(/[^0-9]/g, "");
    const tahun = Number(tahunRaw);
    if (!tahun) throw new Error(`Baris ${idx + 1}: TAHUN wajib diisi dan harus berupa angka.`);

    const jumlahRaw = getValue(row, ["JUMLAH", "Jumlah", "Nominal", "Amount", "Jumlah (Rp)"])
      .replace(/\./g, "").replace(/,/g, "").replace(/[^0-9-]/g, "");
    const jumlah = Number(jumlahRaw);
    if (!Number.isFinite(jumlah) || jumlah <= 0) throw new Error(`Baris ${idx + 1}: JUMLAH harus angka > 0.`);

    const statusRaw = getValue(row, ["STATUS", "Status"]).toLowerCase();
    const status: "lunas" | "belum" = statusRaw === "belum" ? "belum" : "lunas";

    const keterangan = getValue(row, ["KETERANGAN", "Keterangan", "Notes", "Catatan"]);

    return { namaAgen, tanggal, bulan, tahun, jumlah, status, keterangan };
  });
};

export const downloadPemasukanTemplate = async (memberNames?: string[]) => {
  const workbook = await getWorkbook();
  const worksheet = workbook.addWorksheet("Pemasukan");

  const headers = ["NAMA AGEN", "TANGGAL", "BULAN", "TAHUN", "JUMLAH", "STATUS", "KETERANGAN"];
  worksheet.addRow(headers);

  if (memberNames && memberNames.length > 0) {
    memberNames.forEach((name) => {
      worksheet.addRow([name, "", "", "", "", "lunas", ""]);
    });
  } else {
    worksheet.addRow(["PT. CONTOH AGEN", "2026-04-24", "April", "2026", "200000", "lunas", "IURAN HISWANA"]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "template_pemasukan.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export interface RekapIuranExcelRow {
  no: number;
  namaAgen: string;
  wilayah: string;
  totalTabung: number;
  transportFeeCollected: number;
  hiswanaAmount: number;
  transportFeeReceived: number;
  checked: boolean;
}

export interface RekapIuranExcelTotals {
  totalTabung: number;
  transportFeeCollected: number;
  hiswanaAmount: number;
  transportFeeReceived: number;
}

export interface RekapIuranExcelPayload {
  title: string;
  subtitle: string;
  hiswanaLabel: string;
  tfLabel: string;
  noSpm?: string;
  expenseLines: Array<{ label: string; amount: number }>;
  rows: RekapIuranExcelRow[];
  totals: RekapIuranExcelTotals;
  totalPendapatan: number;
  totalPengeluaran: number;
  saldo: number;
  formattedToday: string;
}

function applyCellBorder(cell: { border: unknown }) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

export const downloadRekapIuranExcel = async (payload: RekapIuranExcelPayload) => {
  const workbook = await getWorkbook();
  const worksheet = workbook.addWorksheet("Rekap Iuran");

  worksheet.columns = [
    { width: 6 },
    { width: 32 },
    { width: 18 },
    { width: 14 },
    { width: 20 },
    { width: 16 },
    { width: 18 },
    { width: 10 },
  ];

  worksheet.mergeCells("A1:H1");
  worksheet.mergeCells("A2:H2");
  worksheet.getCell("A1").value = payload.title;
  worksheet.getCell("A2").value = payload.subtitle;
  worksheet.getCell("A1").font = { bold: true, size: 14 };
  worksheet.getCell("A2").font = { bold: true, size: 11 };
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

  worksheet.mergeCells("A4:A6");
  worksheet.mergeCells("B4:B6");
  worksheet.mergeCells("C4:C6");
  worksheet.mergeCells("D4:D6");
  worksheet.mergeCells("E4:E6");
  worksheet.mergeCells("F4:G4");
  worksheet.mergeCells("H4:H6");

  worksheet.getCell("A4").value = "No";
  worksheet.getCell("B4").value = "Nama Agen";
  worksheet.getCell("C4").value = "Wilayah";
  worksheet.getCell("D4").value = "Total Tabung";
  worksheet.getCell("E4").value = "Jumlah Pemungutan Transport Fee";
  worksheet.getCell("F4").value = "Total Iuran";
  worksheet.getCell("H4").value = "Catatan";
  worksheet.getCell("F5").value = "Iuran Hiswana";
  worksheet.getCell("G5").value = "Iuran Transport Fee";
  worksheet.getCell("F6").value = payload.hiswanaLabel;
  worksheet.getCell("G6").value = payload.tfLabel;

  const headerRange = ["A4", "B4", "C4", "D4", "E4", "F4", "G4", "H4", "F5", "G5", "F6", "G6"];
  headerRange.forEach((address) => {
    const cell = worksheet.getCell(address);
    cell.font = { bold: true, color: { argb: "FF000000" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: address === "F6" || address === "G6" ? "FF7030A0" : "FF92D050" },
    };
    if (address === "F6" || address === "G6") {
      cell.font = { ...cell.font, color: { argb: "FFFFFFFF" } };
    }
    applyCellBorder(cell);
  });

  const dataStartRow = 7;
  payload.rows.forEach((row, index) => {
    const rowIndex = dataStartRow + index;
    worksheet.addRow([
      row.no,
      row.namaAgen,
      row.wilayah,
      row.totalTabung,
      row.transportFeeCollected,
      row.hiswanaAmount,
      row.transportFeeReceived,
      row.checked ? "v" : "-",
    ]);

    ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
      const cell = worksheet.getCell(`${col}${rowIndex}`);
      applyCellBorder(cell);
      cell.alignment = {
        vertical: "middle",
        horizontal: ["A", "D", "E", "F", "G", "H"].includes(col) ? "center" : "left",
      };
    });

    ["D", "E", "F", "G"].forEach((col) => {
      worksheet.getCell(`${col}${rowIndex}`).numFmt = "#,##0";
    });
  });

  const totalRow = dataStartRow + payload.rows.length;
  worksheet.mergeCells(`A${totalRow}:C${totalRow}`);
  worksheet.getCell(`A${totalRow}`).value = "JUMLAH";
  worksheet.getCell(`D${totalRow}`).value = payload.totals.totalTabung;
  worksheet.getCell(`E${totalRow}`).value = payload.totals.transportFeeCollected;
  worksheet.getCell(`F${totalRow}`).value = payload.totals.hiswanaAmount;
  worksheet.getCell(`G${totalRow}`).value = payload.totals.transportFeeReceived;
  worksheet.getCell(`H${totalRow}`).value = payload.rows.some((item) => item.checked) ? "v" : "-";

  ["A", "D", "E", "F", "G", "H"].forEach((col) => {
    const cell = worksheet.getCell(`${col}${totalRow}`);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F9E7" } };
    applyCellBorder(cell);
  });
  ["D", "E", "F", "G"].forEach((col) => {
    worksheet.getCell(`${col}${totalRow}`).numFmt = "#,##0";
    worksheet.getCell(`${col}${totalRow}`).alignment = { horizontal: "right", vertical: "middle" };
  });
  worksheet.getCell(`A${totalRow}`).alignment = { horizontal: "right", vertical: "middle" };
  worksheet.getCell(`H${totalRow}`).alignment = { horizontal: "center", vertical: "middle" };

  const noteStartRow = totalRow + 2;
  worksheet.mergeCells(`A${noteStartRow}:H${noteStartRow}`);
  worksheet.getCell(`A${noteStartRow}`).value = "Catatan";
  worksheet.getCell(`A${noteStartRow}`).font = { bold: true };
  worksheet.getCell(`A${noteStartRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
  worksheet.getCell(`A${noteStartRow}`).alignment = { horizontal: "left", vertical: "middle" };

  worksheet.mergeCells(`A${noteStartRow + 1}:H${noteStartRow + 1}`);
  worksheet.getCell(`A${noteStartRow + 1}`).value = payload.noSpm
    ? `Pengeluaran ini dikeluarkan dengan No SPM tertentu (No SPM: ${payload.noSpm})`
    : "Pengeluaran ini dikeluarkan dengan No SPM tertentu";
  worksheet.getCell(`A${noteStartRow + 1}`).alignment = { wrapText: true, vertical: "middle" };

  const detailStartRow = noteStartRow + 3;
  worksheet.mergeCells(`A${detailStartRow}:E${detailStartRow}`);
  worksheet.getCell(`A${detailStartRow}`).value = "Rincian Pengeluaran:";
  worksheet.getCell(`A${detailStartRow}`).font = { bold: true };
  worksheet.getCell(`A${detailStartRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF7F7F7" },
  };
  worksheet.getCell(`A${detailStartRow}`).alignment = { horizontal: "left", vertical: "middle" };

  worksheet.mergeCells(`G${detailStartRow}:H${detailStartRow}`);
  worksheet.getCell(`G${detailStartRow}`).value = "Rekapitulasi";
  worksheet.getCell(`G${detailStartRow}`).font = { bold: true };
  worksheet.getCell(`G${detailStartRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF7F7F7" },
  };
  worksheet.getCell(`G${detailStartRow}`).alignment = { horizontal: "left", vertical: "middle" };

  let expenseRow = detailStartRow + 1;
  payload.expenseLines.forEach((item) => {
    worksheet.mergeCells(`A${expenseRow}:D${expenseRow}`);
    worksheet.getCell(`A${expenseRow}`).value = item.label;
    worksheet.getCell(`A${expenseRow}`).alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getCell(`E${expenseRow}`).value = item.amount;
    worksheet.getCell(`E${expenseRow}`).numFmt = "#,##0";
    worksheet.getCell(`E${expenseRow}`).alignment = { horizontal: "right", vertical: "middle" };

    ["A", "B", "C", "D", "E"].forEach((col) => {
      applyCellBorder(worksheet.getCell(`${col}${expenseRow}`));
    });

    expenseRow += 1;
  });

  worksheet.mergeCells(`A${expenseRow}:D${expenseRow}`);
  worksheet.getCell(`A${expenseRow}`).value = "Total Pengeluaran";
  worksheet.getCell(`A${expenseRow}`).font = { bold: true };
  worksheet.getCell(`E${expenseRow}`).value = payload.totalPengeluaran;
  worksheet.getCell(`E${expenseRow}`).numFmt = "#,##0";
  worksheet.getCell(`E${expenseRow}`).font = { bold: true };
  worksheet.getCell(`E${expenseRow}`).alignment = { horizontal: "right", vertical: "middle" };
  ["A", "B", "C", "D", "E"].forEach((col) => {
    const cell = worksheet.getCell(`${col}${expenseRow}`);
    applyCellBorder(cell);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFF6E8" },
    };
  });

  const recapStartRow = detailStartRow + 1;
  worksheet.getCell(`G${recapStartRow}`).value = "Pendapatan";
  worksheet.getCell(`H${recapStartRow}`).value = payload.totalPendapatan;

  worksheet.getCell(`G${recapStartRow + 1}`).value = "Pengeluaran";
  worksheet.getCell(`H${recapStartRow + 1}`).value = payload.totalPengeluaran;

  worksheet.getCell(`G${recapStartRow + 2}`).value = "Saldo";
  worksheet.getCell(`H${recapStartRow + 2}`).value = payload.saldo;

  [0, 1, 2].forEach((offset) => {
    const labelCell = worksheet.getCell(`G${recapStartRow + offset}`);
    const valueCell = worksheet.getCell(`H${recapStartRow + offset}`);
    labelCell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getCell(`H${recapStartRow + offset}`).numFmt = "#,##0";
    valueCell.alignment = { horizontal: "right", vertical: "middle" };
  });

  worksheet.getCell(`G${recapStartRow + 2}`).font = { bold: true };
  worksheet.getCell(`H${recapStartRow + 2}`).font = { bold: true };

  [detailStartRow, recapStartRow, recapStartRow + 1, recapStartRow + 2].forEach((rowIndex) => {
    ["G", "H"].forEach((col) => {
      const cell = worksheet.getCell(`${col}${rowIndex}`);
      applyCellBorder(cell);
      if (rowIndex === recapStartRow + 2) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEFF6E8" },
        };
      }
    });
  });

  ["A", "B", "C", "D", "E"].forEach((col) => {
    applyCellBorder(worksheet.getCell(`${col}${detailStartRow}`));
  });

  const sectionBottomRow = Math.max(expenseRow, recapStartRow + 2);
  const signStartRow = sectionBottomRow + 4;
  worksheet.getCell(`A${signStartRow}`).value = "Mengetahui";
  worksheet.getCell(`F${signStartRow}`).value = `Serang, ${payload.formattedToday}`;
  worksheet.getCell(`F${signStartRow + 1}`).value = "Dilaporkan oleh";
  worksheet.getCell(`A${signStartRow + 5}`).value = "H. Arie Setiawan";
  worksheet.getCell(`A${signStartRow + 6}`).value = "Wakil Bendahara";
  worksheet.getCell(`F${signStartRow + 5}`).value = "Uus";
  worksheet.getCell(`A${signStartRow + 5}`).font = { bold: true, underline: true };
  worksheet.getCell(`F${signStartRow + 5}`).font = { bold: true, underline: true };
  worksheet.getCell(`F${signStartRow}`).alignment = { horizontal: "right" };
  worksheet.getCell(`F${signStartRow + 1}`).alignment = { horizontal: "right" };
  worksheet.getCell(`F${signStartRow + 5}`).alignment = { horizontal: "right" };

  const fileName = `rekap_iuran_tf_hiswana_${payload.tfLabel.toLowerCase().replace(/\s+/g, "_")}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
