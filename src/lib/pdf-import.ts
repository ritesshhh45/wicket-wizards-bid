/**
 * PDF player-list extraction.
 *
 * Reads EVERY page of the PDF, rebuilds text lines from their positions and
 * splits each line into table cells using the horizontal gaps between words.
 * The result is a plain matrix (rows of cells) so it can flow through exactly
 * the same header-detection / column-mapping / preview pipeline used for
 * Excel and CSV imports — no separate, incompatible import path.
 */

export type PdfParseResult = {
  matrix: string[][];
  pages: number;
  lines: number;
};

type Item = { str: string; x: number; y: number; w: number };

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
  return pdfjs;
}

export async function parsePdfToMatrix(file: File): Promise<PdfParseResult> {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const matrix: string[][] = [];
  let lineCount = 0;

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();

    const items: Item[] = [];
    for (const raw of content.items) {
      const it = raw as { str?: string; transform?: number[]; width?: number };
      const text = (it.str ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const tr = it.transform ?? [];
      items.push({
        str: text,
        x: Number(tr[4] ?? 0),
        y: Number(tr[5] ?? 0),
        w: Number(it.width ?? text.length * 4),
      });
    }

    // Group items into visual lines (same baseline within a small tolerance).
    const lines = new Map<number, Item[]>();
    for (const it of items) {
      const key = Math.round(it.y / 4);
      const bucket = lines.get(key);
      if (bucket) bucket.push(it);
      else lines.set(key, [it]);
    }

    const ordered = Array.from(lines.entries())
      .sort((a, b) => b[0] - a[0]) // top of page first
      .map(([, bucket]) => bucket.sort((a, b) => a.x - b.x));

    for (const line of ordered) {
      lineCount++;
      const cells: string[] = [];
      let currentCell = "";
      let prevEnd: number | null = null;

      for (const it of line) {
        const gap = prevEnd === null ? 0 : it.x - prevEnd;
        if (prevEnd !== null && gap > 9) {
          cells.push(currentCell.trim());
          currentCell = it.str;
        } else {
          currentCell = currentCell ? `${currentCell} ${it.str}` : it.str;
        }
        prevEnd = it.x + it.w;
      }
      if (currentCell.trim()) cells.push(currentCell.trim());
      if (cells.length) matrix.push(cells);
    }
  }

  return { matrix: normalizeFlatList(matrix), pages: doc.numPages, lines: lineCount };
}

/**
 * Some PDFs are plain numbered lists rather than real tables, e.g.
 *   "1. Rohit Patil  Batsman  Pune  50"
 * collapses into a single cell. Split those into usable columns so no player
 * row is lost, instead of guessing the wrong fields.
 */
function normalizeFlatList(matrix: string[][]): string[][] {
  const singleColumnShare =
    matrix.length === 0 ? 0 : matrix.filter((r) => r.length === 1).length / matrix.length;
  if (singleColumnShare < 0.7) return matrix;

  return matrix.map((row) => {
    const text = row[0] ?? "";
    const numbered = /^(\d{1,4})[).\s-]+(.*)$/.exec(text);
    if (numbered) return [numbered[1] ?? "", (numbered[2] ?? "").trim()];
    return [text];
  });
}
