import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, type ApiClient } from './client'
import { ApiError, callApi } from './errors'
import type { components } from './schema'

export type StudentItem = components['schemas']['StudentItemResponse']
export type StudentProfile = components['schemas']['StudentProfileResponse']
export type UpcomingLesson = components['schemas']['UpcomingLessonResponse']
export type CreateStudentRequest = components['schemas']['CreateStudentRequest']
export type UpdateStudentRequest = components['schemas']['UpdateStudentRequest']

export type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL'
export type StudentsFilters = {
  status: StatusFilter
  enrollmentType?: 'MONTHLY' | 'DROP_IN'
  slotId?: number
}

export const studentsQueryKey = ['students'] as const
export const studentsListKey = [...studentsQueryKey, 'list'] as const
export const studentDetailKey = (id: number) => [...studentsQueryKey, 'detail', id] as const

/** GET /api/v1/students. */
export function listStudents(
  filters: StudentsFilters,
  client: ApiClient = apiClient,
): Promise<StudentItem[]> {
  return callApi(() => client.GET('/api/v1/students', { params: { query: filters } }))
}

/** GET /api/v1/students/{id}. */
export function getStudent(id: number, client: ApiClient = apiClient): Promise<StudentProfile> {
  return callApi(() => client.GET('/api/v1/students/{id}', { params: { path: { id } } }))
}

/** POST /api/v1/students (CU-02). */
export function createStudent(
  input: CreateStudentRequest,
  client: ApiClient = apiClient,
): Promise<StudentProfile> {
  return callApi(() => client.POST('/api/v1/students', { body: input }))
}

/** PATCH /api/v1/students/{id}: only the fields present change. */
export function updateStudent(
  id: number,
  input: UpdateStudentRequest,
  client: ApiClient = apiClient,
): Promise<StudentProfile> {
  return callApi(() =>
    client.PATCH('/api/v1/students/{id}', { params: { path: { id } }, body: input }),
  )
}

export function useStudentsQuery(filters: StudentsFilters) {
  return useQuery({
    queryKey: [...studentsListKey, filters],
    queryFn: () => listStudents(filters),
  })
}

/** A missing student is not fixed by trying again, so a 404 is not retried. */
const RETRIES = 1

export function useStudentQuery(id: number) {
  return useQuery({
    queryKey: studentDetailKey(id),
    queryFn: () => getStudent(id),
    enabled: Number.isInteger(id) && id > 0,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < RETRIES,
  })
}

export function useCreateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStudentRequest) => createStudent(input),
    onSuccess: (student) => {
      queryClient.setQueryData(studentDetailKey(student.id), student)
      void queryClient.invalidateQueries({ queryKey: studentsListKey })
    },
  })
}

export function useUpdateStudent(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateStudentRequest) => updateStudent(id, input),
    onSuccess: (student) => {
      queryClient.setQueryData(studentDetailKey(id), student)
      void queryClient.invalidateQueries({ queryKey: studentsListKey })
    },
    onError: (error) => {
      // A 404 means the student is gone: the profile read has to find out.
      if (error instanceof ApiError && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: studentDetailKey(id) })
      }
    },
  })
}
