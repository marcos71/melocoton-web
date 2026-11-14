import { createContext, useContext } from 'react'

// Until iteration 1 (authentication) the role is chosen by hand. It will come
// from the session then, typed by the API contract.
export const ROLES = ['STUDENT', 'LEAD_TEACHER', 'ASSISTANT_TEACHER'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Alumno',
  LEAD_TEACHER: 'Docente principal',
  ASSISTANT_TEACHER: 'Docente secundario',
}

export type RoleState = { role: Role; setRole: (role: Role) => void }

export const RoleContext = createContext<RoleState | null>(null)

export function useRole(): RoleState {
  const state = useContext(RoleContext)
  if (!state) throw new Error('useRole must be used inside a RoleProvider')
  return state
}
