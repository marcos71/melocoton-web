import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const CREATE = 'POST /api/v1/assistant-teachers'
const created = {
  id: 9,
  name: 'Lucía Gómez',
  email: 'lucia@example.com',
  phone: '11 5555-0001',
  active: true,
}

async function fill(name = ' Lucía Gómez ', email = ' lucia@example.com ', phone = '11 5555-0001') {
  if (name) await userEvent.type(await screen.findByLabelText('Nombre'), name)
  if (email) await userEvent.type(screen.getByLabelText('Email'), email)
  if (phone) await userEvent.type(screen.getByLabelText('Teléfono'), phone)
  await userEvent.click(screen.getByRole('button', { name: 'Crear y enviar invitación' }))
}

describe('NewAssistantTeacherScreen', () => {
  it('RF53_createsTheTeacherWithTrimmedValuesAndGoesBackToTheList', async () => {
    const fetchFn = stubApi({
      [CREATE]: () => jsonResponse(201, created),
      'GET /api/v1/assistant-teachers': () => jsonResponse(200, [created]),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers/new' })

    expect(
      await screen.findByText(
        'Le vamos a enviar un email con un enlace para definir su contraseña. El enlace vence en 7 días.',
      ),
    ).toBeInTheDocument()
    await fill()

    expect(await screen.findByRole('heading', { name: 'Docentes secundarios' })).toBeInTheDocument()
    expect(screen.getByText('Le enviamos la invitación a lucia@example.com.')).toBeInTheDocument()
    const [request] = requestsTo(fetchFn, CREATE)
    expect(await request?.clone().json()).toEqual({
      name: 'Lucía Gómez',
      email: 'lucia@example.com',
      phone: '11 5555-0001',
    })
    expect(await screen.findByRole('heading', { name: 'Lucía Gómez' })).toBeInTheDocument()
  })

  it('RF53_requiresNameEmailAndPhone', async () => {
    const fetchFn = stubApi({})
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers/new' })
    await screen.findByLabelText('Nombre')

    await userEvent.click(screen.getByRole('button', { name: 'Crear y enviar invitación' }))

    expect(screen.getByText('Ingresá el nombre.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá el email.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá el teléfono.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Ingresá el nombre.')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('RF53_rejectsAnInvalidEmail', async () => {
    const fetchFn = stubApi({})
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers/new' })

    await fill('Lucía', 'no-es-un-email', '1155550001')

    expect(screen.getByText('Ingresá un email válido.')).toBeInTheDocument()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('RF53_aDuplicateEmailShowsTheApiMessageOnTheEmailField', async () => {
    stubApi({
      [CREATE]: () =>
        errorResponse(409, 'email_already_used', 'Ese email ya pertenece a otra cuenta.'),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers/new' })

    await fill()

    const email = screen.getByLabelText('Email')
    expect(await screen.findByText('Ese email ya pertenece a otra cuenta.')).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Ese email ya pertenece a otra cuenta.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('RF53_otherErrorsShowAnAlertAndKeepTheForm', async () => {
    stubApi({ [CREATE]: () => errorResponse(500, 'internal_error', 'Algo salió mal.') })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers/new' })

    await fill()

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal.')
    expect(screen.getByLabelText('Nombre')).toHaveValue(' Lucía Gómez ')
  })

  it('RF53_aFailedCreationIsNotRetried', async () => {
    const fetchFn = stubApi({ [CREATE]: () => Promise.reject(new TypeError('offline')) })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers/new' })

    await fill()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con la API.')
    expect(requestsTo(fetchFn, CREATE)).toHaveLength(1)
  })

  it('RF53_cancelGoesBackToTheList', async () => {
    stubApi({ 'GET /api/v1/assistant-teachers': () => jsonResponse(200, []) })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers/new' })

    await userEvent.click(await screen.findByRole('link', { name: 'Cancelar' }))

    expect(await screen.findByRole('heading', { name: 'Docentes secundarios' })).toBeInTheDocument()
  })
})
