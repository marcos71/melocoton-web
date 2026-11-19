import type { components } from '../api/schema'

/** The person's identity as the API returns it for a session. */
export type SessionUser = components['schemas']['SessionUserResponse']

/** Derived from the contract, so it cannot drift from the API. */
export type Role = SessionUser['role']

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Alumno',
  LEAD_TEACHER: 'Docente principal',
  ASSISTANT_TEACHER: 'Docente secundario',
}
