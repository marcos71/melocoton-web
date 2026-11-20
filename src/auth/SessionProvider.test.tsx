import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokenStore } from './tokenStore'
import {
  createTestQueryClient,
  errorResponse,
  jsonResponse,
  renderApp,
  requestsTo,
  seedSession,
  sessionUser,
  stubApi,
  TEST_TOKEN,
  TEST_USER_NAME,
} from '../test/utils'

const EXPIRED_NOTICE = 'Tu sesión venció. Pasó un tiempo sin uso. Ingresá de nuevo para seguir.'
const HOURS = 3600 * 1000

function tabLabels(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
}

describe('session start', () => {
  it('RF01_withoutATokenShowsTheLoginScreen', () => {
    renderApp({ role: null })

    expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('RF02_aValidTokenOpensTheHomeOfEachRole', async () => {
    const homes = {
      STUDENT: ['Inicio', ['Inicio', 'Mis piezas', 'Calendario', 'Pagos']],
      LEAD_TEACHER: ['Hoy', ['Hoy', 'Piezas', 'Turnos', 'Alumnos', 'Pagos']],
      ASSISTANT_TEACHER: ['Hoy', ['Hoy', 'Piezas']],
    } as const
    for (const role of ['STUDENT', 'LEAD_TEACHER', 'ASSISTANT_TEACHER'] as const) {
      const { unmount } = renderApp({ role })
      expect(screen.getByRole('status')).toHaveTextContent('Cargando…')

      expect(await screen.findByRole('heading', { name: homes[role][0] })).toBeInTheDocument()
      expect(tabLabels()).toEqual(homes[role][1])
      unmount()
    }
  })

  it('CU01_a401OnStartShowsTheLoginWithTheExpiredNotice', async () => {
    seedSession()
    const fetchFn = stubApi({
      'GET /api/v1/auth/session': () => errorResponse(401, 'unauthorized', 'Sesión inválida.'),
    })

    renderApp({ role: null })

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(EXPIRED_NOTICE)
    expect(tokenStore.get()).toBeNull()
    // A 401 is an answer, not a failure to retry.
    expect(requestsTo(fetchFn, 'GET /api/v1/auth/session')).toHaveLength(1)
  })

  it('CU01_aNetworkErrorOnStartKeepsTheTokenAndOffersToRetry', async () => {
    seedSession()
    let up = false
    const fetchFn = stubApi({
      'GET /api/v1/auth/session': () =>
        up
          ? jsonResponse(200, { user: sessionUser('STUDENT') })
          : Promise.reject(new TypeError('offline')),
    })

    renderApp({ role: null })

    expect(await screen.findByText('Error: No se pudo verificar tu sesión.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con la API.')
    // The read is retried once before giving up.
    expect(requestsTo(fetchFn, 'GET /api/v1/auth/session')).toHaveLength(2)
    expect(tokenStore.get()?.accessToken).toBe(TEST_TOKEN)

    up = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('CU01_a401InAnyCallDuringUseSendsThePersonToTheLoginWithTheExpiredNotice', async () => {
    const queryClient = createTestQueryClient()
    stubApi({
      'GET /api/v1/assistant-teachers': () =>
        errorResponse(401, 'unauthorized', 'Tu cuenta fue desactivada.'),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers', queryClient })

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(EXPIRED_NOTICE)
    expect(tokenStore.get()).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })
})

describe('public screens while the stored token is checked (CU-01, RF-01)', () => {
  const HEALTH = 'GET /api/v1/health'
  const SESSION = 'GET /api/v1/auth/session'
  const healthUp = () => jsonResponse(200, { status: 'UP', database: 'UP' })

  it('CU01_publicScreensWorkWhenTheSessionCheckFailsOnTheNetwork', async () => {
    seedSession()
    stubApi({
      [SESSION]: () => Promise.reject(new TypeError('offline')),
      [HEALTH]: healthUp,
    })

    const health = renderApp({ role: null, path: '/health' })
    expect(await screen.findByRole('heading', { name: 'Estado de la conexión' })).toBeInTheDocument()
    health.unmount()

    const setPassword = renderApp({ role: null, path: '/set-password#token=abc' })
    expect(await screen.findByRole('heading', { name: 'Definí tu contraseña' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument()
    setPassword.unmount()

    renderApp({ role: null, path: '/login' })
    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.queryByText('Error: No se pudo verificar tu sesión.')).not.toBeInTheDocument()
    expect(tokenStore.get()?.accessToken).toBe(TEST_TOKEN)
  })

  it('CU01_aProtectedRouteShowsTheErrorAndRetryRecoversWhenTheApiIsBack', async () => {
    seedSession()
    let up = false
    stubApi({
      [SESSION]: () =>
        up
          ? jsonResponse(200, { user: sessionUser('STUDENT') })
          : Promise.reject(new TypeError('offline')),
    })

    renderApp({ role: null, path: '/payments' })

    expect(await screen.findByText('Error: No se pudo verificar tu sesión.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con la API.')
    expect(screen.getByTestId('location')).toHaveTextContent('/payments')
    up = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { name: 'Pagos' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/payments')
  })

  it('DI38_refreshOnlyRunsOnceTheSessionIsAuthenticated', async () => {
    const now = new Date('2030-06-10T12:00:00Z')
    seedSession({ refreshedAt: new Date(now.getTime() - 25 * HOURS).toISOString() })
    const fetchFn = stubApi({
      [SESSION]: () => Promise.reject(new TypeError('offline')),
      'POST /api/v1/auth/refresh': () => jsonResponse(200, { accessToken: 'x', expiresAt: '2031-01-01T00:00:00Z' }),
    })

    renderApp({ role: null, path: '/', now: () => now })
    await screen.findByText('Error: No se pudo verificar tu sesión.')

    expect(requestsTo(fetchFn, 'POST /api/v1/auth/refresh')).toHaveLength(0)
  })

  it('CU01_whileTheCheckIsPendingProtectedAndLoginShowLoadingAndHealthIsVisible', async () => {
    seedSession()
    stubApi({
      [SESSION]: () => new Promise<Response>(() => {}),
      [HEALTH]: healthUp,
    })

    const protectedRoute = renderApp({ role: null, path: '/' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.getByTestId('location')).toHaveTextContent('/')
    protectedRoute.unmount()

    // No flash of the login form for someone who may be about to be redirected.
    const login = renderApp({ role: null, path: '/login' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.queryByRole('heading', { name: 'Ingresar' })).not.toBeInTheDocument()
    login.unmount()

    renderApp({ role: null, path: '/health' })
    expect(screen.getByRole('heading', { name: 'Estado de la conexión' })).toBeInTheDocument()
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })
})

describe('logout', () => {
  it('RF01_loggingOutClearsTheTokenAndShowsTheLoginWithANotice', async () => {
    const queryClient = createTestQueryClient()
    stubApi({})
    renderApp({ role: 'STUDENT', queryClient })
    await screen.findByRole('heading', { name: 'Inicio' })

    await userEvent.click(screen.getByRole('button', { name: TEST_USER_NAME }))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Cerraste la sesión.')
    expect(tokenStore.get()).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})

describe('token refresh', () => {
  const stubSessionAndRefresh = (refresh: () => Response | Promise<Response>) =>
    stubApi({
      'GET /api/v1/auth/session': () => jsonResponse(200, { user: sessionUser('STUDENT') }),
      'POST /api/v1/auth/refresh': refresh,
    })
  const renewed = () =>
    jsonResponse(200, { accessToken: 'renewed-token', expiresAt: '2031-01-01T00:00:00Z' })

  it('RF01_refreshesOnStartWhenTheTokenIsOlderThan24Hours', async () => {
    const now = new Date('2030-06-10T12:00:00Z')
    seedSession({ refreshedAt: new Date(now.getTime() - 25 * HOURS).toISOString() })
    const fetchFn = stubSessionAndRefresh(renewed)

    renderApp({ role: null, now: () => now })

    await waitFor(() => expect(tokenStore.get()?.accessToken).toBe('renewed-token'))
    expect(tokenStore.get()?.refreshedAt).toBe(now.toISOString())
    const requests = requestsTo(fetchFn, 'POST /api/v1/auth/refresh')
    expect(requests).toHaveLength(1)
    expect(requests[0]?.headers.get('Authorization')).toBe(`Bearer ${TEST_TOKEN}`)
  })

  it('RF01_doesNotRefreshOnStartWhenTheTokenIsYoungerThan24Hours', async () => {
    const now = new Date('2030-06-10T12:00:00Z')
    seedSession({ refreshedAt: new Date(now.getTime() - 23 * HOURS).toISOString() })
    const fetchFn = stubSessionAndRefresh(renewed)

    renderApp({ role: null, now: () => now })
    await screen.findByRole('heading', { name: 'Inicio' })

    expect(requestsTo(fetchFn, 'POST /api/v1/auth/refresh')).toHaveLength(0)
  })

  it('RF01_refreshesWhenTheAppComesBackToTheForegroundAndIsDue', async () => {
    let time = new Date('2030-06-10T12:00:00Z').getTime()
    seedSession({ refreshedAt: new Date(time).toISOString() })
    const fetchFn = stubSessionAndRefresh(renewed)
    renderApp({ role: null, now: () => new Date(time) })
    await screen.findByRole('heading', { name: 'Inicio' })
    expect(requestsTo(fetchFn, 'POST /api/v1/auth/refresh')).toHaveLength(0)

    time += 25 * HOURS
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(tokenStore.get()?.accessToken).toBe('renewed-token'))
    expect(requestsTo(fetchFn, 'POST /api/v1/auth/refresh')).toHaveLength(1)
  })

  it('CU01_a401OnRefreshEndsTheSession', async () => {
    const now = new Date('2030-06-10T12:00:00Z')
    seedSession({ refreshedAt: new Date(now.getTime() - 25 * HOURS).toISOString() })
    stubSessionAndRefresh(() => errorResponse(401, 'unauthorized', 'Vencida.'))

    renderApp({ role: null, now: () => now })

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(EXPIRED_NOTICE)
    expect(tokenStore.get()).toBeNull()
  })

  it('aNetworkErrorOnRefreshKeepsTheSession', async () => {
    const now = new Date('2030-06-10T12:00:00Z')
    seedSession({ refreshedAt: new Date(now.getTime() - 25 * HOURS).toISOString() })
    const fetchFn = stubSessionAndRefresh(() => Promise.reject(new TypeError('offline')))

    renderApp({ role: null, now: () => now })
    await waitFor(() => expect(requestsTo(fetchFn, 'POST /api/v1/auth/refresh')).toHaveLength(1))

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(tokenStore.get()?.accessToken).toBe(TEST_TOKEN)
  })

  it('neverRefreshesTwiceAtTheSameTime', async () => {
    let time = new Date('2030-06-10T12:00:00Z').getTime()
    seedSession({ refreshedAt: new Date(time).toISOString() })
    const fetchFn = stubSessionAndRefresh(() => new Promise<Response>(() => {}))
    renderApp({ role: null, now: () => new Date(time) })
    await screen.findByRole('heading', { name: 'Inicio' })

    time += 25 * HOURS
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(requestsTo(fetchFn, 'POST /api/v1/auth/refresh')).toHaveLength(1))
  })
})
