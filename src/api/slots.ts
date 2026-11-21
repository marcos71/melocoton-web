import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient, type ApiClient } from './client'
import { ApiError, callApi } from './errors'
import { lessonsQueryKey } from './lessons'
import type { components } from './schema'
import { studentsQueryKey } from './students'

export type SlotItem = components['schemas']['SlotItemResponse']
/** What creating a slot answers: the slot without the read-only figures (fixed students, editability). */
export type CreatedSlot = components['schemas']['SlotResponse']
export type CreateSlotRequest = components['schemas']['CreateSlotRequest']
export type UpdateSlotRequest = components['schemas']['UpdateSlotRequest']

/** Common prefix of every slot query: invalidating it refreshes all of them (docs 1.5). */
export const slotsQueryKey = ['slots'] as const
export const slotsListKey = [...slotsQueryKey, 'list', 'ACTIVE'] as const
export const slotDetailKey = (id: number) => [...slotsQueryKey, 'detail', id] as const

/** GET /api/v1/slots?status=ACTIVE. */
export function listActiveSlots(client: ApiClient = apiClient): Promise<SlotItem[]> {
  return callApi(() => client.GET('/api/v1/slots', { params: { query: { status: 'ACTIVE' } } }))
}

/** GET /api/v1/slots/{id}. */
export function getSlot(id: number, client: ApiClient = apiClient): Promise<SlotItem> {
  return callApi(() => client.GET('/api/v1/slots/{id}', { params: { path: { id } } }))
}

/** POST /api/v1/slots (CU-03). */
export function createSlot(input: CreateSlotRequest, client: ApiClient = apiClient): Promise<CreatedSlot> {
  return callApi(() => client.POST('/api/v1/slots', { body: input }))
}

/** PATCH /api/v1/slots/{id}: only the fields present change (DI-63). */
export function updateSlot(
  id: number,
  input: UpdateSlotRequest,
  client: ApiClient = apiClient,
): Promise<SlotItem> {
  return callApi(() =>
    client.PATCH('/api/v1/slots/{id}', { params: { path: { id } }, body: input }),
  )
}

const overlapDetailsSchema = z.object({
  dayOfWeek: z.number(),
  startTime: z.string(),
  endTime: z.string(),
})

/** The slot a `slot_overlap` error says is in the way (DI-23), or `null` when the details are missing. */
export function slotOverlapDetails(
  error: ApiError,
): { dayOfWeek: number; startTime: string; endTime: string } | null {
  const parsed = overlapDetailsSchema.safeParse(error.details)
  return parsed.success ? parsed.data : null
}

export function useActiveSlotsQuery(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: slotsListKey,
    queryFn: () => listActiveSlots(),
    enabled: options.enabled,
  })
}

/** A missing slot is not fixed by trying again, so a 404 is not retried. */
const RETRIES = 1

/** One slot; while it loads, the slot of the list (if the list is already read) stands in. */
export function useSlotQuery(id: number) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: slotDetailKey(id),
    queryFn: () => getSlot(id),
    enabled: Number.isInteger(id) && id > 0,
    placeholderData: () =>
      queryClient.getQueryData<SlotItem[]>(slotsListKey)?.find((slot) => slot.id === id),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < RETRIES,
  })
}

export function useCreateSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSlotRequest) => createSlot(input),
    // Also after a failure: an overlap or a timeout usually means the list on screen is old.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: slotsQueryKey })
      void queryClient.invalidateQueries({ queryKey: lessonsQueryKey })
    },
  })
}

export function useUpdateSlot(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSlotRequest) => updateSlot(id, input),
    onSuccess: (slot) => {
      queryClient.setQueryData(slotDetailKey(id), slot)
      void queryClient.invalidateQueries({ queryKey: [...slotsQueryKey, 'list'] })
      void queryClient.invalidateQueries({ queryKey: lessonsQueryKey })
      // The students' lists and profiles show the slot's day and time.
      void queryClient.invalidateQueries({ queryKey: studentsQueryKey })
    },
    onError: () => {
      // slot_has_bookings, slot_overlap, status_conflict and timeouts all mean the slots on screen are old.
      void queryClient.invalidateQueries({ queryKey: slotsQueryKey })
    },
  })
}
