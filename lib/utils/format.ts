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

export function formatInvoiceDate(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  // If already contains a month name, keep as-is (matches sample like "31 Nov 2025")
  if (/[A-Za-z]{3,}/.test(s)) return s;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;

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

