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
  for (const name of CRITERION_NAMES) query.set(name, criteria[name]);
  return `/search?${query.toString()}`;
}
