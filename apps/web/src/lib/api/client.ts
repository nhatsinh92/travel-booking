import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

export type ApiClient = ReturnType<typeof createClient<paths>>;

export type ClientDeps = {
  fetch?: (input: Request) => Promise<Response>;
  Request?: typeof Request;
};

export function createServerClient(
  env: { API_BASE_URL?: string } = process.env,
  deps: ClientDeps = {},
): ApiClient {
  throw new Error('not implemented');
}

export function createBrowserClient(deps: ClientDeps = {}): ApiClient {
  throw new Error('not implemented');
}
