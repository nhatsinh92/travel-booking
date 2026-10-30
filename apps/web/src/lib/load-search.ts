import type { ApiClient } from '@/lib/api/client';
import type { components, paths } from '@/lib/api/generated/schema';
import type { FieldError } from '@/lib/error-messages';
import {
  DEFAULT_SORT,
  hasActiveFilters,
  hasSearch,
  parseSearchCriteria,
  readParam,
  type SearchParamsInput,
} from '@/lib/search-params';
import { validateCriteria } from '@/lib/validate-criteria';

export type HotelResult = components['schemas']['HotelResult'];

export type SearchState =
  | { status: 'idle' }
  | { status: 'results'; items: HotelResult[]; nextCursor: string | null }
  | { status: 'empty' }
  | { status: 'no-filter-match' }
  | { status: 'no-city' }
  | { status: 'error'; errors: FieldError[] }
  | { status: 'unavailable' };

// The contract types guests and the filters as integers. Integer text becomes that number;
// anything else becomes NaN, which the server reports as INVALID_VALUE for the field.
function integerOrNaN(text: string): number {
  const trimmed = text.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export type SearchQuery = NonNullable<
  paths['/api/v1/hotels/search']['get']['parameters']['query']
>;

// The API query for the URL's criteria, filters and sort, plus the cursor of the page to fetch.
export function buildSearchQuery(params: SearchParamsInput, cursor?: string): SearchQuery {
  const criteria = parseSearchCriteria(params);
  const query: SearchQuery = { ...criteria, guests: integerOrNaN(criteria.guests) };
  for (const name of ['minPrice', 'maxPrice', 'minStars'] as const) {
    const text = (readParam(params, name) ?? '').trim();
    if (text !== '') query[name] = integerOrNaN(text);
  }
  const sort = (readParam(params, 'sort') ?? '').trim();
  // An unknown sort is sent as typed, so the server reports INVALID_SORT.
  if (sort !== '' && sort !== DEFAULT_SORT) query.sort = sort as SearchQuery['sort'];
  if (cursor) query.cursor = cursor;
  return query;
}

export async function loadSearch(
  params: SearchParamsInput,
  client: ApiClient,
): Promise<SearchState> {
  if (!hasSearch(params)) return { status: 'idle' };

  const criteria = parseSearchCriteria(params);
  // A blank guests value cannot be sent as a number, so blank criteria are reported here.
  const missing = validateCriteria(criteria).filter((error) => error.code === 'REQUIRED');
  if (missing.length > 0) return { status: 'error', errors: missing };

  try {
    const { data, error, response } = await client.GET('/api/v1/hotels/search', {
      params: { query: buildSearchQuery(params) },
    });

    if (data) {
      if (data.items.length > 0) {
        return { status: 'results', items: data.items, nextCursor: data.nextCursor };
      }
      return { status: hasActiveFilters(params) ? 'no-filter-match' : 'empty' };
    }
    // The 500 body has no code or errors, so only a validation or not-found problem is read here.
    const problem = typeof error === 'object' && error !== null && 'code' in error ? error : undefined;
    if (response.status === 404 && problem?.code === 'CITY_NOT_FOUND') return { status: 'no-city' };
    if (response.status === 400 && Array.isArray(problem?.errors)) {
      return { status: 'error', errors: problem.errors };
    }
    console.error(`Hotel search returned an unexpected response (status ${response.status})`);
  } catch (error) {
    // A failed request is handled like an unexpected response: the user can try again.
    console.error('Hotel search request failed', error);
  }
  return { status: 'unavailable' };
}
