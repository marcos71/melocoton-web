import { useParams } from 'react-router'

/** The `:id` of the URL, or `NaN` when it is not a positive integer (so no request is made). */
export function useStudentId(): number {
  const { id } = useParams()
  return id !== undefined && /^[1-9]\d{0,14}$/.test(id) ? Number(id) : Number.NaN
}
