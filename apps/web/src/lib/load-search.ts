import type { ApiClient } from '@/lib/api/client';
import type { components } from '@/lib/api/generated/schema';
import type { FieldError } from '@/lib/error-messages';
import { hasSearch, parseSearchCriteria, type SearchParamsInput } from '@/lib/search-params';
import { validateCriteria } from '@/lib/validate-criteria';

export type HotelResult = components['schemas']['HotelResult'];

export type SearchState =
  | { status: 'idle' }
  | { status: 'results'; items: HotelResult[]; nextCursor: string | null }
  | { status: 'empty' }
  | { status: 'no-city' }
  | { status: 'error'; errors: FieldError[] }
  | { status: 'unavailable' };

// The contract types guests as an integer. Integer text becomes that number; anything else
// becomes NaN, which the server reports as INVALID_VALUE for the field.
function guestsToNumber(text: string): number {
  const trimmed = text.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
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
      params: {
        query: {
          ...criteria,
          guests: guestsToNumber(criteria.guests),
        },
      },
    });

    if (data) {
      return data.items.length > 0
        ? { status: 'results', items: data.items, nextCursor: data.nextCursor }
        : { status: 'empty' };
    }
    if (response.status === 404 && error?.code === 'CITY_NOT_FOUND') return { status: 'no-city' };
    if (response.status === 400 && Array.isArray(error?.errors)) {
      return { status: 'error', errors: error.errors };
    }
    console.error(`Hotel search returned an unexpected response (status ${response.status})`);
  } catch (error) {
    // A failed request is handled like an unexpected response: the user can try again.
    console.error('Hotel search request failed', error);
  }
  return { status: 'unavailable' };
}
