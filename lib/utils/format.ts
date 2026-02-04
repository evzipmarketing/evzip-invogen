function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(String(val).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(n: number, decimals = 2): string {
  return `₹${n.toFixed(decimals)}`;
}

export function formatMoneyNoDecimals(n: number): string {
  return `₹${Math.round(n).toString()}`;
}

export function computePercent(amount: number, base: number): string {
  if (!base || base === 0) return "";
  const pct = (amount / base) * 100;
  // Match the sample look: "2.5%"
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded}%`;
}

/**
 * Parse date from source formats. Source file uses DD-MM-YYYY HH:MM (India/UK).
 * Must parse DD-MM/DD/MM before native Date, which treats "01-11-2025" as MM-DD (Jan 11).
 */
function parseDateForInvoice(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const str = String(val).trim();
  if (!str) return null;

  // Excel serial (number or numeric string like "44927")
  const num = Number(str.replace(/,/g, ""));
  if (Number.isFinite(num) && num > 1000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d;
  }

  // DD-MM-YYYY or DD/MM/YYYY with optional time (01-11-2025 00:07, 01/11/2025 10:30 AM)
  // Source uses this format - first is day, second is month
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) return date;
  }

  // YYYY-MM-DD (ISO)
  const iso = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) return date;
  }

  // Fallback: MM/DD/YYYY HH:MM:SS AM/PM (Excel US format)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatInvoiceDate(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const d = parseDateForInvoice(raw);
  if (!d) return String(raw).trim();

  // Output: 01 Nov 2025 (ignore time)
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${day} ${month} ${year}`.trim();
}

export function pickString(val: unknown, fallback: string): string {
  const s = String(val ?? "").trim();
  return s ? s : fallback;
}

export function pickNumber(val: unknown, fallback = 0): number {
  return toNumber(val) ?? fallback;
}

