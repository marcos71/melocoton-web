import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, type ApiClient } from './client'
import { callApi } from './errors'
import type { components } from './schema'
import { slotsQueryKey } from './slots'
import { studentDetailKey, studentsListKey } from './students'

export type FixedSlotAssignment = components['schemas']['FixedSlotAssignmentResponse']
export type Booking = components['schemas']['BookingResponse']

/** PUT /api/v1/students/{id}/fixed-slot (CU-04): assigns or replaces the fixed slot. */
export function assignFixedSlot(
  studentId: number,
  slotId: number,
  client: ApiClient = apiClient,
): Promise<FixedSlotAssignment> {
  return callApi(() =>
    client.PUT('/api/v1/students/{id}/fixed-slot', {
      params: { path: { id: studentId } },
      body: { slotId },
    }),
  )
}

/** POST /api/v1/students/{id}/drop-in-bookings/{bookingId}/cancel (CU-04 C1). */
export function cancelDropInBooking(
  studentId: number,
  bookingId: number,
  client: ApiClient = apiClient,
): Promise<Booking> {
  return callApi(() =>
    client.POST('/api/v1/students/{id}/drop-in-bookings/{bookingId}/cancel', {
      params: { path: { id: studentId, bookingId } },
    }),
  )
}

export function useAssignFixedSlot(studentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slotId: number) => assignFixedSlot(studentId, slotId),
    // Also after a failure: the error usually means the screen had old data (docs 1.5).
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: studentDetailKey(studentId) })
      void queryClient.invalidateQueries({ queryKey: studentsListKey })
      void queryClient.invalidateQueries({ queryKey: slotsQueryKey })
    },
  })
}

export function useCancelDropInBooking(studentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (bookingId: number) => cancelDropInBooking(studentId, bookingId),
    // Freeing a spot can take a class out of "excedida", so the slots refresh too.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: studentDetailKey(studentId) })
      void queryClient.invalidateQueries({ queryKey: slotsQueryKey })
    },
  })
}
