/**
 * Expected column names for invoice data (case-insensitive match)
 */
export const STANDARD_COLUMNS = [
  "invoice_no",
  "invoice_date",
  "customer_name",
  "customer_id",
  "pickup_address",
  "drop_address",
  "net_fare",
  "CGST",
  "SGST",
  "total_fare",
] as const;

export type StandardColumn = (typeof STANDARD_COLUMNS)[number];

/**
 * Bulk generator requires the identity fields, and at least one fare input:
 * - `net_fare` OR `total_fare` (GST is auto-derived)
 */
export const BULK_REQUIRED_COLUMNS = [
  "invoice_no",
  "invoice_date",
  "customer_name",
  "customer_id",
] as const;

export type BulkRequiredColumn = (typeof BULK_REQUIRED_COLUMNS)[number];

/**
 * Numeric columns that must be valid numbers
 */
export const NUMERIC_COLUMNS = ["net_fare", "total_fare"] as const;

export const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 25;
export const PREVIEW_ROW_COUNT = 50;
