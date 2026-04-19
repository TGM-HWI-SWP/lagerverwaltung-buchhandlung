export function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format a number as Euro currency.
 * @param value - The numeric value to format.
 * @returns Formatted string like "€ 12.99" or "€ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

/**
 * Format an ISO date string into a localized German date.
 * @param isoString - ISO date/time string (e.g. "2026-04-19T12:34:56+00:00")
 * @returns Formatted date like "19.04.2026 14:34"
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}


