import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@/lib/api/client';
import { loadSearch } from '@/lib/load-search';

const hotel = {
  id: 1,
  name: 'Grand Hanoi',
  starRating: 4,
  pricePerNightCents: 12550,
  currency: 'USD',
  imageUrl: '/images/hotels/hotel-01.png',
};

const params = new URLSearchParams('city=Hanoi&checkIn=2026-12-01&checkOut=2026-12-03&guests=2');

function clientReturning(result: { data?: unknown; error?: unknown; status?: number }) {
  const GET = vi.fn().mockResolvedValue({
    data: result.data,
    error: result.error,
    response: new Response(null, { status: result.status ?? (result.error ? 400 : 200) }),
  });
  return { client: { GET } as unknown as ApiClient, GET };
}

function problem(status: number, errors: { field: string; code: string; meta?: object }[]) {
  return { title: 'Validation failed', status, code: errors[0].code, errors };
}

describe('loadSearch', () => {
  it('returns idle and does not call the API when there are no search params', async () => {
    const { client, GET } = clientReturning({ data: { items: [], nextCursor: null } });

    expect(await loadSearch(new URLSearchParams(''), client)).toEqual({ status: 'idle' });
    expect(await loadSearch({}, client)).toEqual({ status: 'idle' });
    expect(GET).not.toHaveBeenCalled();
  });

  it('passes the criteria to the search endpoint', async () => {
    const { client, GET } = clientReturning({ data: { items: [hotel], nextCursor: null } });

    await loadSearch(params, client);

    expect(GET).toHaveBeenCalledWith('/api/v1/hotels/search', {
      params: {
        query: { city: 'Hanoi', checkIn: '2026-12-01', checkOut: '2026-12-03', guests: '2' },
      },
    });
  });

  it('sends values as typed so the server can report them, including a wrong format', async () => {
    const { client, GET } = clientReturning({ data: { items: [], nextCursor: null } });

    await loadSearch(
      new URLSearchParams('city=Hanoi&checkIn=2027-13-45&checkOut=&guests=abc'),
      client,
    );

    expect(GET).toHaveBeenCalledWith('/api/v1/hotels/search', {
      params: { query: { city: 'Hanoi', checkIn: '2027-13-45', checkOut: '', guests: 'abc' } },
    });
  });

  it('returns results with the items and the next cursor for a 200 with items', async () => {
    const { client } = clientReturning({ data: { items: [hotel], nextCursor: 'abc' } });

    expect(await loadSearch(params, client)).toEqual({
      status: 'results',
      items: [hotel],
      nextCursor: 'abc',
    });
  });

  it('returns empty for a 200 with no items', async () => {
    const { client } = clientReturning({ data: { items: [], nextCursor: null } });

    expect(await loadSearch(params, client)).toEqual({ status: 'empty' });
  });

  it('returns no-city for a 404 CITY_NOT_FOUND', async () => {
    const { client } = clientReturning({
      error: problem(404, [{ field: 'city', code: 'CITY_NOT_FOUND', meta: {} }]),
      status: 404,
    });

    expect(await loadSearch(params, client)).toEqual({ status: 'no-city' });
  });

  it('returns error carrying the codes and field names for a 400', async () => {
    const errors = [
      { field: 'checkIn', code: 'CHECK_IN_IN_PAST', meta: {} },
      { field: 'guests', code: 'GUESTS_OUT_OF_RANGE', meta: { min: 1, max: 10 } },
    ];
    const { client } = clientReturning({ error: problem(400, errors), status: 400 });

    expect(await loadSearch(params, client)).toEqual({ status: 'error', errors });
  });

  it('carries INVALID_VALUE with the name of the field', async () => {
    const errors = [{ field: 'guests', code: 'INVALID_VALUE', meta: {} }];
    const { client } = clientReturning({ error: problem(400, errors), status: 400 });

    expect(await loadSearch(params, client)).toEqual({ status: 'error', errors });
  });

  it('throws for a response the contract does not describe, so the error boundary shows it', async () => {
    const { client } = clientReturning({ error: { message: 'boom' }, status: 500 });

    await expect(loadSearch(params, client)).rejects.toThrow(/500/);
  });
});
