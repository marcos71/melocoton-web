import { z } from 'zod'
import type { components } from './schema'

type ErrorResponse = components['schemas']['ErrorResponse']

/** Client-side codes for failures that never reached a business error. */
export const NETWORK_ERROR = 'network_error'
export const UNEXPECTED_RESPONSE = 'unexpected_response'

/**
 * Any failed call to the API. `code` is meant for the code (English) and
 * `message` for the person (Spanish), as in the API's error body.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Only for `network_error`: the call never arrived, or it was cut off waiting for the answer. */
  readonly reason?: NetworkReason
  /** Only for some business codes (DI-23): its shape depends on the code, so it is read with a schema. */
  readonly details?: Record<string, unknown>

  constructor(
    status: number,
    code: string,
    message: string,
    options?: { cause?: unknown; reason?: NetworkReason; details?: Record<string, unknown> },
  ) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.reason = options?.reason
    this.details = options?.details
  }
}

const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
}) satisfies z.ZodType<ErrorResponse>

const detailsSchema = z.object({ error: z.object({ details: z.record(z.string(), z.unknown()) }) })

export type NetworkReason = 'unreachable' | 'timeout'

/** Builds an ApiError from an HTTP error response body. */
export function toApiError(status: number, body: unknown): ApiError {
  const parsed = errorResponseSchema.safeParse(body)
  if (parsed.success) {
    const details = detailsSchema.safeParse(body)
    return new ApiError(status, parsed.data.error.code, parsed.data.error.message, {
      ...(details.success ? { details: details.data.error.details } : {}),
    })
  }
  return new ApiError(
    status,
    UNEXPECTED_RESPONSE,
    `La API respondió algo inesperado (código HTTP ${status}).`,
  )
}

type RawResult<T> = { data?: T; error?: unknown; response: Response }

const NETWORK_MESSAGES: Record<NetworkReason, string> = {
  unreachable: 'No se pudo conectar con la API. Revisá la conexión o que la API esté en marcha.',
  timeout: 'La API tardó demasiado en responder. Revisá la conexión e intentá de nuevo.',
}

/** A call that never got an answer: the server was unreachable or took too long. */
export function networkError(
  cause: unknown,
  reason: NetworkReason = 'unreachable',
): ApiError {
  return new ApiError(0, NETWORK_ERROR, NETWORK_MESSAGES[reason], { cause, reason })
}

function isTimeout(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'TimeoutError'
}

/**
 * Runs a request made with the typed client and returns its data, or throws
 * an ApiError: a business error, an unexpected response or a network failure.
 * Only the failures of `fetch` itself (already an ApiError, see the client's
 * default fetch) or its timeout count as network failures: any other thrown
 * error is a bug and becomes an unexpected response with its cause kept.
 */
export async function callApi<T>(send: () => Promise<RawResult<T>>): Promise<T> {
  let result: RawResult<T>
  try {
    result = await send()
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    if (isTimeout(cause)) throw networkError(cause, 'timeout')
    throw new ApiError(0, UNEXPECTED_RESPONSE, 'La API respondió algo inesperado.', { cause })
  }
  if (result.data !== undefined) return result.data
  if (result.response.ok) return undefined as T
  throw toApiError(result.response.status, result.error)
}

/** The text to show for any failure: the API message when there is one. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Probá de nuevo.'
}
