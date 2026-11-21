import { useQuery } from '@tanstack/react-query'
import { apiClient, type ApiClient } from './client'
import { callApi } from './errors'
import type { components } from './schema'

export type Lesson = components['schemas']['LessonResponse']

export type LessonsRange = {
  /** yyyy-MM-dd, inclusive. */
  from: string
  /** yyyy-MM-dd, inclusive; at most 3 months after `from`. */
  to: string
  /** Only the lessons of this slot; absent for every active slot. */
  slotId?: number
}

/** Common prefix of every lessons query: invalidating it refreshes all of them (docs 1.5). */
export const lessonsQueryKey = ['lessons'] as const

/** GET /api/v1/lessons (DI-56): the lessons of the active slots with their free capacity. */
export function listLessons(range: LessonsRange, client: ApiClient = apiClient): Promise<Lesson[]> {
  return callApi(() => client.GET('/api/v1/lessons', { params: { query: range } }))
}

export function useLessons(range: LessonsRange) {
  const { from, to, slotId } = range
  return useQuery({
    queryKey: [...lessonsQueryKey, { from, to, slotId: slotId ?? null }],
    queryFn: () => listLessons({ from, to, ...(slotId === undefined ? {} : { slotId }) }),
  })
}
