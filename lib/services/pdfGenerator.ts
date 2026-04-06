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

function parseOptionalNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(String(val).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function deriveFareBreakdown(row: InvoiceRow): {
  netFare: number;
  cgst: number;
  sgst: number;
  totalFare: number;
} {
  const CGST_RATE = 0.025;
  const SGST_RATE = 0.025;
  const TOTAL_RATE = CGST_RATE + SGST_RATE; // 5%

  const netRaw = parseOptionalNumber(row.net_fare);
  const totalRaw = parseOptionalNumber(row.total_fare);
  const cgstRaw = parseOptionalNumber(row.CGST);
  const sgstRaw = parseOptionalNumber(row.SGST);

  // Prefer explicit net_fare: compute taxes + total automatically.
  if (netRaw !== null) {
    const netFare = netRaw;
    const cgst = round2(netFare * CGST_RATE);
    const sgst = round2(netFare * SGST_RATE);
    const totalFare = round2(netFare + cgst + sgst);
    return { netFare, cgst, sgst, totalFare };
  }

  // If total_fare is provided (but net_fare is not), back-calculate net and taxes.
  if (totalRaw !== null) {
    const totalFare = totalRaw;
    const netFare = round2(totalFare / (1 + TOTAL_RATE));
    const cgst = round2(netFare * CGST_RATE);
    const sgst = round2(netFare * SGST_RATE);
    return { netFare, cgst, sgst, totalFare };
  }

  // Fall back to row-provided components (legacy behavior).
  const netFare = parseOptionalNumber(row.net_fare) ?? 0;
  const cgst = cgstRaw ?? 0;
  const sgst = sgstRaw ?? 0;
  const totalFare = parseOptionalNumber(row.total_fare) ?? round2(netFare + cgst + sgst);
  return { netFare, cgst, sgst, totalFare };
}

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
      const { netFare, cgst, sgst, totalFare } = deriveFareBreakdown(row);

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
        total: formatMoney(totalFare, 2),
        total_payable: formatMoney(Math.round(totalFare), 2),
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
