// Explicit locale + currency so the server and client render identically
// (a mismatch here would trip React hydration).
const priceFormatter = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
  maximumFractionDigits: 0,
});

export function formatPrice(price: number | null | undefined): string | null {
  if (price === null || price === undefined) return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return priceFormatter.format(n);
}
