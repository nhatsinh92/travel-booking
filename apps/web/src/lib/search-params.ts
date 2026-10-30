import { dollarsToCents } from '@/lib/money';

export type SearchCriteria = {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: string;
};

export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

const CRITERION_NAMES = ['city', 'checkIn', 'checkOut', 'guests'] as const;

export function readParam(params: SearchParamsInput, name: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(name) ?? undefined;
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}

export function parseSearchCriteria(params: SearchParamsInput): SearchCriteria {
  return {
    city: readParam(params, 'city') ?? '',
    checkIn: readParam(params, 'checkIn') ?? '',
    checkOut: readParam(params, 'checkOut') ?? '',
    guests: readParam(params, 'guests') ?? '',
  };
}

export function hasSearch(params: SearchParamsInput): boolean {
  return CRITERION_NAMES.some((name) => readParam(params, name) !== undefined);
}

export function buildSearchUrl(criteria: SearchCriteria): string {
  const query = new URLSearchParams();
  for (const name of CRITERION_NAMES) query.set(name, name === 'city' ? criteria.city.trim() : criteria[name]);
  return `/search?${query.toString()}`;
}

export const SORT_VALUES = ['price_asc', 'price_desc', 'stars_desc', 'stars_asc'] as const;
export const DEFAULT_SORT = 'price_asc';

// Form values: prices in dollars, as typed. The URL and the API carry cents.
export type SearchFilters = {
  minPrice: string;
  maxPrice: string;
  minStars: string;
  sort: string;
};

const PRICE_NAMES = ['minPrice', 'maxPrice'] as const;
const FILTER_NAMES = [...PRICE_NAMES, 'minStars'] as const;

// URL cents -> the dollars the form shows. Anything that is not a whole number of cents is kept
// as typed so the server can name the field.
function centsToDollars(text: string): string {
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) return text;
  const cents = Number(text);
  const remainder = cents % 100;
  const dollars = Math.floor(cents / 100);
  return remainder === 0 ? `${dollars}` : `${dollars}.${String(remainder).padStart(2, '0')}`;
}

// Dollars typed in the form -> the cents the URL carries; text that is not a price is kept as typed.
function dollarsToUrlValue(text: string): string {
  const trimmed = text.trim();
  const cents = dollarsToCents(trimmed);
  return cents === null ? trimmed : String(cents);
}

export function parseSearchFilters(params: SearchParamsInput): SearchFilters {
  const priceText = (name: (typeof PRICE_NAMES)[number]) => centsToDollars(readParam(params, name) ?? '');
  return {
    minPrice: priceText('minPrice'),
    maxPrice: priceText('maxPrice'),
    minStars: readParam(params, 'minStars') ?? '',
    sort: readParam(params, 'sort') || DEFAULT_SORT,
  };
}

// Sorting is not a filter: it never removes a hotel.
export function hasActiveFilters(params: SearchParamsInput): boolean {
  return FILTER_NAMES.some((name) => (readParam(params, name) ?? '').trim() !== '');
}

// The /search URL for the same criteria with the given filter changes applied. Filters not named
// in `changes` stay as they are; an empty value removes a filter; the default sort is left out.
export function updateFilters(params: SearchParamsInput, changes: Partial<SearchFilters>): string {
  const criteria = parseSearchCriteria(params);
  const query = new URLSearchParams();
  for (const name of CRITERION_NAMES) query.set(name, criteria[name]);

  const urlValue = (name: (typeof FILTER_NAMES)[number] | 'sort'): string => {
    const change = changes[name];
    if (change === undefined) return (readParam(params, name) ?? '').trim();
    return name === 'minPrice' || name === 'maxPrice' ? dollarsToUrlValue(change) : change.trim();
  };
  for (const name of FILTER_NAMES) {
    const value = urlValue(name);
    if (value !== '') query.set(name, value);
  }
  const sort = urlValue('sort');
  if (sort !== '' && sort !== DEFAULT_SORT) query.set('sort', sort);
  return `/search?${query.toString()}`;
}

export function clearFiltersUrl(params: SearchParamsInput): string {
  return updateFilters(params, { minPrice: '', maxPrice: '', minStars: '', sort: '' });
}
