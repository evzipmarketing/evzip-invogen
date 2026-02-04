/**
 * Sanitize a string for use in filenames.
 * - Remove special characters
 * - Replace spaces with underscores
 * - Truncate to safe length
 */
export function sanitizeFilename(str: string, maxLength = 100): string {
  return str
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, maxLength);
}

/**
 * Generate invoice PDF filename: EVZIP_INV_<invoice_no>_<invoice_date>.pdf
 */
export function getInvoiceFilename(
  invoiceNo: string,
  invoiceDate: string,
  existingNames: Set<string>
): string {
  const base = `EVZIP_INV_${sanitizeFilename(String(invoiceNo))}_${sanitizeFilename(String(invoiceDate))}.pdf`;
  if (!existingNames.has(base)) {
    existingNames.add(base);
    return base;
  }
  let suffix = 1;
  let name = base.replace(/\.pdf$/, `_${suffix}.pdf`);
  while (existingNames.has(name)) {
    suffix++;
    name = base.replace(/\.pdf$/, `_${suffix}.pdf`);
  }
  existingNames.add(name);
  return name;
}
