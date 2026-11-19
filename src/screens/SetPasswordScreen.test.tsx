import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tokenStore } from '../auth/tokenStore'
import {
  errorResponse,
  jsonResponse,
  renderApp,
  requestsTo,
  seedSession,
  sessionUser,
  stubApi,
} from '../test/utils'

const noContent = () => new Response(null, { status: 204 })
const VALID = 'una-clave-larga-1'

async function fill(password: string, confirmation: string) {
  await userEvent.type(screen.getByLabelText('Contraseña nueva'), password)
  await userEvent.type(screen.getByLabelText('Repetí la contraseña'), confirmation)
  await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
}

describe('SetPasswordScreen', () => {
  it('CU01_sendsTheTokenFromTheFragmentAndShowsTheConfirmation', async () => {
    const fetchFn = stubApi({ 'POST /api/v1/auth/set-password': noContent })
    renderApp({ role: null, path: '/set-password#token=abc.123_x' })

    expect(screen.getByRole('heading', { name: 'Definí tu contraseña' })).toBeInTheDocument()
    expect(screen.getByText('Entre 10 y 128 caracteres.')).toBeInTheDocument()
    await fill(VALID, VALID)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Listo, tu contraseña quedó guardada.',
    )
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/login')
    const [request] = requestsTo(fetchFn, 'POST /api/v1/auth/set-password')
    expect(await request?.clone().json()).toEqual({ token: 'abc.123_x', newPassword: VALID })
    expect(request?.headers.has('Authorization')).toBe(false)
  })

  it('CU01_clearsTheLocalSessionOfThisDeviceOnSuccess', async () => {
    seedSession()
    stubApi({
      'GET /api/v1/auth/session': () => jsonResponse(200, { user: sessionUser('STUDENT') }),
      'POST /api/v1/auth/set-password': noContent,
    })
    renderApp({ role: null, path: '/set-password#token=abc' })
    expect(await screen.findByRole('heading', { name: 'Definí tu contraseña' })).toBeInTheDocument()

    await fill(VALID, VALID)

    expect(await screen.findByText('Listo, tu contraseña quedó guardada.')).toBeInTheDocument()
    expect(tokenStore.get()).toBeNull()
  })

  it('CU01_showsAnErrorStateWithoutAToken', () => {
    renderApp({ role: null, path: '/set-password' })

    expect(screen.getByRole('alert')).toHaveTextContent('El enlace no es válido. Pedí uno nuevo.')
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument()
  })

  it('CU01_requiresAtLeast10Characters', async () => {
    const fetchFn = stubApi({})
    renderApp({ role: null, path: '/set-password#token=abc' })

    await fill('corta', 'corta')

    const field = screen.getByLabelText('Contraseña nueva')
    expect(screen.getByText('La contraseña tiene que tener al menos 10 caracteres.')).toBeVisible()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(
      /Entre 10 y 128 caracteres\..*al menos 10 caracteres/,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('CU01_allowsAtMost128Characters', async () => {
    const fetchFn = stubApi({})
    renderApp({ role: null, path: '/set-password#token=abc' })
    const long = 'a'.repeat(129)

    await userEvent.type(screen.getByLabelText('Contraseña nueva'), long)
    await userEvent.type(screen.getByLabelText('Repetí la contraseña'), long)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(screen.getByText('La contraseña puede tener hasta 128 caracteres.')).toBeVisible()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('CU01_requiresBothPasswordsToMatch', async () => {
    const fetchFn = stubApi({})
    renderApp({ role: null, path: '/set-password#token=abc' })

    await fill(VALID, `${VALID}-otra`)

    expect(screen.getByText('Las contraseñas no coinciden.')).toBeVisible()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('CU01_anExpiredLinkShowsTheMessageAndALinkToAskForANewOne', async () => {
    stubApi({
      'POST /api/v1/auth/set-password': () =>
        errorResponse(400, 'link_expired', 'El enlace venció. Pedí uno nuevo.'),
    })
    renderApp({ role: null, path: '/set-password#token=abc' })

    await fill(VALID, VALID)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('El enlace venció. Pedí uno nuevo.')
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('CU01_otherErrorsShowTheMessageAndKeepTheForm', async () => {
    stubApi({
      'POST /api/v1/auth/set-password': () =>
        errorResponse(429, 'too_many_requests', 'Demasiados intentos. Esperá un minuto.'),
    })
    renderApp({ role: null, path: '/set-password#token=abc' })

    await fill(VALID, VALID)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos. Esperá un minuto.',
    )
    expect(screen.queryByRole('link', { name: 'Pedir un enlace nuevo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeEnabled()
  })
})
