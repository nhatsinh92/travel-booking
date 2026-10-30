import { describe, expect, it } from 'vitest';
import {
  buildSearchUrl,
  clearFiltersUrl,
  DEFAULT_SORT,
  hasActiveFilters,
  hasSearch,
  parseSearchCriteria,
  parseSearchFilters,
  updateFilters,
} from '@/lib/search-params';

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

  it('trims surrounding spaces from the city but keeps spaces inside it', () => {
    const url = buildSearchUrl({ ...criteria, city: '  Ho Chi Minh City  ' });
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('city')).toBe('Ho Chi Minh City');
  });

  it('produces a URL that hasSearch recognises', () => {
    expect(hasSearch(new URLSearchParams(buildSearchUrl(criteria).split('?')[1]))).toBe(true);
  });
});

const CRITERIA_QUERY = 'city=Hanoi&checkIn=2026-12-01&checkOut=2026-12-03&guests=2';

function queryOf(url: string): Record<string, string> {
  expect(url.startsWith('/search?')).toBe(true);
  return Object.fromEntries(new URLSearchParams(url.slice('/search?'.length)));
}

describe('parseSearchFilters', () => {
  it('defaults to no filters and the price_asc sort (US2-AS3)', () => {
    expect(DEFAULT_SORT).toBe('price_asc');
    expect(parseSearchFilters(new URLSearchParams(CRITERIA_QUERY))).toEqual({
      minPrice: '',
      maxPrice: '',
      minStars: '',
      sort: 'price_asc',
    });
  });

  it('shows prices from the URL in dollars (US2-AS1)', () => {
    const params = new URLSearchParams(`${CRITERIA_QUERY}&minPrice=10000&maxPrice=25050`);
    const filters = parseSearchFilters(params);
    expect(filters.minPrice).toBe('100');
    expect(filters.maxPrice).toBe('250.50');
  });

  it('reads the minimum stars and the sort (US2-AS2, US2-AS3)', () => {
    const filters = parseSearchFilters(
      new URLSearchParams(`${CRITERIA_QUERY}&minStars=3&sort=stars_desc`),
    );
    expect(filters.minStars).toBe('3');
    expect(filters.sort).toBe('stars_desc');
  });

  it('reads the same values from a searchParams record', () => {
    expect(
      parseSearchFilters({ minPrice: '5000', minStars: '4', sort: 'price_desc' }),
    ).toEqual({ minPrice: '50', maxPrice: '', minStars: '4', sort: 'price_desc' });
  });

  it('keeps unparseable values as they are so the server can name the field', () => {
    const filters = parseSearchFilters(
      new URLSearchParams('minPrice=abc&maxPrice=-5&minStars=x&sort=bogus'),
    );
    expect(filters).toEqual({ minPrice: 'abc', maxPrice: '-5', minStars: 'x', sort: 'bogus' });
  });
});

describe('hasActiveFilters', () => {
  it('is false with no filters, also when only a sort is set', () => {
    expect(hasActiveFilters(new URLSearchParams(CRITERIA_QUERY))).toBe(false);
    expect(hasActiveFilters(new URLSearchParams(`${CRITERIA_QUERY}&sort=stars_asc`))).toBe(false);
    expect(hasActiveFilters({})).toBe(false);
  });

  it.each(['minPrice', 'maxPrice', 'minStars'])('is true when %s is present', (name) => {
    expect(hasActiveFilters(new URLSearchParams({ [name]: '3' }))).toBe(true);
    expect(hasActiveFilters({ [name]: '3' })).toBe(true);
  });

  it('is false when a filter parameter is present but empty', () => {
    expect(hasActiveFilters(new URLSearchParams('minPrice='))).toBe(false);
  });
});

describe('updateFilters', () => {
  const base = new URLSearchParams(CRITERIA_QUERY);

  it('keeps the search criteria and stores dollars as cents (US2-AS1)', () => {
    const query = queryOf(updateFilters(base, { minPrice: '100', maxPrice: '250.5' }));
    expect(query).toEqual({
      city: 'Hanoi',
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      guests: '2',
      minPrice: '10000',
      maxPrice: '25050',
    });
  });

  it('sets the minimum stars and keeps the criteria (US2-AS2)', () => {
    const query = queryOf(updateFilters(base, { minStars: '4' }));
    expect(query.minStars).toBe('4');
    expect(query.city).toBe('Hanoi');
    expect(query.guests).toBe('2');
  });

  it('puts a non-default sort in the URL and keeps the criteria (US2-AS3)', () => {
    const query = queryOf(updateFilters(base, { sort: 'stars_desc' }));
    expect(query.sort).toBe('stars_desc');
    expect(query.checkOut).toBe('2026-12-03');
  });

  it('keeps the other filters and the sort when one of them changes', () => {
    const current = new URLSearchParams(`${CRITERIA_QUERY}&minPrice=10000&minStars=3&sort=price_desc`);
    const query = queryOf(updateFilters(current, { maxPrice: '300' }));
    expect(query).toMatchObject({ minPrice: '10000', maxPrice: '30000', minStars: '3', sort: 'price_desc' });
  });

  it('removes a filter that is set to an empty value', () => {
    const current = new URLSearchParams(`${CRITERIA_QUERY}&minPrice=10000&minStars=3`);
    const query = queryOf(updateFilters(current, { minPrice: '' }));
    expect(query).not.toHaveProperty('minPrice');
    expect(query.minStars).toBe('3');
  });

  it('leaves the default sort out of the URL', () => {
    const current = new URLSearchParams(`${CRITERIA_QUERY}&sort=stars_desc`);
    expect(queryOf(updateFilters(current, { sort: 'price_asc' }))).not.toHaveProperty('sort');
  });

  it('keeps an unparseable price as typed so the server can name the field', () => {
    expect(queryOf(updateFilters(base, { minPrice: 'abc' })).minPrice).toBe('abc');
  });

  it('leaves the criteria exactly as they were in the URL', () => {
    const url = updateFilters(base, { minStars: '2' });
    expect(parseSearchCriteria(new URLSearchParams(url.split('?')[1]))).toEqual(criteria);
  });
});

describe('clearFiltersUrl', () => {
  it('removes every filter and the sort but keeps the criteria (EC6)', () => {
    const current = new URLSearchParams(
      `${CRITERIA_QUERY}&minPrice=10000&maxPrice=25050&minStars=3&sort=stars_desc`,
    );
    expect(queryOf(clearFiltersUrl(current))).toEqual({
      city: 'Hanoi',
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      guests: '2',
    });
  });
});

describe('a new search (US2-AS5)', () => {
  it('drops all filters and the sort because buildSearchUrl carries only the criteria', () => {
    const current = new URLSearchParams(`${CRITERIA_QUERY}&minPrice=10000&minStars=3&sort=stars_desc`);
    const next = buildSearchUrl({ ...parseSearchCriteria(current), city: 'Bangkok' });
    expect(queryOf(next)).toEqual({ ...criteria, city: 'Bangkok' });
  });
});
