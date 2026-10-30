import { describe, expect, it } from 'vitest';
import { validateCriteria } from '@/lib/validate-criteria';

const valid = { city: 'Hanoi', checkIn: '2026-12-01', checkOut: '2026-12-03', guests: '2' };

describe('validateCriteria', () => {
  it('reports nothing for complete criteria', () => {
    expect(validateCriteria(valid)).toEqual([]);
  });

  it.each(['city', 'checkIn', 'checkOut', 'guests'] as const)(
    'reports REQUIRED for an empty %s',
    (field) => {
      const errors = validateCriteria({ ...valid, [field]: '' });
      expect(errors).toContainEqual(expect.objectContaining({ field, code: 'REQUIRED' }));
    },
  );

  it('treats a blank (spaces only) value as empty', () => {
    expect(validateCriteria({ ...valid, city: '   ' })).toContainEqual(
      expect.objectContaining({ field: 'city', code: 'REQUIRED' }),
    );
  });

  it('reports all empty fields together', () => {
    const errors = validateCriteria({ city: '', checkIn: '', checkOut: '', guests: '' });
    expect(errors.map((e) => e.field).sort()).toEqual(['checkIn', 'checkOut', 'city', 'guests']);
    expect(errors.every((e) => e.code === 'REQUIRED')).toBe(true);
  });

  it('reports INVALID_DATE_RANGE on checkOut when check-out equals check-in', () => {
    expect(validateCriteria({ ...valid, checkOut: valid.checkIn })).toEqual([
      expect.objectContaining({ field: 'checkOut', code: 'INVALID_DATE_RANGE' }),
    ]);
  });

  it('reports INVALID_DATE_RANGE when check-out is before check-in', () => {
    expect(validateCriteria({ ...valid, checkOut: '2026-11-30' })).toEqual([
      expect.objectContaining({ field: 'checkOut', code: 'INVALID_DATE_RANGE' }),
    ]);
  });

  it('does not report a date range error while a date is missing', () => {
    expect(validateCriteria({ ...valid, checkOut: '' })).toEqual([
      expect.objectContaining({ field: 'checkOut', code: 'REQUIRED' }),
    ]);
  });

  it('leaves a past check-in to the server', () => {
    expect(validateCriteria({ ...valid, checkIn: '2000-01-01', checkOut: '2000-01-03' })).toEqual(
      [],
    );
  });

  it('leaves the guest range to the server', () => {
    expect(validateCriteria({ ...valid, guests: '0' })).toEqual([]);
    expect(validateCriteria({ ...valid, guests: '11' })).toEqual([]);
  });

  it('leaves a value in the wrong format to the server', () => {
    expect(validateCriteria({ ...valid, checkIn: '2027-13-45' })).toEqual([]);
    expect(validateCriteria({ ...valid, guests: 'abc' })).toEqual([]);
  });
});
