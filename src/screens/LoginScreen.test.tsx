import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokenStore } from '../auth/tokenStore'
import {
  errorResponse,
  jsonResponse,
  renderApp,
  requestsTo,
  sessionUser,
  stubApi,
} from '../test/utils'

const loginOk = (role: 'STUDENT' | 'LEAD_TEACHER' | 'ASSISTANT_TEACHER') => () =>
  jsonResponse(200, {
    accessToken: 'login-token',
    expiresAt: '2030-01-01T00:00:00Z',
    user: sessionUser(role),
  })

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Contraseña'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

describe('LoginScreen', () => {
  it('RF01_logsInAndOpensTheRoleHome', async () => {
    const fetchFn = stubApi({ 'POST /api/v1/auth/login': loginOk('LEAD_TEACHER') })
    renderApp({ role: null, path: '/login' })

    await fillAndSubmit('ana@example.com', 'una-clave-larga')

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
    expect(tokenStore.get()?.accessToken).toBe('login-token')
    expect(tokenStore.get()?.refreshedAt).toBeTruthy()
    const [request] = requestsTo(fetchFn, 'POST /api/v1/auth/login')
    expect(await request?.clone().json()).toEqual({
      email: 'ana@example.com',
      password: 'una-clave-larga',
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/today')
  })

  it('RF01_invalidCredentialsShowTheApiMessageAndAllowRetrying', async () => {
    let attempts = 0
    stubApi({
      'POST /api/v1/auth/login': () =>
        ++attempts === 1
          ? errorResponse(401, 'invalid_credentials', 'El email o la contraseña no son correctos.')
          : loginOk('STUDENT')(),
    })
    renderApp({ role: null, path: '/login' })

    await fillAndSubmit('ana@example.com', 'mala-clave-1')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El email o la contraseña no son correctos.',
    )
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(tokenStore.get()).toBeNull()

    await userEvent.type(screen.getByLabelText('Contraseña'), 'buena-clave-1')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('RF01_requiresEmailAndPasswordBeforeCallingTheApi', async () => {
    const fetchFn = stubApi({})
    renderApp({ role: null, path: '/login' })

    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(screen.getByText('Ingresá tu email.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá tu contraseña.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('showsThePendingTextWhileLoggingIn', async () => {
    stubApi({ 'POST /api/v1/auth/login': () => new Promise<Response>(() => {}) })
    renderApp({ role: null, path: '/login' })

    await fillAndSubmit('ana@example.com', 'una-clave-larga')

    expect(await screen.findByRole('button', { name: 'Ingresando…' })).toBeDisabled()
  })

  it('showsAnErrorWhenTheApiCannotBeReached', async () => {
    stubApi({ 'POST /api/v1/auth/login': () => Promise.reject(new TypeError('offline')) })
    renderApp({ role: null, path: '/login' })

    await fillAndSubmit('ana@example.com', 'una-clave-larga')

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con la API.')
  })

  it('CU01_returnsToTheRememberedPathAfterLoggingIn', async () => {
    stubApi({
      'POST /api/v1/auth/login': loginOk('LEAD_TEACHER'),
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
    })
    renderApp({ role: null, path: '/pieces' })
    expect(screen.getByTestId('location')).toHaveTextContent('/login')

    await fillAndSubmit('ana@example.com', 'una-clave-larga')

    expect(await screen.findByRole('heading', { name: 'Piezas' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces')
  })

  it('RF02_goesToTheHomeWhenTheRememberedPathIsNotForTheRole', async () => {
    stubApi({ 'POST /api/v1/auth/login': loginOk('STUDENT') })
    renderApp({ role: null, path: '/slots' })

    await fillAndSubmit('ana@example.com', 'una-clave-larga')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/home')
  })

  it('RF01_anAuthenticatedPersonVisitingLoginGoesHome', async () => {
    renderApp({ role: 'ASSISTANT_TEACHER', path: '/login' })

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/today')
  })

  it('linksToPasswordRecoveryAndTheConnectionCheck', () => {
    renderApp({ role: null, path: '/login' })

    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    expect(screen.getByRole('link', { name: 'Estado de la conexión' })).toHaveAttribute(
      'href',
      '/health',
    )
  })
})
