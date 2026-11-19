import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  errorResponse,
  jsonResponse,
  renderApp,
  requestsTo,
  stubApi,
} from '../test/utils'

const LIST = 'GET /api/v1/assistant-teachers'
const CREATE = 'POST /api/v1/assistant-teachers'
const DEACTIVATE_7 = 'POST /api/v1/assistant-teachers/7/deactivate'

const lucia = { id: 7, name: 'Lucía Gómez', email: 'lucia@example.com', phone: '11 5555-0001', active: true }
const bruno = { id: 8, name: 'Bruno Díaz', email: 'bruno@example.com', phone: '11 5555-0002', active: false }

function activeParam(request: Request): string | null {
  return new URL(request.url).searchParams.get('active')
}

describe('AssistantTeachersScreen', () => {
  it('RF53_showsALoadingTextWhileLoading', async () => {
    stubApi({ [LIST]: () => new Promise<Response>(() => {}) })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers' })

    expect(await screen.findByText('Cargando docentes…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Docentes secundarios' })).toBeInTheDocument()
  })

  it('RF53_listsTheActiveTeachersByDefaultWithTheirStatusAsText', async () => {
    const fetchFn = stubApi({ [LIST]: () => jsonResponse(200, [lucia]) })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers' })

    expect(await screen.findByRole('heading', { name: 'Lucía Gómez' })).toBeInTheDocument()
    expect(screen.getByText('lucia@example.com')).toBeInTheDocument()
    expect(screen.getByText('11 5555-0001')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activos' })).toHaveAttribute('aria-pressed', 'true')
    expect(activeParam(requestsTo(fetchFn, LIST)[0] as Request)).toBe('true')
    expect(screen.getByRole('link', { name: /Ajustes/ })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'Agregar docente' })).toHaveAttribute(
      'href',
      '/admin/assistant-teachers/new',
    )
  })

  it('RF53_showsInactiveTeachersWithoutADeactivateButton', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, [bruno]) })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers?status=all' })

    expect(await screen.findByText('Inactivo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument()
  })

  it.each([
    ['active', 'No hay docentes secundarios activos.'],
    ['inactive', 'No hay docentes secundarios inactivos.'],
    ['all', 'Todavía no hay docentes secundarios.'],
  ])('RF53_showsTheEmptyTextForTheFilter_%s', async (status, text) => {
    stubApi({ [LIST]: () => jsonResponse(200, []) })
    renderApp({ role: 'LEAD_TEACHER', path: `/admin/assistant-teachers?status=${status}` })

    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('RF53_changingTheFilterChangesTheRequestAndTheUrl', async () => {
    const fetchFn = stubApi({
      [LIST]: (request) => jsonResponse(200, activeParam(request) === null ? [lucia, bruno] : [lucia]),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers' })
    await screen.findByRole('heading', { name: 'Lucía Gómez' })

    await userEvent.click(screen.getByRole('button', { name: 'Todos' }))

    expect(await screen.findByRole('heading', { name: 'Bruno Díaz' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/assistant-teachers?status=all',
    )
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(requestsTo(fetchFn, LIST).map(activeParam)).toEqual(['true', null])

    await userEvent.click(screen.getByRole('button', { name: 'Inactivos' }))

    await screen.findByRole('button', { name: 'Inactivos', pressed: true })
    expect(screen.getByTestId('location')).toHaveTextContent('status=inactive')
    expect(requestsTo(fetchFn, LIST).map(activeParam)).toEqual(['true', null, 'false'])
  })

  it('RF53_showsTheErrorAfterRetryingTheReadOnceAndRecoversOnRetry', async () => {
    let up = false
    const fetchFn = stubApi({
      [LIST]: () =>
        up ? jsonResponse(200, [lucia]) : errorResponse(500, 'internal_error', 'Algo salió mal.'),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers' })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se pudo cargar la lista.')
    expect(alert).toHaveTextContent('Algo salió mal.')
    expect(requestsTo(fetchFn, LIST)).toHaveLength(2)

    up = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { name: 'Lucía Gómez' })).toBeInTheDocument()
  })

  it('RF53_cancelingTheDeactivationSendsNothing', async () => {
    const fetchFn = stubApi({ [LIST]: () => jsonResponse(200, [lucia]) })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers' })

    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar a Lucía Gómez' }))

    const dialog = screen.getByRole('alertdialog', { name: '¿Desactivar a Lucía Gómez?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription(
      'No va a poder iniciar sesión. En esta versión no se puede reactivar.',
    )
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(requestsTo(fetchFn, DEACTIVATE_7)).toHaveLength(0)
  })

  it('RF53_escapeClosesTheDeactivationDialog', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, [lucia]) })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers' })
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar a Lucía Gómez' }))

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('RF53_confirmingDeactivatesShowsTheSuccessAndRefetchesTheList', async () => {
    let deactivated = false
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, deactivated ? [] : [lucia]),
      [DEACTIVATE_7]: () => {
        deactivated = true
        return jsonResponse(200, { ...lucia, active: false })
      },
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers' })
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar a Lucía Gómez' }))

    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Desactivar' }),
    )

    expect(await screen.findByText('Lucía Gómez quedó desactivado.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Lucía Gómez quedó desactivado.')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await screen.findByText('No hay docentes secundarios activos.')).toBeInTheDocument()
    expect(requestsTo(fetchFn, DEACTIVATE_7)).toHaveLength(1)
    expect(requestsTo(fetchFn, LIST)).toHaveLength(2)
  })

  it('RF53_aConflictOnDeactivationShowsTheApiMessageAndRefetches', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, [lucia]),
      [DEACTIVATE_7]: () =>
        errorResponse(409, 'status_conflict', 'Esa cuenta ya estaba desactivada.'),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers' })
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar a Lucía Gómez' }))

    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Desactivar' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Esa cuenta ya estaba desactivada.')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(requestsTo(fetchFn, DEACTIVATE_7)).toHaveLength(1)
    await vi.waitFor(() => expect(requestsTo(fetchFn, LIST)).toHaveLength(2))
  })

  it('RF53_aFailedDeactivationIsNotRetried', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, [lucia]),
      [DEACTIVATE_7]: () => Promise.reject(new TypeError('offline')),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers' })
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar a Lucía Gómez' }))

    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Desactivar' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con la API.')
    expect(requestsTo(fetchFn, DEACTIVATE_7)).toHaveLength(1)
  })

  it('RF53_showsTheInvitationMessageSentByTheCreationScreen', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, [lucia]),
      [CREATE]: () => jsonResponse(201, lucia),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/admin/assistant-teachers/new' })

    await userEvent.type(await screen.findByLabelText('Nombre'), 'Lucía Gómez')
    await userEvent.type(screen.getByLabelText('Email'), 'lucia@example.com')
    await userEvent.type(screen.getByLabelText('Teléfono'), '11 5555-0001')
    await userEvent.click(screen.getByRole('button', { name: 'Crear y enviar invitación' }))

    expect(
      await screen.findByText('Le enviamos la invitación a lucia@example.com.'),
    ).toHaveAttribute('role', 'status')
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/assistant-teachers')
  })
})
