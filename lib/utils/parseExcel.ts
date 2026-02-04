import * as XLSX from "xlsx";
import { REQUIRED_COLUMNS } from "@/lib/constants";

export type SheetInfo = {
  name: string;
  rowCount: number;
};

export type ParsedExcel = {
  sheetNames: string[];
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
};

function normalizeHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Common header aliases seen in source files.
 * Extend this list as new file formats appear.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  invoice_no: ["invoice_no", "invoice", "invoice_number", "inv_no", "invnumber"],
  invoice_date: ["invoice_date", "request_made_at", "date", "inv_date", "invoice_dt"],
  customer_name: ["customer_name", "user_name", "name", "customer"],
  customer_id: ["customer_id", "user_id", "userid", "customerid"],
  pickup_address: ["pickup_address", "pickup", "from", "source", "pickup_location"],
  drop_address: ["drop_address", "drop", "to", "destination", "drop_location"],
  net_fare: ["net_fare", "fare", "subtotal", "sub_total", "base_fare", "amount"],
  CGST: ["cgst", "c_gst", "cgst_amount"],
  SGST: ["sgst", "s_gst", "sgst_amount"],
  total_fare: ["total_fare", "total", "grand_total", "total_amount", "totalamount", "total_payable"],
};

/**
 * Parse an Excel file buffer and return sheet names, headers, and rows.
 * Uses first sheet by default; sheetIndex can be passed to select another.
 */
export function parseExcel(
  buffer: Buffer,
  sheetIndex = 0
): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames;

  if (sheetIndex >= sheetNames.length) {
    throw new Error(`Sheet index ${sheetIndex} out of range. Available: ${sheetNames.join(", ")}`);
  }

  const sheetName = sheetNames[sheetIndex];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  // Convert to JSON with header row as keys
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false, // Format values as strings for consistency
  });

  if (json.length === 0) {
    return {
      sheetNames,
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  const headers = Object.keys(json[0] as Record<string, unknown>);
  const rows = json.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const key of headers) {
      const val = row[key];
      normalized[key] = val === undefined || val === null ? "" : val;
    }
    return normalized;
  });

  return {
    sheetNames,
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Map Excel headers to standard column names (case-insensitive).
 * Returns mapping of standardField -> excelHeader for columns that match.
 */
export function buildColumnMapping(excelHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = excelHeaders.map((h) => normalizeHeader(h));

  for (const standard of REQUIRED_COLUMNS) {
    const candidates = [
      normalizeHeader(standard),
      ...(COLUMN_ALIASES[standard] ?? []).map(normalizeHeader),
    ];

    const idx = normalizedHeaders.findIndex((h) => candidates.includes(h));
    if (idx >= 0) mapping[standard] = excelHeaders[idx];
  }

  return mapping;
}

/**
 * Merge an override mapping (standard -> excelHeader) into a suggested mapping.
 * Invalid override keys are ignored; empty values are ignored.
 */
export function mergeMapping(
  suggested: Record<string, string>,
  override?: Record<string, unknown>
): Record<string, string> {
  const merged: Record<string, string> = { ...suggested };
  if (!override) return merged;

  for (const key of Object.keys(override)) {
    if (!REQUIRED_COLUMNS.includes(key as any)) continue;
    const val = String((override as any)[key] ?? "").trim();
    if (val) merged[key] = val;
  }
  return merged;
}

/**
 * Apply column mapping to convert a row from Excel headers to standard fields.
 */
export function applyColumnMapping(
  row: Record<string, unknown>,
  mapping: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [standardField, excelHeader] of Object.entries(mapping)) {
    result[standardField] = row[excelHeader] ?? "";
  }
  return result;
}
