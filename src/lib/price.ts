// price is a numeric column; blank/invalid means "price on request" (null).
export function toPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
