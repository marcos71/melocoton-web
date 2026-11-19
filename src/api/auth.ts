import { apiClient, type ApiClient } from './client'
import { callApi } from './errors'
import type { components } from './schema'

export type LoginResponse = components['schemas']['LoginResponse']
export type TokenResponse = components['schemas']['TokenResponse']
export type SessionResponse = components['schemas']['SessionResponse']

/** POST /api/v1/auth/login. A wrong email or password is always 401 invalid_credentials (DI-30). */
export function logIn(
  email: string,
  password: string,
  client: ApiClient = apiClient,
): Promise<LoginResponse> {
  return callApi(() => client.POST('/api/v1/auth/login', { body: { email, password } }))
}

/** POST /api/v1/auth/refresh (with the current token). */
export function refreshToken(client: ApiClient = apiClient): Promise<TokenResponse> {
  return callApi(() => client.POST('/api/v1/auth/refresh'))
}

/** GET /api/v1/auth/session: who is logged in. */
export function fetchSession(client: ApiClient = apiClient): Promise<SessionResponse> {
  return callApi(() => client.GET('/api/v1/auth/session'))
}

/** POST /api/v1/auth/password-reset-requests. Always 202, whether or not the email exists (DI-33). */
export function requestPasswordReset(email: string, client: ApiClient = apiClient): Promise<void> {
  return callApi(() => client.POST('/api/v1/auth/password-reset-requests', { body: { email } }))
}

/** POST /api/v1/auth/set-password: invitation or reset link (CU-01 2c, 2e). */
export function setPassword(
  token: string,
  newPassword: string,
  client: ApiClient = apiClient,
): Promise<void> {
  return callApi(() => client.POST('/api/v1/auth/set-password', { body: { token, newPassword } }))
}
