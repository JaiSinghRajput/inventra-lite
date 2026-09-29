/**
 * Monetary values are stored as integer paise (1 INR = 100 paise).
 */

export function formatINR(paise: number | bigint | null | undefined): string {
  if (paise === null || paise === undefined) return '₹0.00';
  const num = typeof paise === 'bigint' ? Number(paise) : paise;
  const inr = num / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(inr);
}

export function inrToPaise(inr: number | string): number {
  const num = typeof inr === 'string' ? parseFloat(inr) : inr;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function paiseToINR(paise: number | bigint): number {
  const num = typeof paise === 'bigint' ? Number(paise) : paise;
  return num / 100;
}
