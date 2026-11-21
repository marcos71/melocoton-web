import { ApiError, NETWORK_ERROR, UNEXPECTED_RESPONSE, errorMessage } from './errors'

const UNREACHABLE_TEXT =
  'No pudimos conectar. Revisá tu conexión e intentá de nuevo. No se guardó nada.'
const TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se guardó: revisá la ficha antes de intentar de nuevo.'
const SERVER_TEXT = 'Algo falló en la API. Probá de nuevo en un rato.'

/** The call was cut off waiting: the action may or may not have been applied. */
export function isTimeout(error: unknown): boolean {
  return error instanceof ApiError && error.code === NETWORK_ERROR && error.reason === 'timeout'
}

function isServerFailure(error: ApiError): boolean {
  return error.status >= 500 || error.code === UNEXPECTED_RESPONSE
}

type ActionErrorOptions = {
  /** Texts that replace the API message for a business code (section 9 of the design). */
  byCode?: Record<string, string>
  /** Replaces the text of a timeout, for screens that tell where to check (docs 3.2). */
  onTimeout?: string
}

/**
 * The text of the Error block of a failed action (docs/pantallas_alumnos.md, 1.3 and 9): the
 * network and server cases have their own texts; a business code uses the screen's text for it
 * or, failing that, the API's message.
 */
export function actionErrorText(error: unknown, { byCode = {}, onTimeout }: ActionErrorOptions = {}): string {
  if (!(error instanceof ApiError)) return errorMessage(error)
  if (error.code === NETWORK_ERROR) {
    return error.reason === 'timeout' ? (onTimeout ?? TIMEOUT_TEXT) : UNREACHABLE_TEXT
  }
  if (isServerFailure(error)) return SERVER_TEXT
  return byCode[error.code] ?? error.message
}

/** The reason of a failed read, shown in the Error block above "Reintentar". */
export function readErrorText(error: unknown): string {
  if (error instanceof ApiError && isServerFailure(error)) return SERVER_TEXT
  return errorMessage(error)
}
