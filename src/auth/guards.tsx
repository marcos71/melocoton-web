import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { canUsePath, homePath } from '../layout/access'
import screenStyles from '../screens/Screen.module.css'
import { useSession } from './session'

type LoginState = { from?: string } | null

function rememberedPath(state: unknown): string | null {
  const from = (state as LoginState)?.from
  return typeof from === 'string' ? from : null
}

function LoadingSession() {
  return (
    <div className={screenStyles.fullScreen}>
      <p role="status">Cargando…</p>
    </div>
  )
}

function SessionCheckFailed() {
  const { error, retry } = useSession()
  return (
    <div className={screenStyles.fullScreen}>
      <div role="alert" className={screenStyles.alert}>
        <p className={screenStyles.alertTitle}>No se pudo verificar tu sesión.</p>
        <p>{error?.message}</p>
      </div>
      <button type="button" className={screenStyles.button} onClick={retry}>
        Reintentar
      </button>
    </div>
  )
}

/**
 * Everything but the public screens needs a session (RF-01); anonymous goes to the login.
 * While the stored token is being verified it shows the wait, or the failure
 * with a retry (CU-01); public screens are not wrapped, so they never wait.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status, notice } = useSession()
  const location = useLocation()
  if (status === 'loading') return <LoadingSession />
  if (status === 'error') return <SessionCheckFailed />
  if (status === 'authenticated') return children
  // After a deliberate logout the next person must not land on the last path.
  const from = notice === 'loggedOut' ? undefined : location.pathname + location.search
  return <Navigate to="/login" replace state={{ from }} />
}

/**
 * Login and password recovery are for people without a session: with one they
 * go to the remembered path (if their role may use it) or to the role's home.
 * While the token is being verified it waits, so the form does not flash for
 * someone about to be redirected; if the check failed the form is shown.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status, user } = useSession()
  const location = useLocation()
  if (status === 'loading') return <LoadingSession />
  if (!user) return children
  const from = rememberedPath(location.state)
  return <Navigate to={from && canUsePath(user.role, from) ? from : homePath(user.role)} replace />
}
