import puppeteer from "puppeteer";
import { readFileSync } from "fs";
import { join } from "path";
import { renderInvoice } from "@/lib/utils/template";
import { getInvoiceFilename } from "@/lib/utils/filename";
import {
  formatInvoiceDate,
  formatMoney,
  formatMoneyNoDecimals,
  pickNumber,
  pickString,
} from "@/lib/utils/format";

export type InvoiceRow = Record<string, unknown>;

function getLogoDataUri(): string {
  const path = join(process.cwd(), "public", "EVZIP_logo.svg");
  const svg = readFileSync(path, "utf-8");
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

export type PdfResult = {
  filename: string;
  buffer: Buffer;
};

/**
 * Generate PDFs for all valid invoice rows.
 */
export async function generateInvoicePdfs(
  rows: InvoiceRow[],
  onProgress?: (current: number, total: number) => void
): Promise<PdfResult[]> {
  const logoDataUri = getLogoDataUri();
  const usedFilenames = new Set<string>();
  const results: PdfResult[] = [];

  // Some environments (and larger HTML payloads) can hit Puppeteer's default 30s navigation timeout.
  // Our template is static, so we only need DOM readiness (not network idle).
  const NAV_TIMEOUT_MS = 120_000;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const netFare = pickNumber(row.net_fare);
      const cgst = pickNumber(row.CGST);
      const sgst = pickNumber(row.SGST);
      const computedTotal = netFare + cgst + sgst;

      const templateData: Record<string, unknown> = {
        ...row,
        // Optional fields with defaults to match sample layout
        customer_id: pickString((row as any).customer_id, ""),
        place_of_supply: pickString((row as any).place_of_supply, "Telangana"),
        issuer_company: pickString(
          (row as any).issuer_company,
          "EVZIP MOBILITY PRIVATE LIMITED"
        ),
        issuer_address_line1: pickString(
          (row as any).issuer_address_line1,
          "Plot 8/B, Godavari Gardens, Generals Road,"
        ),
        issuer_address_line2: pickString(
          (row as any).issuer_address_line2,
          "Yapral, Secunderabad, Telangana, India-500087"
        ),
        issuer_gstin: pickString((row as any).issuer_gstin, "36AAHCE7709C1ZQ"),
        category_of_services: pickString(
          (row as any).category_of_services,
          "Passenger Transport Services"
        ),
        service_description: pickString(
          (row as any).service_description,
          "Transport Service using electric vehicle"
        ),
        qty: pickString((row as any).qty, "1"),

        // Date formatting like "31 Nov 2025"
        invoice_date_formatted: formatInvoiceDate(row.invoice_date),

        // Amount formatting to match sample
        line_amount_no_decimals: formatMoneyNoDecimals(netFare),
        subtotal: formatMoney(netFare, 2),
        // Display percentages exactly like the reference invoice
        cgst_percent: "2.5%",
        sgst_percent: "2.5%",
        cgst_amount: formatMoney(cgst, 2),
        sgst_amount: formatMoney(sgst, 2),
        total: formatMoney(
          pickNumber(row.total_fare, computedTotal),
          2
        ),
        total_payable: formatMoney(Math.round(pickNumber(row.total_fare, computedTotal)), 2),
      };

      const html = renderInvoice(templateData, logoDataUri);

      await page.setContent(html, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });

      const invoiceNo = String(row.invoice_no ?? "");
      const invoiceDate = String(row.invoice_date ?? "");
      const filename = getInvoiceFilename(invoiceNo, invoiceDate, usedFilenames);

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
      });

      results.push({ filename, buffer: Buffer.from(pdfBuffer) });
      onProgress?.(i + 1, rows.length);
    }
  } finally {
    await browser.close();
  }

  return results;
}
