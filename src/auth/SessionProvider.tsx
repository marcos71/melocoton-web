import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchSession, logIn as requestLogin } from '../api/auth'
import { ApiError, UNEXPECTED_RESPONSE } from '../api/errors'
import { QUERY_RETRIES } from '../app/queryClient'
import { refreshIfDue } from './refresh'
import type { SessionUser } from './role'
import { SessionContext, type SessionNotice, type SessionState } from './session'
import { tokenStore } from './tokenStore'

type Phase =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'error'; error: ApiError }

const defaultNow = () => new Date()

/**
 * Holds who is logged in (RF-01, RF-02, DI-28). On start it checks the stored
 * token with GET /auth/session; a network failure keeps the token and offers
 * to retry, a 401 ends the session. It always renders its children: while the
 * check runs (or failed) the route guards decide what each screen shows, so the
 * public screens never wait for it.
 */
export function SessionProvider({
  children,
  now = defaultNow,
}: {
  children: ReactNode
  /** Injectable so tests control the time. */
  now?: () => Date
}) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>(() =>
    tokenStore.get() ? { status: 'loading' } : { status: 'anonymous' },
  )
  const [notice, setNotice] = useState<SessionNotice | null>(null)
  const [attempt, setAttempt] = useState(0)

  // The token was dropped from outside React (a 401 in any call, a new password).
  useEffect(
    () =>
      tokenStore.subscribe((reason) => {
        if (reason === 'logout') return
        queryClient.clear()
        setNotice(reason === 'expired' ? 'expired' : null)
        setPhase({ status: 'anonymous' })
      }),
    [queryClient],
  )

  // Check the stored token on start (and on every "Reintentar").
  useEffect(() => {
    if (!tokenStore.get()) return
    let cancelled = false
    queryClient
      .fetchQuery({
        queryKey: ['session'],
        queryFn: () => fetchSession(),
        staleTime: 0,
        // A read is retried once, but a 401 is an answer, not a failure.
        retry: (count, error) =>
          count < QUERY_RETRIES && !(error instanceof ApiError && error.status === 401),
      })
      .then((response) => {
        if (!cancelled) setPhase({ status: 'authenticated', user: response.user })
      })
      .catch((error: unknown) => {
        // No token left means the session already ended (a 401 clears it and the
        // subscription above moved to the login), which also cancels this query.
        if (cancelled || !tokenStore.get()) return
        setPhase({
          status: 'error',
          error:
            error instanceof ApiError
              ? error
              : new ApiError(0, UNEXPECTED_RESPONSE, 'La API respondió algo inesperado.'),
        })
      })
    return () => {
      cancelled = true
    }
  }, [attempt, queryClient])

  // DI-28: renew the token when the app opens and when it comes back to the foreground.
  const authenticated = phase.status === 'authenticated'
  useEffect(() => {
    if (!authenticated) return
    void refreshIfDue(now)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshIfDue(now)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [authenticated, now])

  const logIn = useCallback(
    async (email: string, password: string) => {
      const response = await requestLogin(email, password)
      tokenStore.save({
        accessToken: response.accessToken,
        expiresAt: response.expiresAt,
        refreshedAt: now().toISOString(),
      })
      setNotice(null)
      setPhase({ status: 'authenticated', user: response.user })
    },
    [now],
  )

  const logOut = useCallback(() => {
    // DI-28: logging out just discards the token on this device.
    tokenStore.clear('logout')
    queryClient.clear()
    setNotice('loggedOut')
    setPhase({ status: 'anonymous' })
  }, [queryClient])

  const retry = useCallback(() => {
    setPhase({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const value = useMemo<SessionState>(
    () => ({
      status: phase.status,
      user: phase.status === 'authenticated' ? phase.user : null,
      error: phase.status === 'error' ? phase.error : null,
      notice,
      logIn,
      logOut,
      retry,
    }),
    [phase, notice, logIn, logOut, retry],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
