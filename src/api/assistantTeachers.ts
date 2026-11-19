import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, type ApiClient } from './client'
import { callApi } from './errors'
import type { components } from './schema'

export type AssistantTeacher = components['schemas']['AssistantTeacherResponse']
export type CreateAssistantTeacherRequest = components['schemas']['CreateAssistantTeacherRequest']

export type StatusFilter = 'active' | 'inactive' | 'all'

export const assistantTeachersQueryKey = ['assistant-teachers'] as const

/** GET /api/v1/assistant-teachers; `all` omits the `active` parameter. */
export function listAssistantTeachers(
  filter: StatusFilter,
  client: ApiClient = apiClient,
): Promise<AssistantTeacher[]> {
  const active = filter === 'all' ? undefined : filter === 'active'
  return callApi(() => client.GET('/api/v1/assistant-teachers', { params: { query: { active } } }))
}

/** POST /api/v1/assistant-teachers (CU-02 D1). */
export function createAssistantTeacher(
  input: CreateAssistantTeacherRequest,
  client: ApiClient = apiClient,
): Promise<AssistantTeacher> {
  return callApi(() => client.POST('/api/v1/assistant-teachers', { body: input }))
}

/** POST /api/v1/assistant-teachers/{id}/deactivate (CU-02 D1a). */
export function deactivateAssistantTeacher(
  id: number,
  client: ApiClient = apiClient,
): Promise<AssistantTeacher> {
  return callApi(() =>
    client.POST('/api/v1/assistant-teachers/{id}/deactivate', { params: { path: { id } } }),
  )
}

export function useAssistantTeachersQuery(filter: StatusFilter) {
  return useQuery({
    queryKey: [...assistantTeachersQueryKey, filter],
    queryFn: () => listAssistantTeachers(filter),
  })
}

export function useCreateAssistantTeacher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAssistantTeacherRequest) => createAssistantTeacher(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assistantTeachersQueryKey })
    },
  })
}

export function useDeactivateAssistantTeacher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deactivateAssistantTeacher(id),
    // Also after a failure (404, 409): the list may be out of date.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: assistantTeachersQueryKey })
    },
  })
}
