import type { components } from '@/lib/api/generated/schema';
import type { ApiClient } from '@/lib/api/client';
import type { FieldError } from '@/lib/error-messages';
import type { SearchParamsInput } from '@/lib/search-params';

export type HotelResult = components['schemas']['HotelResult'];

export type SearchState =
  | { status: 'idle' }
  | { status: 'results'; items: HotelResult[]; nextCursor: string | null }
  | { status: 'empty' }
  | { status: 'no-city' }
  | { status: 'error'; errors: FieldError[] };

export async function loadSearch(params: SearchParamsInput, client: ApiClient): Promise<SearchState> {
  throw new Error('not implemented');
}
