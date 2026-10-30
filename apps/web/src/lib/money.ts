export function formatPricePerNight(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

const DOLLARS_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

export function dollarsToCents(text: string): number | null {
  const match = DOLLARS_PATTERN.exec(text.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
