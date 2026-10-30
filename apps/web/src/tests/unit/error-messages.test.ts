import { describe, expect, it } from 'vitest';
import { errorMessage, type FieldError } from '@/lib/error-messages';

function error(code: FieldError['code'], field: string, meta?: FieldError['meta']): FieldError {
  return { code, field, meta };
}

describe('errorMessage', () => {
  it('says the date range is invalid for INVALID_DATE_RANGE', () => {
    expect(errorMessage(error('INVALID_DATE_RANGE', 'checkOut'))).toMatch(
      /date range is invalid/i,
    );
  });

  it('says the date must be today or later for CHECK_IN_IN_PAST', () => {
    expect(errorMessage(error('CHECK_IN_IN_PAST', 'checkIn'))).toMatch(
      /check-in date must be today or later/i,
    );
  });

  it('shows the allowed range from meta for GUESTS_OUT_OF_RANGE', () => {
    const message = errorMessage(error('GUESTS_OUT_OF_RANGE', 'guests', { min: 1, max: 10 }));
    expect(message).toContain('1');
    expect(message).toContain('10');
    expect(message).toMatch(/guests/i);
  });

  it('uses the limits it is given, not fixed ones', () => {
    const message = errorMessage(error('GUESTS_OUT_OF_RANGE', 'guests', { min: 2, max: 6 }));
    expect(message).toContain('2');
    expect(message).toContain('6');
    expect(message).not.toContain('10');
  });

  it('still reads sensibly when meta has no limits', () => {
    const message = errorMessage(error('GUESTS_OUT_OF_RANGE', 'guests', {}));
    expect(message).toMatch(/guests/i);
    expect(message).not.toMatch(/undefined|NaN/);
  });

  it('asks to check the spelling for CITY_NOT_FOUND', () => {
    const message = errorMessage(error('CITY_NOT_FOUND', 'city'));
    expect(message).toMatch(/no matching city/i);
    expect(message).toMatch(/spelling/i);
  });

  it.each([
    ['city', /city/i],
    ['checkIn', /check-in/i],
    ['checkOut', /check-out/i],
    ['guests', /guests/i],
  ])('names the missing field %s for REQUIRED', (field, pattern) => {
    expect(errorMessage(error('REQUIRED', field))).toMatch(pattern);
  });

  it.each([
    ['checkIn', /check-in/i],
    ['checkOut', /check-out/i],
    ['guests', /guests/i],
  ])('names the field %s that is in the wrong format for INVALID_VALUE', (field, pattern) => {
    const message = errorMessage(error('INVALID_VALUE', field));
    expect(message).toMatch(pattern);
    expect(message).toMatch(/format|invalid/i);
  });

  it('gives different messages for REQUIRED and INVALID_VALUE on the same field', () => {
    expect(errorMessage(error('REQUIRED', 'guests'))).not.toBe(
      errorMessage(error('INVALID_VALUE', 'guests')),
    );
  });

  it('falls back to the raw field name for a field it does not know', () => {
    expect(errorMessage(error('REQUIRED', 'mystery'))).toContain('mystery');
  });
});
