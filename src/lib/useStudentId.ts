import { useRouteId } from './useRouteId'

/** The student `:id` of the URL, or `NaN` when it is not a positive integer (so no request is made). */
export function useStudentId(): number {
  return useRouteId()
}
