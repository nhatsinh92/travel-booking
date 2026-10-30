import type { components } from '@/lib/api/generated/schema';

export type FieldError = components['schemas']['FieldError'];

const FIELD_LABELS: Record<string, string> = {
  city: 'city',
  checkIn: 'check-in date',
  checkOut: 'check-out date',
  guests: 'number of guests',
  minPrice: 'minimum price',
  maxPrice: 'maximum price',
  minStars: 'minimum star rating',
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function guestRange(meta: FieldError['meta']): string {
  const { min, max } = meta ?? {};
  if (typeof min === 'number' && typeof max === 'number') {
    return `The number of guests must be between ${min} and ${max}.`;
  }
  return 'The number of guests is outside the allowed range.';
}

export function errorMessage(error: FieldError): string {
  switch (error.code) {
    case 'INVALID_DATE_RANGE':
      return 'The date range is invalid: check-out must be after check-in.';
    case 'CHECK_IN_IN_PAST':
      return 'The check-in date must be today or later.';
    case 'GUESTS_OUT_OF_RANGE':
      return guestRange(error.meta);
    case 'CITY_NOT_FOUND':
      return 'No matching city. Please check the spelling.';
    case 'INVALID_PRICE_RANGE':
      return 'The price range is invalid: the minimum price must not be above the maximum price.';
    case 'REQUIRED':
      return `Please enter the ${fieldLabel(error.field)}.`;
    case 'INVALID_VALUE':
      return `The ${fieldLabel(error.field)} is in the wrong format.`;
    default:
      return 'Something is wrong with your search. Please check it and try again.';
  }
}
