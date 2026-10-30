import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

export type ApiClient = ReturnType<typeof createClient<paths>>;

export type ClientDeps = {
  fetch?: (input: Request) => Promise<Response>;
  Request?: typeof Request;
};

// Same default as the /api rewrite in next.config.ts and .env.example.
const DEFAULT_API_BASE_URL = 'http://localhost:8080';

export function createServerClient(
  env: Record<string, string | undefined> = process.env,
  deps: ClientDeps = {},
): ApiClient {
  return createClient<paths>({
    baseUrl: env.API_BASE_URL ?? DEFAULT_API_BASE_URL,
    cache: 'no-store',
    ...deps,
  });
}

// An empty base URL keeps calls same-origin, so they go through the /api rewrite.
export function createBrowserClient(deps: ClientDeps = {}): ApiClient {
  return createClient<paths>({ baseUrl: '', ...deps });
}
