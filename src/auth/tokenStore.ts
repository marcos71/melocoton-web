import { z } from 'zod'

export const SESSION_STORAGE_KEY = 'melocoton.session'

const storedSessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.string(),
  /** ISO time when this device last obtained the token (login or refresh). */
  refreshedAt: z.string(),
})

export type StoredSession = z.infer<typeof storedSessionSchema>

/**
 * Why the token was dropped:
 * - expired: the API rejected it (expired, inactive account, password changed) (CU-01 4a);
 * - logout: the person logged out;
 * - password-changed: the person set a new password, which closes every session.
 */
export type ClearReason = 'expired' | 'logout' | 'password-changed'

type Listener = (reason: ClearReason) => void

// If localStorage is unavailable or full the app keeps working for this tab
// with the token held in memory.
let memory: StoredSession | null = null
let memoryOnly = false
const listeners = new Set<Listener>()

function read(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (raw === null) return memoryOnly ? memory : null
    const parsed = storedSessionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return memory
  }
}

function save(session: StoredSession): void {
  memory = session
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    memoryOnly = false
  } catch {
    memoryOnly = true
  }
}

function clear(reason: ClearReason = 'logout'): void {
  memory = null
  memoryOnly = false
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Nothing else to do: the in-memory copy is already gone.
  }
  for (const listener of [...listeners]) listener(reason)
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The one place that knows where the session token lives. */
export const tokenStore = { get: read, save, clear, subscribe }
