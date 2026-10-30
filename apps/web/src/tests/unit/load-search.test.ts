import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServerClient, type ApiClient } from '@/lib/api/client';
import { buildSearchQuery, loadSearch } from '@/lib/load-search';

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
        query: { city: 'Hanoi', checkIn: '2026-12-01', checkOut: '2026-12-03', guests: 2 },
      },
    });
  });

  it.each([
    ['2', 2],
    [' 3 ', 3],
    ['10', 10],
    ['-1', -1],
    ['99999999999', 99999999999],
  ])('sends guests %j to the client as the number %d', async (text, expected) => {
    const { client, GET } = clientReturning({ data: { items: [], nextCursor: null } });

    await loadSearch(
      new URLSearchParams({ city: 'Hanoi', checkIn: '2026-12-01', checkOut: '2026-12-03', guests: text }),
      client,
    );

    expect(GET.mock.calls[0][1].params.query.guests).toBe(expected);
  });

  it.each(['abc', '2.5', '1e1', '0x10', '2 guests'])(
    'sends a non-integer guests value %j as NaN so the server reports INVALID_VALUE',
    async (text) => {
      const { client, GET } = clientReturning({ data: { items: [], nextCursor: null } });

      await loadSearch(
        new URLSearchParams({
          city: 'Hanoi',
          checkIn: '2026-12-01',
          checkOut: '2026-12-03',
          guests: text,
        }),
        client,
      );

      expect(GET.mock.calls[0][1].params.query.guests).toBeNaN();
    },
  );

  it('sends the other values as typed, including a wrong format', async () => {
    const { client, GET } = clientReturning({ data: { items: [], nextCursor: null } });

    await loadSearch(
      new URLSearchParams('city=Hanoi&checkIn=2027-13-45&checkOut=2027-13-46&guests=2'),
      client,
    );

    expect(GET.mock.calls[0][1].params.query).toMatchObject({
      checkIn: '2027-13-45',
      checkOut: '2027-13-46',
    });
  });

  it.each(['city', 'checkIn', 'checkOut', 'guests'])(
    'returns REQUIRED for a blank %s without calling the API',
    async (field) => {
      const { client, GET } = clientReturning({ data: { items: [], nextCursor: null } });
      const query = new URLSearchParams({
        city: 'Hanoi',
        checkIn: '2026-12-01',
        checkOut: '2026-12-03',
        guests: '2',
      });
      query.set(field, '  ');

      expect(await loadSearch(query, client)).toEqual({
        status: 'error',
        errors: [{ field, code: 'REQUIRED', meta: {} }],
      });
      expect(GET).not.toHaveBeenCalled();
    },
  );

  it('reports every missing criterion together, and a missing one from the URL', async () => {
    const { client, GET } = clientReturning({ data: { items: [], nextCursor: null } });

    const state = await loadSearch(new URLSearchParams('city=Hanoi'), client);

    expect(state).toMatchObject({ status: 'error' });
    expect(state.status === 'error' && state.errors.map((e) => e.field)).toEqual([
      'checkIn',
      'checkOut',
      'guests',
    ]);
    expect(GET).not.toHaveBeenCalled();
  });

  it('returns results with the items and the next cursor for a 200 with items', async () => {
    const { client } = clientReturning({ data: { items: [hotel], nextCursor: 'abc' } });

    expect(await loadSearch(params, client)).toEqual({
      status: 'results',
      items: [hotel],
      nextCursor: 'abc',
    });
  });

  it('logs nothing for the handled states', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handled = [
      clientReturning({ data: { items: [hotel], nextCursor: null } }),
      clientReturning({ data: { items: [], nextCursor: null } }),
      clientReturning({
        error: problem(404, [{ field: 'city', code: 'CITY_NOT_FOUND', meta: {} }]),
        status: 404,
      }),
      clientReturning({
        error: problem(400, [{ field: 'guests', code: 'INVALID_VALUE', meta: {} }]),
        status: 400,
      }),
    ];
    for (const { client } of handled) await loadSearch(params, client);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
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

  describe('filters and sort (US2)', () => {
    const emptyPage = { data: { items: [], nextCursor: null } };
    const withFilters = (extra: string) => new URLSearchParams(`${params.toString()}&${extra}`);

    it('passes the filters and the sort to the client as numbers and a sort name (US2-AS1 to AS3)', async () => {
      const { client, GET } = clientReturning(emptyPage);

      await loadSearch(
        withFilters('minPrice=10000&maxPrice=25050&minStars=3&sort=stars_desc'),
        client,
      );

      expect(GET.mock.calls[0][1].params.query).toEqual({
        city: 'Hanoi',
        checkIn: '2026-12-01',
        checkOut: '2026-12-03',
        guests: 2,
        minPrice: 10000,
        maxPrice: 25050,
        minStars: 3,
        sort: 'stars_desc',
      });
    });

    it('sends only the filters that are set and leaves the default sort to the server', async () => {
      const { client, GET } = clientReturning(emptyPage);

      await loadSearch(withFilters('minStars=4&maxPrice=&sort=price_asc'), client);

      const query = GET.mock.calls[0][1].params.query;
      expect(query.minStars).toBe(4);
      expect(query).not.toHaveProperty('maxPrice');
      expect(query).not.toHaveProperty('minPrice');
      expect(query).not.toHaveProperty('sort');
    });

    it.each(['minPrice', 'maxPrice', 'minStars'])(
      'sends a non-integer %s as NaN so the server reports INVALID_VALUE (EC9)',
      async (name) => {
        const { client, GET } = clientReturning(emptyPage);

        await loadSearch(withFilters(`${name}=abc`), client);

        expect(GET.mock.calls[0][1].params.query[name]).toBeNaN();
      },
    );

    it('passes an unknown sort on as typed so the server reports INVALID_SORT', async () => {
      const { client, GET } = clientReturning(emptyPage);

      await loadSearch(withFilters('sort=bogus'), client);

      expect(GET.mock.calls[0][1].params.query.sort).toBe('bogus');
    });

    it('returns no-filter-match for an empty result while a filter is active (EC6, FR-009)', async () => {
      for (const filter of ['minPrice=10000', 'maxPrice=500', 'minStars=5']) {
        const { client } = clientReturning(emptyPage);
        expect(await loadSearch(withFilters(filter), client)).toEqual({ status: 'no-filter-match' });
      }
    });

    it('returns empty, not no-filter-match, when no filter is active (EC5, FR-007)', async () => {
      const { client } = clientReturning(emptyPage);
      expect(await loadSearch(params, client)).toEqual({ status: 'empty' });

      const { client: sorted } = clientReturning(emptyPage);
      expect(await loadSearch(withFilters('sort=stars_desc'), sorted)).toEqual({ status: 'empty' });
    });

    it('returns results with the first page cursor while filters are active (US2-AS4)', async () => {
      const { client } = clientReturning({ data: { items: [hotel], nextCursor: 'next-1' } });

      expect(await loadSearch(withFilters('minStars=3&sort=price_desc'), client)).toEqual({
        status: 'results',
        items: [hotel],
        nextCursor: 'next-1',
      });
    });
  });

  describe('buildSearchQuery (used by LoadMore, US2-AS4)', () => {
    it('carries the criteria, filters and sort of the URL, plus the cursor', () => {
      const query = buildSearchQuery(
        new URLSearchParams(`${params.toString()}&minPrice=10000&minStars=3&sort=price_desc`),
        'abc',
      );
      expect(query).toEqual({
        city: 'Hanoi',
        checkIn: '2026-12-01',
        checkOut: '2026-12-03',
        guests: 2,
        minPrice: 10000,
        minStars: 3,
        sort: 'price_desc',
        cursor: 'abc',
      });
    });

    it('has no cursor key without a cursor', () => {
      expect(buildSearchQuery(params)).not.toHaveProperty('cursor');
    });
  });

  describe('when the search service is unavailable (EC10, FR-017)', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('logs the error when the request fails', async () => {
      const failure = new TypeError('fetch failed');
      const GET = vi.fn().mockRejectedValue(failure);

      await loadSearch(params, { GET } as unknown as ApiClient);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(vi.mocked(console.error).mock.calls[0]).toContain(failure);
    });

    it('logs the status code for an unexpected response', async () => {
      const { client } = clientReturning({ error: { message: 'boom' }, status: 503 });

      await loadSearch(params, client);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(String(vi.mocked(console.error).mock.calls[0][0])).toContain('503');
    });

    it('returns unavailable when the request fails', async () => {
      const GET = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

      expect(await loadSearch(params, { GET } as unknown as ApiClient)).toEqual({
        status: 'unavailable',
      });
    });

    it('returns unavailable for a 500 with an unrecognised body', async () => {
      const { client } = clientReturning({ error: { message: 'boom' }, status: 500 });

      expect(await loadSearch(params, client)).toEqual({ status: 'unavailable' });
    });

    it('returns unavailable for the 500 problem document the API sends', async () => {
      const { client } = clientReturning({
        error: { title: 'Internal server error', status: 500 },
        status: 500,
      });

      expect(await loadSearch(params, client)).toEqual({ status: 'unavailable' });
    });

    it('returns unavailable for a 503 with an empty body', async () => {
      const { client } = clientReturning({ error: '', status: 503 });

      expect(await loadSearch(params, client)).toEqual({ status: 'unavailable' });
    });

    it('returns unavailable for a 400 whose body is not a problem document', async () => {
      const { client } = clientReturning({ error: { message: 'bad gateway page' }, status: 400 });

      expect(await loadSearch(params, client)).toEqual({ status: 'unavailable' });
    });

    it('returns unavailable for a 404 that is not CITY_NOT_FOUND', async () => {
      const { client } = clientReturning({
        error: problem(404, [{ field: 'x', code: 'INVALID_SORT', meta: {} }]),
        status: 404,
      });

      expect(await loadSearch(params, client)).toEqual({ status: 'unavailable' });
    });
  });

  // The other tests mock the client, so they cannot see how guests reaches the URL.
  describe('with the real API client and a stubbed fetch', () => {
    async function queryFor(search: string): Promise<URLSearchParams> {
      const requests: Request[] = [];
      const fetch = vi.fn(async (request: Request) => {
        requests.push(request);
        return new Response(JSON.stringify({ items: [], nextCursor: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
      const client = createServerClient({ API_BASE_URL: 'http://api.example' }, { fetch });

      await loadSearch(new URLSearchParams(search), client);

      return new URL(requests[0].url).searchParams;
    }

    const base = 'city=Hanoi&checkIn=2026-12-01&checkOut=2026-12-03';

    it('puts a non-integer guests value in the URL as guests=NaN (EC9, FR-015)', async () => {
      expect((await queryFor(`${base}&guests=abc`)).get('guests')).toBe('NaN');
    });

    it('puts an integer guests value in the URL as digits', async () => {
      expect((await queryFor(`${base}&guests=2`)).get('guests')).toBe('2');
    });

    it('sends the other criteria unchanged', async () => {
      const query = await queryFor(`${base}&guests=2`);

      expect(Object.fromEntries(query)).toEqual({
        city: 'Hanoi',
        checkIn: '2026-12-01',
        checkOut: '2026-12-03',
        guests: '2',
      });
    });
  });
});
