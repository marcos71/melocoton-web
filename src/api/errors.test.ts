import { ApiError, NETWORK_ERROR, UNEXPECTED_RESPONSE, callApi, toApiError } from './errors'

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

  it('turnsANetworkFailureIntoANetworkError', async () => {
    const call = callApi(() => Promise.reject(new TypeError('Failed to fetch')))

    await expect(call).rejects.toMatchObject({
      status: 0,
      code: NETWORK_ERROR,
      message: 'No se pudo conectar con la API. Revisá la conexión o que la API esté en marcha.',
    })
  })

  it('turnsAnyOtherThrownErrorIntoAnUnexpectedResponse', async () => {
    const call = callApi(() => Promise.reject(new SyntaxError('Unexpected token <')))

    await expect(call).rejects.toMatchObject({ code: UNEXPECTED_RESPONSE })
  })
})
