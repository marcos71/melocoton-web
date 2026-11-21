import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mondayMorning, slotItem, tuesdayEvening } from '../test/slots'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const SLOTS = 'GET /api/v1/slots'
const LESSONS = 'GET /api/v1/lessons'
const POST = 'POST /api/v1/slots'

const created = { id: 9, dayOfWeek: 2, startTime: '18:00', endTime: '20:00', capacity: 12, active: true }

const baseRoutes = {
  [SLOTS]: () => jsonResponse(200, [mondayMorning, tuesdayEvening]),
  [LESSONS]: () => jsonResponse(200, []),
}

function renderNew() {
  return renderApp({ role: 'LEAD_TEACHER', path: '/slots/new' })
}

async function fill(day: string | null, start: string | null, end: string | null) {
  if (day) await userEvent.selectOptions(await screen.findByLabelText('Día'), day)
  if (start) await userEvent.type(screen.getByLabelText('Hora de inicio'), start)
  if (end) await userEvent.type(screen.getByLabelText('Hora de fin'), end)
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Crear turno' }))

describe('NewSlotScreen', () => {
  it('RF06_showsTheEmptyFormWithTheFixedCapacityTextAndTheButtonsStacked', async () => {
    stubApi(baseRoutes)
    renderNew()

    const heading = await screen.findByRole('heading', { name: 'Nuevo turno' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('El cupo es de 12 alumnos.')).toBeInTheDocument()
    expect(screen.getByLabelText('Día')).toHaveValue('')
    expect(within(screen.getByLabelText('Día')).getByRole('option', { name: 'Elegí el día' })).toBeInTheDocument()
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Elegí el día',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ])
    expect(screen.getByLabelText('Hora de inicio')).toHaveAttribute('type', 'time')
    expect(screen.getByLabelText('Hora de fin')).toHaveAttribute('type', 'time')
    // The primary action is first in the document, so it goes on top on a phone (DI-52).
    const actions = screen.getByRole('button', { name: 'Crear turno' }).parentElement
    expect(actions?.lastElementChild).toBe(screen.getByRole('link', { name: 'Cancelar' }))
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/slots')
    expect(screen.getByRole('link', { name: 'Volver a Turnos' })).toHaveAttribute('href', '/slots')
  })

  it('RF06_everyFieldIsRequiredAndNothingIsSentWithoutThem', async () => {
    const fetchFn = stubApi(baseRoutes)
    renderNew()
    await screen.findByRole('heading', { name: 'Nuevo turno' })

    await submit()

    expect(await screen.findByText('Elegí el día.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá la hora de inicio.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá la hora de fin.')).toBeInTheDocument()
    expect(requestsTo(fetchFn, POST)).toHaveLength(0)
  })

  it('RF06_theEndMustBeAfterTheStart', async () => {
    const fetchFn = stubApi(baseRoutes)
    renderNew()
    await fill('3', '10:00', '10:00')

    await submit()

    expect(
      await screen.findByText('La hora de fin tiene que ser posterior a la de inicio.'),
    ).toBeInTheDocument()
    expect(requestsTo(fetchFn, POST)).toHaveLength(0)
  })

  it('DI25_anOverlapWithAnActiveSlotIsBlockedBeforeSendingAndNamesTheSlot', async () => {
    const fetchFn = stubApi(baseRoutes)
    renderNew()
    await fill('2', '19:00', '21:00')

    await submit()

    const message = await screen.findByText('Se superpone con el turno del martes 18:00 a 20:00.')
    expect(message).toBeInTheDocument()
    expect(screen.getByLabelText('Hora de fin')).toBeInvalid()
    expect(requestsTo(fetchFn, POST)).toHaveLength(0)
  })

  it('DI25_slotsThatTouchAreAllowed', async () => {
    const fetchFn = stubApi({ ...baseRoutes, [POST]: () => jsonResponse(201, { ...created, startTime: '20:00', endTime: '22:00' }) })
    renderNew()
    await fill('2', '20:00', '22:00')

    await submit()

    await waitFor(() => expect(requestsTo(fetchFn, POST)).toHaveLength(1))
  })

  it('DI25_chosingADayListsTheSlotsOfThatDay', async () => {
    stubApi({
      ...baseRoutes,
      [SLOTS]: () =>
        jsonResponse(200, [
          slotItem({ id: 5, dayOfWeek: 2, startTime: '18:00', endTime: '20:00' }),
          slotItem({ id: 6, dayOfWeek: 2, startTime: '10:00', endTime: '12:00' }),
        ]),
    })
    renderNew()
    await userEvent.selectOptions(await screen.findByLabelText('Día'), '2')

    expect(await screen.findByText('Ese día ya hay: 10:00 a 12:00 · 18:00 a 20:00.')).toBeInTheDocument()
    expect(screen.getByLabelText('Día')).toHaveAccessibleDescription(
      'Ese día ya hay: 10:00 a 12:00 · 18:00 a 20:00.',
    )

    await userEvent.selectOptions(screen.getByLabelText('Día'), '5')

    expect(screen.getByText('Ese día no hay turnos.')).toBeInTheDocument()
  })

  it('DI25_ifTheSlotsCouldNotBeReadTheFormStillWorksAndSaysTheOverlapIsCheckedOnSave', async () => {
    const fetchFn = stubApi({
      ...baseRoutes,
      [SLOTS]: () => errorResponse(500, 'internal_error', 'x'),
      [POST]: () => jsonResponse(201, created),
    })
    renderNew()

    expect(
      await screen.findByText(
        'No pudimos cargar los turnos existentes: la superposición se revisa al guardar.',
      ),
    ).toBeInTheDocument()
    await fill('2', '18:00', '20:00')
    await submit()

    await waitFor(() => expect(requestsTo(fetchFn, POST)).toHaveLength(1))
  })

  it('RF06_creatingSendsTheDayAndTimesAsHoursAndMinutesAndGoesToTheListWithANotice', async () => {
    let slots = [mondayMorning]
    const fetchFn = stubApi({
      [SLOTS]: () => jsonResponse(200, slots),
      [LESSONS]: () => jsonResponse(200, []),
      [POST]: () => {
        slots = [mondayMorning, slotItem(created)]
        return jsonResponse(201, created)
      },
    })
    renderNew()
    await fill('2', '18:00', '20:00')

    await submit()

    expect(await screen.findByRole('heading', { level: 1, name: 'Turnos' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/slots$/)
    expect(await screen.findByText('Creamos el turno del martes 18:00 a 20:00.')).toBeInTheDocument()
    expect(await requestsTo(fetchFn, POST)[0]?.clone().json()).toEqual({
      dayOfWeek: 2,
      startTime: '18:00',
      endTime: '20:00',
    })
    // The list is read again, so the new slot shows.
    expect(await screen.findByText('2 turnos')).toBeInTheDocument()
  })

  it('RF06_theButtonSaysCreandoWhileSending', async () => {
    stubApi({ ...baseRoutes, [POST]: () => new Promise<Response>(() => {}) })
    renderNew()
    await fill('2', '21:00', '22:00')

    await submit()

    expect(await screen.findByRole('button', { name: 'Creando…' })).toBeDisabled()
  })

  it('DI25_aSlotOverlapFromTheApiShowsUnderTheEndTimeFocusesItAndRefreshesTheSlots', async () => {
    // The list on screen is old: it does not know about the slot that is in the way.
    const fetchFn = stubApi({
      ...baseRoutes,
      [SLOTS]: () => jsonResponse(200, []),
      [POST]: () =>
        jsonResponse(409, {
          error: {
            code: 'slot_overlap',
            message: 'Se superpone.',
            details: { slotId: 3, dayOfWeek: 2, startTime: '18:00:00', endTime: '20:00:00' },
          },
        }),
    })
    renderNew()
    await fill('2', '19:00', '21:00')

    await submit()

    expect(await screen.findByText('Se superpone con el turno del martes 18:00 a 20:00.')).toBeInTheDocument()
    expect(screen.getByLabelText('Hora de fin')).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchFn, SLOTS).length).toBeGreaterThanOrEqual(2))
  })

  it('RF06_aValidationErrorShowsTheApiMessageInTheErrorBlock', async () => {
    stubApi({ ...baseRoutes, [POST]: () => errorResponse(400, 'validation_error', 'El horario no es válido.') })
    renderNew()
    await fill('3', '10:00', '11:00')

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: El horario no es válido.')
  })

  it('RF06_aTimeoutTellsToCheckTheListAndRefreshesIt', async () => {
    const fetchFn = stubApi({
      ...baseRoutes,
      [POST]: () => Promise.reject(new DOMException('slow', 'TimeoutError')),
    })
    renderNew()
    await fill('3', '10:00', '11:00')

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La API tardó demasiado. No sabemos si se guardó: revisá la lista de turnos antes de intentar de nuevo.',
    )
    await waitFor(() => expect(requestsTo(fetchFn, SLOTS).length).toBeGreaterThanOrEqual(2))
  })

  it.each([
    ['withoutConnection', () => Promise.reject(new TypeError('offline')), 'No se guardó nada.'],
    [
      'aServerFailure',
      () => Promise.resolve(errorResponse(500, 'internal_error', 'boom')),
      'Algo falló en la API. Probá de nuevo en un rato.',
    ],
  ])('RF06_%sShowsItsTextAndNothingIsRetried', async (_, respond, text) => {
    const fetchFn = stubApi({ ...baseRoutes, [POST]: respond })
    renderNew()
    await fill('3', '10:00', '11:00')

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(requestsTo(fetchFn, POST)).toHaveLength(1)
  })
})
