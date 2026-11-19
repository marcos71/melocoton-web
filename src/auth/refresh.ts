import { refreshToken } from '../api/auth'
import { tokenStore } from './tokenStore'

/** DI-28: the token is renewed when it was last obtained more than a day ago. */
export const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000

let inFlight: Promise<void> | null = null

/**
 * Renews the token when it is due. Never runs twice at once. A 401 ends the
 * session through the client middleware; any other failure is ignored and
 * tried again the next time.
 */
export function refreshIfDue(now: () => Date = () => new Date()): Promise<void> {
  if (inFlight) return inFlight
  const current = tokenStore.get()
  if (!current) return Promise.resolve()
  const age = now().getTime() - Date.parse(current.refreshedAt)
  if (!Number.isNaN(age) && age <= REFRESH_AFTER_MS) return Promise.resolve()

  inFlight = (async () => {
    try {
      const renewed = await refreshToken()
      // Do not resurrect a session that ended while the request was running.
      if (tokenStore.get()?.accessToken === current.accessToken) {
        tokenStore.save({
          accessToken: renewed.accessToken,
          expiresAt: renewed.expiresAt,
          refreshedAt: now().toISOString(),
        })
      }
    } catch {
      // See above.
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}
