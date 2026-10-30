import { describe, expect, it } from 'vitest';
import { buildSearchUrl, hasSearch, parseSearchCriteria } from '@/lib/search-params';

const criteria = {
  city: 'Hanoi',
  checkIn: '2026-12-01',
  checkOut: '2026-12-03',
  guests: '2',
};

describe('parseSearchCriteria', () => {
  it('reads the four criteria from URLSearchParams', () => {
    const params = new URLSearchParams(
      'city=Hanoi&checkIn=2026-12-01&checkOut=2026-12-03&guests=2',
    );
    expect(parseSearchCriteria(params)).toEqual(criteria);
  });

  it('reads the four criteria from a searchParams record', () => {
    expect(
      parseSearchCriteria({
        city: 'Hanoi',
        checkIn: '2026-12-01',
        checkOut: '2026-12-03',
        guests: '2',
      }),
    ).toEqual(criteria);
  });

  it('uses an empty string for a missing criterion', () => {
    expect(parseSearchCriteria(new URLSearchParams('city=Hanoi'))).toEqual({
      city: 'Hanoi',
      checkIn: '',
      checkOut: '',
      guests: '',
    });
  });

  it('keeps unparseable values as typed so the server can name the field', () => {
    const parsed = parseSearchCriteria(new URLSearchParams('checkIn=2027-13-45&guests=abc'));
    expect(parsed.checkIn).toBe('2027-13-45');
    expect(parsed.guests).toBe('abc');
  });

  it('takes the first value when a record parameter is repeated', () => {
    expect(parseSearchCriteria({ city: ['Hanoi', 'Bangkok'] }).city).toBe('Hanoi');
  });

  it('ignores parameters that are not search criteria', () => {
    expect(parseSearchCriteria(new URLSearchParams('utm=x'))).toEqual({
      city: '',
      checkIn: '',
      checkOut: '',
      guests: '',
    });
  });
});

describe('hasSearch', () => {
  it('is false for a bare /search', () => {
    expect(hasSearch(new URLSearchParams(''))).toBe(false);
    expect(hasSearch({})).toBe(false);
  });

  it.each(['city', 'checkIn', 'checkOut', 'guests'])('is true when %s is present', (name) => {
    expect(hasSearch(new URLSearchParams({ [name]: 'x' }))).toBe(true);
    expect(hasSearch({ [name]: 'x' })).toBe(true);
  });

  it('is true when a criterion is present but empty', () => {
    expect(hasSearch(new URLSearchParams('city='))).toBe(true);
  });

  it('is false when only unrelated parameters are present', () => {
    expect(hasSearch(new URLSearchParams('utm=x'))).toBe(false);
    expect(hasSearch({ utm: 'x', other: undefined })).toBe(false);
  });
});

describe('buildSearchUrl', () => {
  it('builds a /search URL carrying the four criteria', () => {
    const url = buildSearchUrl(criteria);
    expect(url.startsWith('/search?')).toBe(true);
    const params = new URLSearchParams(url.slice('/search?'.length));
    expect(Object.fromEntries(params)).toEqual(criteria);
  });

  it('encodes special characters and round-trips them', () => {
    const tricky = { ...criteria, city: 'Ho Chi Minh City & Co' };
    const url = buildSearchUrl(tricky);
    expect(url).not.toContain(' ');
    expect(parseSearchCriteria(new URLSearchParams(url.split('?')[1]))).toEqual(tricky);
  });

  it('produces a URL that hasSearch recognises', () => {
    expect(hasSearch(new URLSearchParams(buildSearchUrl(criteria).split('?')[1]))).toBe(true);
  });
});
