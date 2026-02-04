import { z } from "zod";
import { REQUIRED_COLUMNS, NUMERIC_COLUMNS } from "@/lib/constants";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type RowValidation = {
  rowIndex: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  data?: Record<string, unknown>;
};

/**
 * Parse date from various Excel/export formats:
 * - YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
 * - ISO with time (2025-11-25T10:30:00)
 * - DD Mon YYYY (25 Nov 2025)
 * - Excel serial date (number)
 */
function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null;

  const str = String(val).trim();
  if (!str) return null;

  // Excel serial date (days since 1899-12-30)
  const num = Number(str.replace(/,/g, ""));
  if (Number.isFinite(num) && num > 0) {
    const d = new Date((num - 25569) * 86400 * 1000); // 25569 = days from 1899-12-30 to 1970-01-01
    return isNaN(d.getTime()) ? null : d;
  }

  // DD-MM-YYYY or DD/MM/YYYY (JavaScript can misparse these)
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) return d;
  }

  // Try native Date parse (handles ISO, "DD Mon YYYY", "Mon DD YYYY", etc.)
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  return null;
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const str = String(val).trim().replace(/,/g, "");
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

/**
 * Validate a single row of invoice data.
 */
export function validateRow(
  row: Record<string, unknown>,
  rowIndex: number,
  mapping: Record<string, string>
): RowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const data: Record<string, unknown> = {};
  for (const [standard, excelHeader] of Object.entries(mapping)) {
    data[standard] = row[excelHeader] ?? "";
  }

  // Required fields
  for (const col of REQUIRED_COLUMNS) {
    const val = data[col];
    if (val === undefined || val === null || String(val).trim() === "") {
      errors.push(`Missing required field: ${col}`);
    }
  }

  // Date validation for invoice_date
  const dateVal = data.invoice_date;
  if (dateVal !== undefined && dateVal !== null && String(dateVal).trim() !== "") {
    const d = parseDate(dateVal);
    if (!d) {
      errors.push("Invalid invoice_date format");
    }
  }

  // Numeric validation
  for (const col of NUMERIC_COLUMNS) {
    const val = data[col];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      const n = parseNumber(val);
      if (n === null) {
        errors.push(`Invalid number in ${col}`);
      }
    }
  }

  // Total mismatch warning (fare + CGST + SGST vs total_fare)
  const netFare = parseNumber(data.net_fare) ?? 0;
  const cgst = parseNumber(data.CGST) ?? 0;
  const sgst = parseNumber(data.SGST) ?? 0;
  const totalFare = parseNumber(data.total_fare);

  if (totalFare !== null && totalFare !== undefined) {
    const expected = netFare + cgst + sgst;
    const diff = Math.abs(totalFare - expected);
    if (diff > 0.01) {
      warnings.push(`Total mismatch: expected ${expected.toFixed(2)}, got ${totalFare}`);
    }
  }

  return {
    rowIndex,
    valid: errors.length === 0,
    errors,
    warnings,
    data,
  };
}

/**
 * Validate all rows and split into valid/invalid.
 */
export function validateAllRows(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>
): {
  validRows: Record<string, unknown>[];
  invalidRows: RowValidation[];
  validCount: number;
  invalidCount: number;
} {
  const validRows: Record<string, unknown>[] = [];
  const invalidRows: RowValidation[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = validateRow(rows[i], i + 1, mapping); // 1-based row index for user display
    if (result.valid && result.data) {
      validRows.push(result.data);
    } else {
      invalidRows.push(result);
    }
  }

  return {
    validRows,
    invalidRows,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
  };
}

/**
 * Check if all required columns are present in the mapping.
 */
export function validateColumnMapping(mapping: Record<string, string>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const col of REQUIRED_COLUMNS) {
    if (!(col in mapping)) {
      errors.push(`Missing column mapping for: ${col}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
