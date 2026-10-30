import type { FieldError } from '@/lib/error-messages';
import type { SearchCriteria } from '@/lib/search-params';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isRealDate(text: string): boolean {
  if (!ISO_DATE.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const FIELDS = ['city', 'checkIn', 'checkOut', 'guests'] as const;

// Only time-zone-independent checks. Past dates, the guest range and value formats are left to
// the server, which is the single authority for every rule.
export function validateCriteria(criteria: SearchCriteria): FieldError[] {
  const errors: FieldError[] = FIELDS.filter((field) => criteria[field].trim() === '').map(
    (field) => ({ field, code: 'REQUIRED', meta: {} }),
  );

  const { checkIn, checkOut } = criteria;
  if (isRealDate(checkIn) && isRealDate(checkOut) && checkOut <= checkIn) {
    errors.push({ field: 'checkOut', code: 'INVALID_DATE_RANGE', meta: {} });
  }
  return errors;
}
