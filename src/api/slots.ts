import { useQuery } from '@tanstack/react-query'
import { apiClient, type ApiClient } from './client'
import { callApi } from './errors'
import type { components } from './schema'

export type SlotItem = components['schemas']['SlotItemResponse']

/** Common prefix of every slot query: invalidating it refreshes all of them (docs 1.5). */
export const slotsQueryKey = ['slots'] as const

/** GET /api/v1/slots?status=ACTIVE. */
export function listActiveSlots(client: ApiClient = apiClient): Promise<SlotItem[]> {
  return callApi(() => client.GET('/api/v1/slots', { params: { query: { status: 'ACTIVE' } } }))
}

export function useActiveSlotsQuery(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...slotsQueryKey, 'list', 'ACTIVE'],
    queryFn: () => listActiveSlots(),
    enabled: options.enabled,
  })
}
