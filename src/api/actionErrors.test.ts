import { actionErrorText, isTimeout, readErrorText } from './actionErrors'
import { ApiError, UNEXPECTED_RESPONSE, networkError } from './errors'

describe('actionErrorText', () => {
  it('RF04_noConnectionSaysNothingWasSaved', () => {
    const error = networkError(new TypeError('offline'))

    expect(error.reason).toBe('unreachable')
    expect(actionErrorText(error)).toBe(
      'No pudimos conectar. Revisá tu conexión e intentá de nuevo. No se guardó nada.',
    )
    expect(isTimeout(error)).toBe(false)
  })

  it('RF04_aTimeoutSaysItIsNotKnownWhetherItWasSaved', () => {
    const error = networkError(new Error('slow'), 'timeout')

    expect(error.reason).toBe('timeout')
    expect(actionErrorText(error)).toBe(
      'La API tardó demasiado. No sabemos si se guardó: revisá la ficha antes de intentar de nuevo.',
    )
    expect(actionErrorText(error, { onTimeout: 'Revisá la lista.' })).toBe('Revisá la lista.')
    expect(isTimeout(error)).toBe(true)
  })

  it('RF04_aServerFailureOrAnUnexpectedBodyUsesTheGenericText', () => {
    const generic = 'Algo falló en la API. Probá de nuevo en un rato.'
    expect(actionErrorText(new ApiError(500, 'internal_error', 'boom'))).toBe(generic)
    expect(actionErrorText(new ApiError(502, UNEXPECTED_RESPONSE, 'raro'))).toBe(generic)
    expect(actionErrorText(new ApiError(0, UNEXPECTED_RESPONSE, 'raro'))).toBe(generic)
  })

  it('RF04_aBusinessCodeUsesTheScreenTextOrTheApiMessage', () => {
    const error = new ApiError(409, 'slot_inactive', 'Mensaje de la API.')

    expect(actionErrorText(error, { byCode: { slot_inactive: 'Texto de la pantalla.' } })).toBe(
      'Texto de la pantalla.',
    )
    expect(actionErrorText(error)).toBe('Mensaje de la API.')
    expect(actionErrorText(new ApiError(429, 'too_many_requests', 'Demasiados pedidos.'))).toBe(
      'Demasiados pedidos.',
    )
    expect(actionErrorText(new ApiError(403, 'role_not_allowed', 'No podés.'))).toBe('No podés.')
  })

  it('RF04_anythingElseGetsTheUnexpectedText', () => {
    expect(actionErrorText(new Error('x'))).toBe('Ocurrió un error inesperado. Probá de nuevo.')
  })
})

describe('readErrorText', () => {
  it('RF04_aReadFailureShowsTheApiMessageExceptForServerFailures', () => {
    expect(readErrorText(new ApiError(404, 'not_found', 'No existe.'))).toBe('No existe.')
    expect(readErrorText(networkError(new TypeError('x')))).toContain('No se pudo conectar')
    expect(readErrorText(new ApiError(503, 'x', 'caído'))).toBe(
      'Algo falló en la API. Probá de nuevo en un rato.',
    )
  })
})
