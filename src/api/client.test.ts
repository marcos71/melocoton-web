import { tokenStore } from '../auth/tokenStore'
import { seedSession, jsonResponse, errorResponse, TEST_TOKEN } from '../test/utils'
import { REQUEST_TIMEOUT_MS, createApiClient, defaultFetch } from './client'
import { ApiError, NETWORK_ERROR, UNEXPECTED_RESPONSE } from './errors'
import { fetchSession, logIn } from './auth'

function clientAnswering(answer: (request: Request) => Promise<Response>) {
  const fetchFn = vi.fn(answer)
  return { client: createApiClient('http://api.test', fetchFn), fetchFn }
}

describe('apiClient authentication middleware', () => {
  it('RF01_addsTheBearerTokenWhenThereIsOne', async () => {
    seedSession()
    const { client, fetchFn } = clientAnswering(async () =>
      jsonResponse(200, { user: { id: 1, name: 'Ana', role: 'STUDENT' } }),
    )

    await fetchSession(client)

    expect(fetchFn.mock.calls[0]?.[0].headers.get('Authorization')).toBe(`Bearer ${TEST_TOKEN}`)
  })

  it('sendsNoAuthorizationHeaderWithoutAToken', async () => {
    const { client, fetchFn } = clientAnswering(async () =>
      jsonResponse(200, { user: { id: 1, name: 'Ana', role: 'STUDENT' } }),
    )

    await fetchSession(client)

    expect(fetchFn.mock.calls[0]?.[0].headers.has('Authorization')).toBe(false)
  })

  it('doesNotSendTheTokenToLogin', async () => {
    seedSession()
    const { client, fetchFn } = clientAnswering(async () => errorResponse(401, 'invalid_credentials', 'No'))

    await expect(logIn('a@b.com', 'x', client)).rejects.toThrow()

    expect(fetchFn.mock.calls[0]?.[0].headers.has('Authorization')).toBe(false)
  })

  it('CU01_a401OnAnAuthenticatedRequestClearsTheToken', async () => {
    seedSession()
    const listener = vi.fn()
    tokenStore.subscribe(listener)
    const { client } = clientAnswering(async () => errorResponse(401, 'unauthorized', 'Vencida'))

    await expect(fetchSession(client)).rejects.toMatchObject({ status: 401 })

    expect(tokenStore.get()).toBeNull()
    expect(listener).toHaveBeenCalledWith('expired')
  })

  it('RF01_a401OnLoginDoesNotClearAStoredToken', async () => {
    seedSession()
    const { client } = clientAnswering(async () =>
      errorResponse(401, 'invalid_credentials', 'Email o contraseña incorrectos.'),
    )

    await expect(logIn('a@b.com', 'x', client)).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    })

    expect(tokenStore.get()?.accessToken).toBe(TEST_TOKEN)
  })

  it('doesNotEndASessionStartedAfterTheRequestWasSent', async () => {
    seedSession()
    const { client } = clientAnswering(async () => {
      seedSession({ accessToken: 'newer-token' })
      return errorResponse(401, 'unauthorized', 'Vencida')
    })

    await expect(fetchSession(client)).rejects.toMatchObject({ status: 401 })

    expect(tokenStore.get()?.accessToken).toBe('newer-token')
  })
})

/**
 * AbortSignal.timeout runs on the runtime's own timer, which fake timers do
 * not control: the test takes over the signal it returns and fires it by hand.
 */
function controlTimeout() {
  const timer = new AbortController()
  const spy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timer.signal)
  const fire = () => timer.abort(new DOMException('The operation timed out.', 'TimeoutError'))
  return { spy, fire }
}

type FetchLike = (request: Request, init?: RequestInit) => Promise<Response>

describe('default fetch', () => {
  const requestOf = (signal?: AbortSignal) =>
    new Request('http://api.test/api/v1/health', { signal })

  it('abortsAfterTheRequestTimeout', () => {
    const { spy, fire } = controlTimeout()
    const fetchStub = vi.fn<FetchLike>(() => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetchStub)

    void defaultFetch(requestOf())
    const signal = fetchStub.mock.calls[0]?.[1]?.signal as AbortSignal

    expect(REQUEST_TIMEOUT_MS).toBe(15_000)
    expect(spy).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS)
    expect(signal.aborted).toBe(false)
    fire()
    expect(signal.aborted).toBe(true)
    expect((signal.reason as DOMException).name).toBe('TimeoutError')
  })

  it('keepsTheAbortOfTheSignalTheRequestAlreadyHad', async () => {
    const fetchStub = vi.fn<FetchLike>(() => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetchStub)
    const own = new AbortController()

    void defaultFetch(requestOf(own.signal))
    const signal = fetchStub.mock.calls[0]?.[1]?.signal as AbortSignal
    expect(signal.aborted).toBe(false)
    own.abort()

    expect(signal.aborted).toBe(true)
  })

  it('aTimeoutReachesTheCallerAsANetworkError', async () => {
    const { fire } = controlTimeout()
    vi.stubGlobal(
      'fetch',
      (_request: Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    const pending = fetchSession(createApiClient('http://api.test')).catch((e: unknown) => e)

    await vi.waitFor(() => expect(AbortSignal.timeout).toHaveBeenCalled())
    fire()

    const error = await pending
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 0,
      code: NETWORK_ERROR,
      message: 'La API tardó demasiado en responder. Revisá la conexión e intentá de nuevo.',
    })
  })

  it('aFetchTypeErrorBecomesANetworkError', async () => {
    const cause = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', () => Promise.reject(cause))

    const error = await fetchSession(createApiClient('http://api.test')).catch((e: unknown) => e)

    expect(error).toMatchObject({
      status: 0,
      code: NETWORK_ERROR,
      message: 'No se pudo conectar con la API. Revisá la conexión o que la API esté en marcha.',
      cause,
    })
  })

  it('aTypeErrorThrownByAMiddlewareIsNotANetworkError', async () => {
    // Not a fetch failure: it must surface as a bug, whatever the default fetch does.
    vi.stubGlobal('fetch', () => Promise.resolve(jsonResponse(200, { user: { id: 1, name: 'Ana', role: 'STUDENT' } })))
    const client = createApiClient('http://api.test')
    client.use({
      onRequest() {
        return (undefined as unknown as { x: { y: Request } }).x.y
      },
    })

    const error = await fetchSession(client).catch((e: unknown) => e)

    expect(error).toMatchObject({ code: UNEXPECTED_RESPONSE })
    expect((error as ApiError).cause).toBeInstanceOf(TypeError)
  })
})
