import {
  ApiError,
  NETWORK_ERROR,
  UNEXPECTED_RESPONSE,
  callApi,
  networkError,
  toApiError,
} from './errors'

describe('toApiError', () => {
  it('readsCodeAndMessageFromTheErrorBody', () => {
    const error = toApiError(409, {
      error: { code: 'capacity_full', message: 'No quedan lugares en este turno.' },
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.code).toBe('capacity_full')
    expect(error.message).toBe('No quedan lugares en este turno.')
  })

  it('DI23_keepsTheDetailsOfTheErrorBodyWhenThereAreAny', () => {
    const error = toApiError(409, {
      error: { code: 'slot_overlap', message: 'x', details: { slotId: 3, dayOfWeek: 2 } },
    })

    expect(error.details).toEqual({ slotId: 3, dayOfWeek: 2 })
    expect(toApiError(409, { error: { code: 'x', message: 'y' } }).details).toBeUndefined()
  })

  it.each([
    ['html', '<html>Bad gateway</html>'],
    ['empty', undefined],
    ['other json', { message: 'boom' }],
    ['code without message', { error: { code: 'x' } }],
  ])('fallsBackToUnexpectedResponseWhenTheBodyIs %s', (_, body) => {
    const error = toApiError(502, body)

    expect(error.code).toBe(UNEXPECTED_RESPONSE)
    expect(error.status).toBe(502)
    expect(error.message).toBe('La API respondió algo inesperado (código HTTP 502).')
  })
})

describe('callApi', () => {
  it('returnsTheDataOfASuccessfulCall', async () => {
    const data = await callApi(async () => ({ data: { ok: true }, response: new Response() }))

    expect(data).toEqual({ ok: true })
  })

  it('throwsTheBusinessErrorOfAFailedCall', async () => {
    const call = callApi(async () => ({
      error: { error: { code: 'role_not_allowed', message: 'No tenés permiso.' } },
      response: new Response(null, { status: 403 }),
    }))

    await expect(call).rejects.toMatchObject({ status: 403, code: 'role_not_allowed' })
  })

  it('passesANetworkErrorThrownByFetchThrough', async () => {
    const thrown = networkError(new TypeError('Failed to fetch'))

    await expect(callApi(() => Promise.reject(thrown))).rejects.toBe(thrown)
    expect(thrown).toMatchObject({
      status: 0,
      code: NETWORK_ERROR,
      message: 'No se pudo conectar con la API. Revisá la conexión o que la API esté en marcha.',
    })
  })

  it('turnsATimeoutIntoANetworkError', async () => {
    const cause = new DOMException('The operation timed out.', 'TimeoutError')

    const error = await callApi(() => Promise.reject(cause)).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 0,
      code: NETWORK_ERROR,
      message: 'La API tardó demasiado en responder. Revisá la conexión e intentá de nuevo.',
      cause,
    })
  })

  it('doesNotTurnABugsTypeErrorIntoANetworkError', async () => {
    const cause = new TypeError("Cannot read properties of undefined (reading 'x')")

    const error = await callApi(() => Promise.reject(cause)).catch((e: unknown) => e)

    expect(error).toMatchObject({ code: UNEXPECTED_RESPONSE, cause })
  })

  it('turnsAnyOtherThrownErrorIntoAnUnexpectedResponse', async () => {
    const call = callApi(() => Promise.reject(new SyntaxError('Unexpected token <')))

    await expect(call).rejects.toMatchObject({ code: UNEXPECTED_RESPONSE })
  })
})
