import createClient from 'openapi-fetch'
import type { paths } from './schema'

export type ApiClient = ReturnType<typeof createClient<paths>>

export const DEFAULT_API_URL = 'http://localhost:8080'

/**
 * Typed client for melocoton-api. Paths, parameters and bodies come from the
 * types generated from the contract (`npm run gen:api`).
 */
export function createApiClient(
  baseUrl: string,
  fetchFn: (request: Request) => Promise<Response> = (request) => globalThis.fetch(request),
): ApiClient {
  return createClient<paths>({ baseUrl, fetch: fetchFn })
}

export const apiClient = createApiClient(import.meta.env.VITE_API_URL || DEFAULT_API_URL)
