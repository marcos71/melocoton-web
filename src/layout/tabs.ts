import type { Role } from '../auth/role'

export type Tab = { path: string; label: string }

/**
 * Bottom tabs per role: base document, section 8.1, and wireframes v3.
 * The first tab is each role's home. Messages (student) is phase 2.
 */
export const TABS_BY_ROLE: Record<Role, readonly [Tab, ...Tab[]]> = {
  STUDENT: [
    { path: '/home', label: 'Inicio' },
    { path: '/pieces', label: 'Mis piezas' },
    { path: '/calendar', label: 'Calendario' },
    { path: '/payments', label: 'Pagos' },
  ],
  LEAD_TEACHER: [
    { path: '/today', label: 'Hoy' },
    { path: '/pieces', label: 'Piezas' },
    { path: '/slots', label: 'Turnos' },
    { path: '/students', label: 'Alumnos' },
    { path: '/payments', label: 'Pagos' },
  ],
  ASSISTANT_TEACHER: [
    { path: '/today', label: 'Hoy' },
    { path: '/pieces', label: 'Piezas' },
  ],
}
