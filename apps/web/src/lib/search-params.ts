export type SearchCriteria = {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: string;
};

export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

export function parseSearchCriteria(params: SearchParamsInput): SearchCriteria {
  throw new Error('not implemented');
}

export function hasSearch(params: SearchParamsInput): boolean {
  throw new Error('not implemented');
}

export function buildSearchUrl(criteria: SearchCriteria): string {
  throw new Error('not implemented');
}
