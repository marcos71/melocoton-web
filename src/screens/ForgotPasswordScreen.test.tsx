import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const accepted = () => new Response(null, { status: 202 })

describe('ForgotPasswordScreen', () => {
  it('CU01_showsTheConfirmationAfterAskingForTheLink', async () => {
    const fetchFn = stubApi({ 'POST /api/v1/auth/password-reset-requests': accepted })
    renderApp({ role: null, path: '/forgot-password' })

    expect(
      screen.getByText('Te enviamos un enlace para definir una contraseña nueva.'),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si el email corresponde a una cuenta activa, te llegará un enlace para definir una contraseña nueva. El enlace vence en una hora.',
    )
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a ingresar' })).toHaveAttribute(
      'href',
      '/login',
    )
    const [request] = requestsTo(fetchFn, 'POST /api/v1/auth/password-reset-requests')
    expect(await request?.clone().json()).toEqual({ email: 'ana@example.com' })
  })

  it('CU01_requiresTheEmail', async () => {
    const fetchFn = stubApi({})
    renderApp({ role: null, path: '/forgot-password' })

    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(screen.getByText('Ingresá tu email.')).toBeInTheDocument()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('CU01_showsTheErrorAndKeepsTheFormWhenTheApiRefuses', async () => {
    stubApi({
      'POST /api/v1/auth/password-reset-requests': () =>
        errorResponse(429, 'too_many_requests', 'Hiciste demasiados pedidos. Esperá un minuto.'),
    })
    renderApp({ role: null, path: '/forgot-password' })

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hiciste demasiados pedidos. Esperá un minuto.',
    )
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com')
    expect(screen.getByRole('link', { name: 'Volver a ingresar' })).toBeInTheDocument()
  })

  it('CU01_showsAnErrorWhenTheApiCannotBeReached', async () => {
    stubApi({
      'POST /api/v1/auth/password-reset-requests': () => Promise.reject(new TypeError('offline')),
    })
    renderApp({ role: null, path: '/forgot-password' })

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con la API.')
  })

  it('anAuthenticatedPersonVisitingItGoesHome', async () => {
    renderApp({ role: 'STUDENT', path: '/forgot-password' })

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })
})
