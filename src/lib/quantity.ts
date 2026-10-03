/**
 * Quantity formatting and parsing helpers for inventory and billing.
 */

/**
 * Formats a quantity value cleanly.
 * PostgreSQL numeric(12,3) returns values like "8.000", "0.000", "12.500".
 * In everyday commerce, whole numbers like pieces, boxes, packets should display as "8",
 * not "8.000" (which confuses shopkeepers into thinking it is 8,000).
 */
export function formatQuantity(qty: number | string | bigint | null | undefined): string {
  if (qty === null || qty === undefined || qty === '') return '0';
  const num = typeof qty === 'number' ? qty : parseFloat(String(qty).replace(/,/g, ''));
  if (isNaN(num)) return '0';

  // Stock quantities must always be whole integers
  return Math.round(num).toString();
}

/**
 * Safely parses user quantity input into a clean whole integer number.
 * Strips out thousands commas (e.g. "8,000" -> 8000, or "8" -> 8)
 * and guards against NaN or negative numbers if required.
 */
export function parseCleanQuantity(val: string | number | null | undefined, allowNegative: boolean = false): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    const rounded = Math.round(val);
    return allowNegative ? rounded : Math.max(0, rounded);
  }

  // Remove commas, whitespace
  const sanitized = val.toString().replace(/,/g, '').trim();
  const parsed = parseFloat(sanitized);
  if (isNaN(parsed)) return 0;

  const rounded = Math.round(parsed);
  return allowNegative ? rounded : Math.max(0, rounded);
}
