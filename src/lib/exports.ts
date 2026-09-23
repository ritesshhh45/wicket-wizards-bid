import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportSheet(rows: Record<string, unknown>[], filename: string, type: "xlsx" | "csv") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.${type}`, { bookType: type });
}

export function exportPdf(title: string, rows: Record<string, unknown>[], filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  const head = rows.length ? [Object.keys(rows[0]!)] : [];
  const body = rows.map((r) => Object.values(r).map((v) => String(v ?? "")));
  autoTable(doc, { head, body, startY: 22, styles: { fontSize: 8 } });
  doc.save(`${filename}.pdf`);
}

export async function parseSheetFile(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const first = wb.SheetNames[0];
  if (!first) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[first]!);
}

export function downloadTemplate() {
  exportSheet(
    [{ name: "Rohit Patil", role: "Batsman", grade: "A", base_price: 200000, mobile: "9876543210", city: "Pune" }],
    "player-import-template",
    "xlsx",
  );
}
