import { describe, expect, it, vi } from 'vitest';
import { createBrowserClient, createServerClient } from '@/lib/api/client';

const query = { city: 'Hanoi', checkIn: '2026-12-01', checkOut: '2026-12-03', guests: 2 };

function recordingFetch() {
  const requests: Request[] = [];
  const fetch = vi.fn(async (request: Request) => {
    requests.push(request);
    return new Response(JSON.stringify({ items: [], nextCursor: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return { fetch, requests };
}

describe('createServerClient', () => {
  it('sends requests to the base URL from API_BASE_URL', async () => {
    const { fetch, requests } = recordingFetch();
    const client = createServerClient({ API_BASE_URL: 'http://api.example:9000' }, { fetch });

    await client.GET('/api/v1/hotels/search', { params: { query } });

    expect(requests[0].url).toMatch(/^http:\/\/api\.example:9000\/api\/v1\/hotels\/search\?/);
  });

  it('falls back to the local API when API_BASE_URL is not set', async () => {
    const { fetch, requests } = recordingFetch();
    const client = createServerClient({}, { fetch });

    await client.GET('/api/v1/hotels/search', { params: { query } });

    expect(requests[0].url).toMatch(/^http:\/\/localhost:8080\/api\/v1\/hotels\/search\?/);
  });

  it("sends cache: 'no-store'", async () => {
    const { fetch, requests } = recordingFetch();
    const client = createServerClient({ API_BASE_URL: 'http://api.example:9000' }, { fetch });

    await client.GET('/api/v1/hotels/search', { params: { query } });

    expect(requests[0].cache).toBe('no-store');
  });
});

describe('createBrowserClient', () => {
  it('uses an empty base URL so calls go to the same-origin /api rewrite', async () => {
    const { fetch } = recordingFetch();
    const rawUrls: string[] = [];
    // Node cannot build a Request from a relative URL (a browser can), so resolve it for the
    // test and record what the client actually asked for.
    class RecordingRequest extends Request {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        rawUrls.push(String(input));
        super(
          typeof input === 'string' && input.startsWith('/') ? `http://localhost${input}` : input,
          init,
        );
      }
    }
    const client = createBrowserClient({ fetch, Request: RecordingRequest });

    await client.GET('/api/v1/hotels/search', { params: { query } });

    expect(rawUrls[0]).toMatch(/^\/api\/v1\/hotels\/search\?/);
  });
});
