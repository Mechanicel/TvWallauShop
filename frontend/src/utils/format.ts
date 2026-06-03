/** Shared formatting helpers (used across migrated views). */

const euroFormatter = new Intl.NumberFormat('de-DE', {
   style: 'currency',
   currency: 'EUR',
});

/** Format a numeric amount as a German Euro price, e.g. 12.5 -> "12,50 €". */
export function formatPrice(amount: number): string {
   return euroFormatter.format(Number.isFinite(amount) ? amount : 0);
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
   day: '2-digit',
   month: '2-digit',
   year: 'numeric',
});

/** Format a date/ISO string as dd.mm.yyyy; returns '–' for invalid input. */
export function formatDate(value: string | number | Date | null | undefined): string {
   if (!value) return '–';
   const date = value instanceof Date ? value : new Date(value);
   return Number.isNaN(date.getTime()) ? '–' : dateFormatter.format(date);
}
