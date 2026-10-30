import type { ApiClient } from '@/lib/api/client';
import type { components } from '@/lib/api/generated/schema';
import type { FieldError } from '@/lib/error-messages';
import { hasSearch, parseSearchCriteria, type SearchParamsInput } from '@/lib/search-params';

export type HotelResult = components['schemas']['HotelResult'];

export type SearchState =
  | { status: 'idle' }
  | { status: 'results'; items: HotelResult[]; nextCursor: string | null }
  | { status: 'empty' }
  | { status: 'no-city' }
  | { status: 'error'; errors: FieldError[] };

export async function loadSearch(
  params: SearchParamsInput,
  client: ApiClient,
): Promise<SearchState> {
  if (!hasSearch(params)) return { status: 'idle' };

  const criteria = parseSearchCriteria(params);
  const { data, error, response } = await client.GET('/api/v1/hotels/search', {
    params: {
      query: {
        ...criteria,
        // Sent as typed (the contract says number) so the server reports a blank guests value
        // as REQUIRED and a non-numeric one as INVALID_VALUE.
        guests: criteria.guests as unknown as number,
      },
    },
  });

  if (data) {
    return data.items.length > 0
      ? { status: 'results', items: data.items, nextCursor: data.nextCursor }
      : { status: 'empty' };
  }
  if (response.status === 404 && error?.code === 'CITY_NOT_FOUND') return { status: 'no-city' };
  if (response.status === 400 && error) return { status: 'error', errors: error.errors };
  throw new Error(`Hotel search failed with status ${response.status}`);
}
