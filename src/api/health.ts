import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient, type ApiClient } from './client'
import { callApi } from './errors'
import type { components } from './schema'

export type HealthResponse = components['schemas']['HealthResponse']

const healthResponseSchema = z.object({
  status: z.enum(['UP', 'DOWN']),
  database: z.enum(['UP', 'DOWN']),
}) satisfies z.ZodType<HealthResponse>

/**
 * GET /api/v1/health. A 503 is not a failure of the call: its body says what
 * is down (see the contract), so it is returned like a 200.
 */
export function fetchHealth(client: ApiClient = apiClient): Promise<HealthResponse> {
  return callApi(async () => {
    const result = await client.GET('/api/v1/health')
    if (result.response.status === 503) {
      const parsed = healthResponseSchema.safeParse(result.error)
      if (parsed.success) return { data: parsed.data, response: result.response }
    }
    return result
  })
}

export const healthQueryKey = ['health'] as const

export function useHealthQuery() {
  return useQuery({ queryKey: healthQueryKey, queryFn: () => fetchHealth() })
}
