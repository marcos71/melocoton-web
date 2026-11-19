import { render } from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router'
import { AppRoutes } from '../App'
import { createQueryClient } from '../app/queryClient'
import { SessionProvider } from '../auth/SessionProvider'
import type { Role } from '../auth/role'
import { tokenStore } from '../auth/tokenStore'

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } })
}

/** The app's query client, keeping its retry policy but without waiting between retries. */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient()
  const defaults = client.getDefaultOptions()
  client.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retryDelay: 0 } })
  return client
}

export const TEST_TOKEN = 'test-token'
export const TEST_USER_NAME = 'Ana Prueba'

export function sessionUser(role: Role) {
  return { id: 1, name: TEST_USER_NAME, role }
}

/** Stores a token as a previous visit would have left it. */
export function seedSession({
  refreshedAt = new Date().toISOString(),
  accessToken = TEST_TOKEN,
}: { refreshedAt?: string; accessToken?: string } = {}) {
  tokenStore.save({
    accessToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    refreshedAt,
  })
}

/**
 * Renders the app.
 *
 * - `role` (default STUDENT) starts a session for that role: it stores a token
 *   and answers GET /auth/session; every other call goes to the fetch stub the
 *   test installed before. Wait for the home screen with `findBy...`.
 * - `role: null` starts without touching the token store or fetch, so a test
 *   can set up anonymous or unusual starts (use `seedSession`).
 */
export function renderApp({
  role = 'STUDENT',
  path = '/',
  queryClient = createTestQueryClient(),
  now,
  refreshedAt,
}: {
  role?: Role | null
  path?: string
  queryClient?: QueryClient
  now?: () => Date
  refreshedAt?: string
} = {}) {
  if (role) {
    seedSession({ refreshedAt })
    const inner = globalThis.fetch
    vi.stubGlobal('fetch', (input: Request) => {
      if (new URL(input.url).pathname === '/api/v1/auth/session') {
        return Promise.resolve(jsonResponse(200, { user: sessionUser(role) }))
      }
      return inner(input)
    })
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider now={now}>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <AppRoutes />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  )
}

/** Exposes the current location to the tests, as `data-testid="location"`. */
function LocationProbe() {
  const location = useLocation()
  return (
    <span hidden data-testid="location">
      {location.pathname + location.search + location.hash}
    </span>
  )
}

type RouteHandler = (request: Request) => Response | Promise<Response>

/**
 * Stubs fetch with one handler per `METHOD /path` (for example
 * `GET /api/v1/auth/session`). An unexpected call fails the test loudly.
 * Install it before `renderApp`.
 */
export function stubApi(routes: Record<string, RouteHandler>) {
  const fetchFn = vi.fn(async (input: Request) => {
    const key = `${input.method} ${new URL(input.url).pathname}`
    const handler = routes[key]
    if (!handler) throw new Error(`Unexpected API call: ${key}`)
    return handler(input)
  })
  vi.stubGlobal('fetch', fetchFn)
  return fetchFn
}

/** The requests the stub received for one `METHOD /path`. */
export function requestsTo(fetchFn: { mock: { calls: unknown[][] } }, key: string): Request[] {
  return (fetchFn.mock.calls as [Request][])
    .map(([request]) => request)
    .filter((request) => `${request.method} ${new URL(request.url).pathname}` === key)
}
