import type { Role } from '../auth/role'
import { TABS_BY_ROLE } from './tabs'

/** Screens only the lead teacher reaches (RF-02), under the account menu's "Ajustes". */
export const ADMIN_PATHS = [
  '/admin',
  '/admin/assistant-teachers',
  '/admin/assistant-teachers/new',
] as const

/**
 * Routes with parameters that only the lead teacher reaches (DI-46, DI-53), under the Alumnos
 * tab. A `:name` segment stands for any single segment.
 */
export const STUDENT_PATHS = [
  '/students/new',
  '/students/:id',
  '/students/:id/edit',
  '/students/:id/fixed-slot',
  '/students/:id/drop-in/new',
] as const

export function homePath(role: Role): string {
  return TABS_BY_ROLE[role][0].path
}

export function allowedPaths(role: Role): string[] {
  const tabs = TABS_BY_ROLE[role].map((tab) => tab.path)
  return role === 'LEAD_TEACHER' ? [...tabs, ...ADMIN_PATHS, ...STUDENT_PATHS] : tabs
}

/** Whether a concrete path fits a route pattern: same segments, `:name` matching any non-empty one. */
function matchesPattern(pattern: string, pathname: string): boolean {
  const patternSegments = pattern.split('/')
  const segments = pathname.split('/')
  return (
    patternSegments.length === segments.length &&
    patternSegments.every((part, i) => (part.startsWith(':') ? !!segments[i] : part === segments[i]))
  )
}

/** Whether the role may open this path (query and fragment are ignored). */
export function canUsePath(role: Role, path: string): boolean {
  const pathname = (path.split(/[?#]/)[0] ?? '').replace(/(.)\/+$/, '$1')
  return allowedPaths(role).some((allowed) => matchesPattern(allowed, pathname))
}
