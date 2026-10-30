export type SearchCriteria = {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: string;
};

export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

const CRITERION_NAMES = ['city', 'checkIn', 'checkOut', 'guests'] as const;

function readParam(params: SearchParamsInput, name: string): string | undefined {
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

export function parseSearchFilters(params: SearchParamsInput): SearchFilters {
  throw new Error('not implemented');
}

export function hasActiveFilters(params: SearchParamsInput): boolean {
  throw new Error('not implemented');
}

export function updateFilters(params: SearchParamsInput, changes: Partial<SearchFilters>): string {
  throw new Error('not implemented');
}

export function clearFiltersUrl(params: SearchParamsInput): string {
  throw new Error('not implemented');
}
