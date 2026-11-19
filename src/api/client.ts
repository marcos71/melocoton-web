import createClient, { type Middleware } from 'openapi-fetch'
import { tokenStore } from '../auth/tokenStore'
import { networkError } from './errors'
import type { paths } from './schema'

export type ApiClient = ReturnType<typeof createClient<paths>>

export const DEFAULT_API_URL = 'http://localhost:8080'

/** Calls made without a session: they carry no token and a 401 there is not an expired session. */
const PUBLIC_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/password-reset-requests',
  '/api/v1/auth/set-password',
]

function isPublic(request: Request): boolean {
  return PUBLIC_PATHS.includes(new URL(request.url).pathname)
}

function bearerOf(request: Request): string | null {
  const header = request.headers.get('Authorization')
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

/**
 * Adds the session token to every call that is not public, and ends the
 * session when the API answers 401 to a call that carried it (CU-01 4a).
 */
export const authMiddleware: Middleware = {
  onRequest({ request }) {
    if (isPublic(request)) return undefined
    const session = tokenStore.get()
    if (session) request.headers.set('Authorization', `Bearer ${session.accessToken}`)
    return request
  },
  onResponse({ request, response }) {
    if (response.status !== 401 || isPublic(request)) return undefined
    const sent = bearerOf(request)
    // Only if it is still the same token: a new login must not be undone by a late answer.
    if (sent !== null && tokenStore.get()?.accessToken === sent) tokenStore.clear('expired')
    return undefined
  },
}

/** A call that gets no answer in this time is given up, so no screen waits forever. */
export const REQUEST_TIMEOUT_MS = 15_000

/**
 * The fetch the app uses: gives up after REQUEST_TIMEOUT_MS (together with any
 * signal the request already has) and reports a failed `fetch` (the browser
 * rejects with a TypeError when the server cannot be reached) as a network
 * ApiError. Only this call is guarded: a TypeError thrown anywhere else (a
 * middleware, say) is a bug and must not pass for a network failure.
 */
export async function defaultFetch(request: Request): Promise<Response> {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
  try {
    return await globalThis.fetch(request, { signal })
  } catch (cause) {
    if (cause instanceof TypeError) throw networkError(cause)
    throw cause
  }
}

/**
 * Typed client for melocoton-api. Paths, parameters and bodies come from the
 * types generated from the contract (`npm run gen:api`).
 */
export function createApiClient(
  baseUrl: string,
  fetchFn: (request: Request) => Promise<Response> = defaultFetch,
): ApiClient {
  const client = createClient<paths>({ baseUrl, fetch: fetchFn })
  client.use(authMiddleware)
  return client
}

export const apiClient = createApiClient(import.meta.env.VITE_API_URL || DEFAULT_API_URL)
