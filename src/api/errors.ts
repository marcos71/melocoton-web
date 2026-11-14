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

  constructor(status: number, code: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
}) satisfies z.ZodType<ErrorResponse>

/** Builds an ApiError from an HTTP error response body. */
export function toApiError(status: number, body: unknown): ApiError {
  const parsed = errorResponseSchema.safeParse(body)
  if (parsed.success) {
    return new ApiError(status, parsed.data.error.code, parsed.data.error.message)
  }
  return new ApiError(
    status,
    UNEXPECTED_RESPONSE,
    `La API respondió algo inesperado (código HTTP ${status}).`,
  )
}

type RawResult<T> = { data?: T; error?: unknown; response: Response }

/**
 * Runs a request made with the typed client and returns its data, or throws
 * an ApiError: a business error, an unexpected response or a network failure.
 */
export async function callApi<T>(send: () => Promise<RawResult<T>>): Promise<T> {
  let result: RawResult<T>
  try {
    result = await send()
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    if (cause instanceof TypeError) {
      // fetch rejects with a TypeError when the server cannot be reached.
      throw new ApiError(
        0,
        NETWORK_ERROR,
        'No se pudo conectar con la API. Revisá la conexión o que la API esté en marcha.',
        { cause },
      )
    }
    throw new ApiError(0, UNEXPECTED_RESPONSE, 'La API respondió algo inesperado.', { cause })
  }
  if (result.data !== undefined) return result.data
  if (result.response.ok) return undefined as T
  throw toApiError(result.response.status, result.error)
}
