import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mondayMorning, slotItem } from '../test/slots'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const SLOTS = 'GET /api/v1/slots'
const LESSONS = 'GET /api/v1/lessons'
const STUDENTS = 'GET /api/v1/students'
const SLOT = 'GET /api/v1/slots/3'
const PATCH = 'PATCH /api/v1/slots/3'

const editable = slotItem({ id: 3, dayOfWeek: 2, startTime: '18:00', endTime: '20:00', scheduleEditable: true })

const baseRoutes = {
  [SLOT]: () => jsonResponse(200, editable),
  [SLOTS]: () => jsonResponse(200, [mondayMorning, editable]),
  [LESSONS]: () => jsonResponse(200, []),
}

function renderEdit(path = '/slots/3/edit') {
  return renderApp({ role: 'LEAD_TEACHER', path })
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

describe('EditSlotScreen', () => {
  it('DI63_showsTheFormWithTheValuesOfTheSlotAndTheExplanation', async () => {
    stubApi(baseRoutes)
    renderEdit()

    const heading = await screen.findByRole('heading', { name: 'Corregir horario' })
    expect(heading).toHaveFocus()
    expect(
      screen.getByText('Como el turno todavía no tiene reservas, podés corregir el día y el horario.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Día')).toHaveValue('2')
    expect(screen.getByLabelText('Hora de inicio')).toHaveValue('18:00')
    expect(screen.getByLabelText('Hora de fin')).toHaveValue('20:00')
    // The day is already chosen: there is no empty option.
    expect(screen.queryByRole('option', { name: 'Elegí el día' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/slots')
    expect(screen.getByRole('link', { name: 'Volver a Turnos' })).toHaveAttribute('href', '/slots')
  })

  it('DI63_timesWithSecondsAreShownAsHoursAndMinutes', async () => {
    stubApi({
      ...baseRoutes,
      [SLOT]: () => jsonResponse(200, { ...editable, startTime: '18:00:00', endTime: '20:00:00' }),
    })
    renderEdit()

    expect(await screen.findByLabelText('Hora de inicio')).toHaveValue('18:00')
    expect(screen.getByLabelText('Hora de fin')).toHaveValue('20:00')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('DI63_withoutChangesTheSaveButtonIsUnavailableWithItsReason', async () => {
    const fetchFn = stubApi(baseRoutes)
    renderEdit()

    const button = await screen.findByRole('button', { name: 'Guardar cambios' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('No hay cambios para guardar.')
    await userEvent.click(button)
    expect(requestsTo(fetchFn, PATCH)).toHaveLength(0)

    await userEvent.selectOptions(screen.getByLabelText('Día'), '3')

    expect(screen.getByRole('button', { name: 'Guardar cambios' })).not.toHaveAttribute('aria-disabled')
  })

  it('DI63_theOwnSlotDoesNotCountAsAnOverlapButOthersDoAndTheDayHintLeavesItOut', async () => {
    const fetchFn = stubApi(baseRoutes)
    renderEdit()
    await screen.findByLabelText('Día')

    expect(await screen.findByText('Ese día no hay turnos.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Hora de inicio'))
    await userEvent.type(screen.getByLabelText('Hora de inicio'), '19:00')
    await userEvent.selectOptions(screen.getByLabelText('Día'), '1')
    expect(screen.getByText('Ese día ya hay: 10:00 a 12:00.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Hora de inicio'))
    await userEvent.type(screen.getByLabelText('Hora de inicio'), '11:00')

    await save()

    expect(await screen.findByText('Se superpone con el turno del lunes 10:00 a 12:00.')).toBeInTheDocument()
    expect(requestsTo(fetchFn, PATCH)).toHaveLength(0)
  })

  it('DI63_savingSendsOnlyTheFieldsThatChangedGoesToTheListWithANoticeAndRefreshesWhatShowsTheSlot', async () => {
    const fetchFn = stubApi({
      ...baseRoutes,
      [STUDENTS]: () => jsonResponse(200, []),
      [PATCH]: () => jsonResponse(200, { ...editable, dayOfWeek: 3 }),
    })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    expect(await screen.findByText('El turno ahora es el miércoles 18:00 a 20:00.')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/slots$/)
    expect(await requestsTo(fetchFn, PATCH)[0]?.clone().json()).toEqual({ dayOfWeek: 3 })
    await waitFor(() => expect(requestsTo(fetchFn, LESSONS).length).toBeGreaterThanOrEqual(1))
  })

  it('DI63_changingTheTimesSendsOnlyTheTimes', async () => {
    const fetchFn = stubApi({
      ...baseRoutes,
      [PATCH]: () => jsonResponse(200, { ...editable, startTime: '17:00' }),
    })
    renderEdit()
    const start = await screen.findByLabelText('Hora de inicio')
    await userEvent.clear(start)
    await userEvent.type(start, '17:00')

    await save()

    await screen.findByText('El turno ahora es el martes 17:00 a 20:00.')
    expect(await requestsTo(fetchFn, PATCH)[0]?.clone().json()).toEqual({ startTime: '17:00' })
  })

  it('DI63_theButtonSaysGuardandoWhileSending', async () => {
    stubApi({ ...baseRoutes, [PATCH]: () => new Promise<Response>(() => {}) })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled()
  })

  it('DI63_aSlotWithBookingsHasNoFormAndSaysWhy', async () => {
    stubApi({ ...baseRoutes, [SLOT]: () => jsonResponse(200, { ...editable, scheduleEditable: false }) })
    renderEdit()

    expect(
      await screen.findByText('Este turno ya tiene reservas: el día y el horario no se pueden cambiar.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Día')).not.toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver a Turnos' })).toHaveAttribute('href', '/slots')
  })

  it('DI63_slot_has_bookingsFromTheApiSwitchesToTheNoEditableStateAndRefreshesTheSlots', async () => {
    const fetchFn = stubApi({
      ...baseRoutes,
      [PATCH]: () => errorResponse(409, 'slot_has_bookings', 'Tiene reservas.'),
    })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    expect(
      await screen.findByText('Este turno ya tiene reservas: el día y el horario no se pueden cambiar.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Día')).not.toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchFn, SLOTS).length).toBeGreaterThanOrEqual(2))
  })

  it('DI65_anInactiveSlotHasNoFormAndSaysItIsDeactivated', async () => {
    stubApi({ ...baseRoutes, [SLOT]: () => jsonResponse(200, { ...editable, active: false }) })
    renderEdit()

    expect(await screen.findByText('Este turno está desactivado: no se puede editar.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Día')).not.toBeInTheDocument()
  })

  it('DI65_status_conflictFromTheApiSwitchesToTheInactiveState', async () => {
    stubApi({ ...baseRoutes, [PATCH]: () => errorResponse(409, 'status_conflict', 'Inactivo.') })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    expect(await screen.findByText('Este turno está desactivado: no se puede editar.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Día')).not.toBeInTheDocument()
  })

  it('DI25_aSlotOverlapFromTheApiShowsUnderTheEndTime', async () => {
    stubApi({
      ...baseRoutes,
      [SLOTS]: () => jsonResponse(200, [editable]),
      [PATCH]: () =>
        jsonResponse(409, {
          error: {
            code: 'slot_overlap',
            message: 'Se superpone.',
            details: { slotId: 2, dayOfWeek: 3, startTime: '18:00', endTime: '20:00' },
          },
        }),
    })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    expect(await screen.findByText('Se superpone con el turno del miércoles 18:00 a 20:00.')).toBeInTheDocument()
    expect(screen.getByLabelText('Hora de fin')).toHaveFocus()
  })

  it('DI63_aNotFoundFromTheApiShowsTheMissingSlotScreen', async () => {
    stubApi({ ...baseRoutes, [PATCH]: () => errorResponse(404, 'not_found', 'No existe.') })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: No encontramos este turno.')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('DI63_aValidationErrorShowsTheApiMessageInTheErrorBlock', async () => {
    stubApi({ ...baseRoutes, [PATCH]: () => errorResponse(400, 'validation_error', 'Horario inválido.') })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Horario inválido.')
  })

  it('DI63_aTimeoutTellsToCheckTheList', async () => {
    stubApi({ ...baseRoutes, [PATCH]: () => Promise.reject(new DOMException('slow', 'TimeoutError')) })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La API tardó demasiado. No sabemos si se guardó: revisá la lista de turnos antes de intentar de nuevo.',
    )
  })

  it('DI63_aMissingSlotShowsNotFoundWithoutRetryAndWithoutRetrying', async () => {
    const fetchFn = stubApi({ ...baseRoutes, 'GET /api/v1/slots/99': () => errorResponse(404, 'not_found', 'x') })
    renderEdit('/slots/99/edit')

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: No encontramos este turno.')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver a Turnos' })).toBeInTheDocument()
    expect(requestsTo(fetchFn, 'GET /api/v1/slots/99')).toHaveLength(1)
  })

  it('DI63_aNonNumericIdShowsNotFoundWithoutAnyRequest', async () => {
    const fetchFn = stubApi(baseRoutes)
    renderEdit('/slots/abc/edit')

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: No encontramos este turno.')
    expect(requestsTo(fetchFn, SLOT)).toHaveLength(0)
  })

  it('DI63_aFailedReadShowsTheErrorWithRetry', async () => {
    let up = false
    const fetchFn = stubApi({
      ...baseRoutes,
      [SLOT]: () => (up ? jsonResponse(200, editable) : errorResponse(500, 'internal_error', 'x')),
    })
    renderEdit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: No se pudo cargar el turno.')
    expect(requestsTo(fetchFn, SLOT)).toHaveLength(2)

    up = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByLabelText('Día')).toHaveValue('2')
  })

  it('DI63_showsALoadingTextWhileTheSlotLoads', async () => {
    stubApi({ ...baseRoutes, [SLOT]: () => new Promise<Response>(() => {}) })
    renderEdit()

    expect(await screen.findByText('Cargando turno…')).toHaveAttribute('role', 'status')
  })

  it('DI63_theListOfSlotsAlreadyReadStandsInWhileTheSlotLoads', async () => {
    stubApi({ ...baseRoutes, [SLOT]: () => new Promise<Response>(() => {}) })
    renderApp({ role: 'LEAD_TEACHER', path: '/slots' })
    await screen.findByText('2 turnos')

    await userEvent.click(await screen.findByRole('link', { name: 'Corregir día u horario' }))

    expect(await screen.findByLabelText('Hora de inicio')).toHaveValue('18:00')
  })

  it('DI63_whenTheSlotReadDiffersFromTheListTheFormShowsTheReadValues', async () => {
    const fetchFn = stubApi({
      ...baseRoutes,
      [SLOT]: () => jsonResponse(200, { ...editable, startTime: '19:00', endTime: '21:00' }),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/slots' })
    await screen.findByText('2 turnos')

    await userEvent.click(await screen.findByRole('link', { name: 'Corregir día u horario' }))

    await waitFor(() => expect(screen.getByLabelText('Hora de inicio')).toHaveValue('19:00'))
    await waitFor(() => expect(screen.getByLabelText('Hora de fin')).toHaveValue('21:00'))
    const button = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('No hay cambios para guardar.')
    expect(requestsTo(fetchFn, PATCH)).toHaveLength(0)
  })

  it('DI63_aFailedRereadAfterASaveErrorKeepsTheFormTheTypedValuesAndTheError', async () => {
    let reads = 0
    const fetchFn = stubApi({
      ...baseRoutes,
      [SLOT]: () => (++reads === 1 ? jsonResponse(200, editable) : errorResponse(500, 'internal_error', 'x')),
      [PATCH]: () => Promise.reject(new DOMException('slow', 'TimeoutError')),
    })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La API tardó demasiado. No sabemos si se guardó: revisá la lista de turnos antes de intentar de nuevo.',
    )
    await waitFor(() => expect(requestsTo(fetchFn, SLOT).length).toBeGreaterThanOrEqual(3))
    expect(screen.getByLabelText('Día')).toHaveValue('3')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
    expect(screen.queryByText('No se pudo cargar el turno.')).not.toBeInTheDocument()
  })

  it('DI63_aSlotThatDisappearsOnRereadShowsNotFound', async () => {
    let reads = 0
    stubApi({
      ...baseRoutes,
      [SLOT]: () => (++reads === 1 ? jsonResponse(200, editable) : errorResponse(404, 'not_found', 'x')),
      [PATCH]: () => errorResponse(500, 'internal_error', 'x'),
    })
    renderEdit()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '3')

    await save()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Error: No encontramos este turno.'))
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })
})
