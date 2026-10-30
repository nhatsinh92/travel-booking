import { describe, expect, it } from 'vitest';
import { dollarsToCents, formatPricePerNight } from '@/lib/money';

describe('formatPricePerNight', () => {
  it('shows cents as dollars with two decimals', () => {
    expect(formatPricePerNight(12550, 'USD')).toBe('$125.50');
  });

  it('keeps trailing zeros for whole dollars', () => {
    expect(formatPricePerNight(9000, 'USD')).toBe('$90.00');
  });

  it('shows amounts under one dollar', () => {
    expect(formatPricePerNight(5, 'USD')).toBe('$0.05');
  });

  it('groups thousands', () => {
    expect(formatPricePerNight(123456789, 'USD')).toBe('$1,234,567.89');
  });
});

describe('dollarsToCents', () => {
  it('converts whole dollars', () => {
    expect(dollarsToCents('125')).toBe(12500);
  });

  it('converts one and two decimal places', () => {
    expect(dollarsToCents('125.5')).toBe(12550);
    expect(dollarsToCents('125.50')).toBe(12550);
  });

  it('avoids floating point errors', () => {
    expect(dollarsToCents('19.99')).toBe(1999);
    expect(dollarsToCents('0.07')).toBe(7);
  });

  it('trims surrounding spaces', () => {
    expect(dollarsToCents('  80 ')).toBe(8000);
  });

  it('accepts zero', () => {
    expect(dollarsToCents('0')).toBe(0);
  });

  it.each(['', '   ', 'abc', '12abc', '-5', '1.234', '1e3', '1,000', '.', '1.', '$5'])(
    'returns null for invalid input %j',
    (text) => {
      expect(dollarsToCents(text)).toBeNull();
    },
  );
});
