import archiver from "archiver";
import { PassThrough } from "stream";
import type { RowValidation } from "./validation";
import type { PdfResult } from "./pdfGenerator";

/**
 * Create a ZIP archive stream containing PDFs and optionally failed_rows.csv.
 * Returns a Node.js Readable stream.
 */
export function createZipStream(
  pdfs: PdfResult[],
  failedRows: RowValidation[]
): PassThrough {
  const archive = archiver("zip", { zlib: { level: 6 } });
  const passThrough = new PassThrough();
  archive.pipe(passThrough);

  for (const { filename, buffer } of pdfs) {
    archive.append(buffer, { name: filename });
  }

  if (failedRows.length > 0) {
    const csv = buildFailedRowsCsv(failedRows);
    archive.append(csv, { name: "failed_rows.csv" });
  }

  archive.finalize();
  return passThrough;
}

function buildFailedRowsCsv(rows: RowValidation[]): string {
  const headers = ["row_index", "invoice_no", "reason", "errors"];
  const lines = [headers.join(",")];

  for (const row of rows) {
    const invoiceNo = row.data?.invoice_no ?? "";
    const reason = row.errors.join("; ");
    const errors = JSON.stringify(row.errors).replace(/"/g, '""');
    lines.push(
      [row.rowIndex, `"${String(invoiceNo).replace(/"/g, '""')}"`, `"${reason.replace(/"/g, '""')}"`, `"${errors}"`].join(",")
    );
  }

  return lines.join("\n");
}
