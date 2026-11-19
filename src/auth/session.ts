import { createContext, useContext } from 'react'
import type { ApiError } from '../api/errors'
import type { SessionUser } from './role'

/** `loading` and `error` only happen while a stored token is being verified (CU-01). */
export type SessionStatus = 'loading' | 'anonymous' | 'authenticated' | 'error'

/** Informative messages the login screen shows after the session ended. */
export type SessionNotice = 'expired' | 'loggedOut'

export const NOTICE_TEXT: Record<SessionNotice, string> = {
  expired: 'Tu sesión venció. Pasó un tiempo sin uso. Ingresá de nuevo para seguir.',
  loggedOut: 'Cerraste la sesión.',
}

export type SessionState = {
  status: SessionStatus
  /** Non-null only when `status` is `authenticated`. */
  user: SessionUser | null
  /** Why the stored token could not be verified; non-null only when `status` is `error`. */
  error: ApiError | null
  notice: SessionNotice | null
  logIn: (email: string, password: string) => Promise<void>
  logOut: () => void
  /** Verifies the stored token again after an `error`. */
  retry: () => void
}

export const SessionContext = createContext<SessionState | null>(null)

export function useSession(): SessionState {
  const state = useContext(SessionContext)
  if (!state) throw new Error('useSession must be used inside a SessionProvider')
  return state
}
