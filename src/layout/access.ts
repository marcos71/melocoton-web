import type { Role } from '../auth/role'
import { TABS_BY_ROLE } from './tabs'

/** Screens only the lead teacher reaches (RF-02), under the account menu's "Ajustes". */
export const ADMIN_PATHS = [
  '/admin',
  '/admin/assistant-teachers',
  '/admin/assistant-teachers/new',
] as const

export function homePath(role: Role): string {
  return TABS_BY_ROLE[role][0].path
}

export function allowedPaths(role: Role): string[] {
  const tabs = TABS_BY_ROLE[role].map((tab) => tab.path)
  return role === 'LEAD_TEACHER' ? [...tabs, ...ADMIN_PATHS] : tabs
}

/** Whether the role may open this path (query and fragment are ignored). */
export function canUsePath(role: Role, path: string): boolean {
  const pathname = (path.split(/[?#]/)[0] ?? '').replace(/(.)\/+$/, '$1')
  return allowedPaths(role).includes(pathname)
}
