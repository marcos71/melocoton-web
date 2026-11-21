import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'
import {
  brunoProfile,
  lucasProfile,
  luciaProfile,
  luisProfile,
  mondaySlot,
  thursdaySlot,
  tuesdaySlot,
} from '../test/students'

const SLOTS = 'GET /api/v1/slots'
const PUT_12 = 'PUT /api/v1/students/12/fixed-slot'
const PUT_11 = 'PUT /api/v1/students/11/fixed-slot'

function studentRoute(profile: { id: number }) {
  return { [`GET /api/v1/students/${profile.id}`]: () => jsonResponse(200, profile) }
}

function renderSlot(id: number, options: { state?: unknown } = {}) {
  return renderApp({
    role: 'LEAD_TEACHER',
    path: `/students/${id}/fixed-slot`,
    state: options.state,
  })
}

const assigned = (slot: typeof thursdaySlot, overbookedLessons: unknown[] = []) =>
  jsonResponse(200, {
    fixedSlot: { id: slot.id, dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime },
    overbookedLessons,
  })

async function chooseThursday() {
  await userEvent.click(await screen.findByRole('radio', { name: /Jueves 18:00 a 20:00/ }))
}

describe('FixedSlotScreen: assign', () => {
  const routes = {
    ...studentRoute(luisProfile),
    [SLOTS]: () => jsonResponse(200, [thursdaySlot, mondaySlot, tuesdaySlot]),
  }

  it('RF08_listsTheActiveSlotsInOrderOfTheWeekWithNothingChosenAndTheButtonUnavailable', async () => {
    const fetchFn = stubApi(routes)
    renderSlot(12)

    const heading = await screen.findByRole('heading', { name: 'Asignar turno fijo' })
    expect(heading).toHaveFocus()
    const radios = await screen.findAllByRole('radio')
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual([
      'Lunes 10:00 a 12:00Cupo: 8',
      'Martes 18:00 a 20:00Cupo: 8',
      'Jueves 18:00 a 20:00Cupo: 8',
    ])
    radios.forEach((radio) => expect(radio).not.toBeChecked())
    expect(screen.queryByText(/Turno actual/)).not.toBeInTheDocument()
    const action = screen.getByRole('button', { name: 'Asignar turno fijo' })
    expect(action).toHaveAttribute('aria-disabled', 'true')
    expect(action).toHaveAccessibleDescription('Elegí un turno.')
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/students/12')
    expect(screen.getByRole('link', { name: /Ficha de Luis Gómez/ })).toHaveAttribute('href', '/students/12')
    expect(requestsTo(fetchFn, PUT_12)).toHaveLength(0)
  })

  it('RF08_choosingASlotExplainsWhatWillHappenAndEnablesTheButton', async () => {
    stubApi(routes)
    renderSlot(12)

    await chooseThursday()

    expect(
      screen.getByText(
        'Se generan sus clases fijas de los jueves. Si una fecha ya está llena, igual se le guarda el lugar y la clase queda excedida.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Asignar turno fijo' })).not.toHaveAttribute('aria-disabled')
  })

  it('DI43_aSlotWithOverbookedLessonsSaysSoInTextWithoutBlocking', async () => {
    stubApi({
      ...studentRoute(luisProfile),
      [SLOTS]: () =>
        jsonResponse(200, [
          {
            ...thursdaySlot,
            upcomingOverbookedLessons: [{ lessonDate: '2026-12-03', occupancy: 9, capacity: 8 }],
          },
          {
            ...mondaySlot,
            upcomingOverbookedLessons: [
              { lessonDate: '2026-12-07', occupancy: 9, capacity: 8 },
              { lessonDate: '2026-12-14', occupancy: 9, capacity: 8 },
              { lessonDate: '2026-12-21', occupancy: 9, capacity: 8 },
            ],
          },
        ]),
    })
    renderSlot(12)

    const thursday = await screen.findByRole('radio', { name: /Jueves/ })
    expect(thursday).toHaveAccessibleDescription('Cupo: 8 · 1 clase excedida')
    expect(screen.getByRole('radio', { name: /Lunes/ })).toHaveAccessibleDescription(
      'Cupo: 8 · 3 clases excedidas',
    )
    await userEvent.click(thursday)
    expect(thursday).toBeChecked()
  })

  it('RF08_assigningSendsTheSlotGoesBackToTheProfileWithTheNoticeAndInvalidatesWhatChanged', async () => {
    const fetchFn = stubApi({
      ...routes,
      [PUT_12]: () => assigned(thursdaySlot),
    })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    expect(await screen.findByRole('heading', { name: 'Luis Gómez' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/students\/12$/)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Listo: Le asignamos el jueves 18:00 a 20:00. Ya tiene sus clases fijas generadas.',
    )
    expect(await requestsTo(fetchFn, PUT_12)[0]?.clone().json()).toEqual({ slotId: 4 })
    // The slots (their overbooked lessons change) and the list of students are refreshed (docs 1.5).
    await waitFor(() => expect(requestsTo(fetchFn, SLOTS).length).toBeGreaterThanOrEqual(2))
  })

  it('RF08_theButtonSaysAsignandoWhileSending', async () => {
    stubApi({ ...routes, [PUT_12]: () => new Promise<Response>(() => {}) })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    expect(await screen.findByRole('button', { name: 'Asignando…' })).toBeDisabled()
  })

  it('DI43_overbookedLessonsInTheResultShowAnAttentionNoticeThatListsThemAndLinksToSlots', async () => {
    stubApi({
      ...routes,
      [PUT_12]: () =>
        assigned(thursdaySlot, [
          { lessonDate: '2026-12-03', occupancy: 9, capacity: 8 },
          { lessonDate: '2026-12-10', occupancy: 9, capacity: 8 },
        ]),
      [SLOTS]: () => jsonResponse(200, [thursdaySlot]),
    })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    await screen.findByRole('heading', { name: 'Luis Gómez' })
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('Atención: El jueves 18:00 a 20:00 tiene clases excedidas.')
    const items = within(notice).getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual([
      'Jue 3 de dic: 9 alumnos para 8 lugares',
      'Jue 10 de dic: 9 alumnos para 8 lugares',
    ])
    expect(notice).toHaveTextContent('Las clases fijas se guardaron igual.')
    expect(within(notice).getByRole('link', { name: 'Ver en Turnos' })).toHaveAttribute('href', '/slots')
    expect(within(notice).getByRole('button', { name: 'Cerrar aviso' })).toBeInTheDocument()
  })

  it('RF08_slot_inactiveClearsTheChoiceRefreshesTheSlotsAndShowsItsText', async () => {
    const fetchFn = stubApi({ ...routes, [PUT_12]: () => errorResponse(409, 'slot_inactive', 'x') })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: Ese turno está desactivado: no admite reservas nuevas. Elegí otro.',
    )
    expect(screen.getByRole('radio', { name: /Jueves/ })).not.toBeChecked()
    await waitFor(() => expect(requestsTo(fetchFn, SLOTS).length).toBeGreaterThanOrEqual(2))
  })

  it('RF08_aNotFoundWhereTheStudentStillExistsMeansTheSlotWithoutReadingTheMessage', async () => {
    const fetchFn = stubApi({ ...routes, [PUT_12]: () => errorResponse(404, 'not_found', 'Cualquier texto.') })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Ese turno ya no existe. Elegí otro.')
    expect(screen.getByRole('radio', { name: /Jueves/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Asignar turno fijo' })).toHaveAttribute('aria-disabled', 'true')
    expect(requestsTo(fetchFn, 'GET /api/v1/students/12').length).toBeGreaterThanOrEqual(2)
    await waitFor(() => expect(requestsTo(fetchFn, SLOTS).length).toBeGreaterThanOrEqual(2))
  })

  it('RF08_aNotFoundWhereTheStudentReadIsAlso404ShowsTheNotFoundScreen', async () => {
    let gone = false
    stubApi({
      ...routes,
      'GET /api/v1/students/12': () =>
        gone ? errorResponse(404, 'not_found', 'Otro texto.') : jsonResponse(200, luisProfile),
      [PUT_12]: () => {
        gone = true
        return errorResponse(404, 'not_found', 'Otro texto distinto.')
      },
    })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Error: No encontramos a este alumno.'),
    )
    expect(screen.getByRole('link', { name: 'Volver a Alumnos' })).toBeInTheDocument()
  })

  it.each([
    ['enrollment_type_mismatch', 'Solo un alumno mensual tiene turno fijo.'],
    ['student_inactive', 'El alumno está inactivo.'],
  ])('RF08_%sShowsItsTextAndRefreshesTheProfile', async (code, text) => {
    const fetchFn = stubApi({ ...routes, [PUT_12]: () => errorResponse(409, code, 'Mensaje de la API.') })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(`Error: ${text}`)
    await waitFor(() => expect(requestsTo(fetchFn, 'GET /api/v1/students/12').length).toBeGreaterThanOrEqual(2))
  })

  it('RF08_aValidationErrorShowsTheApiMessageAndKeepsTheChoice', async () => {
    stubApi({ ...routes, [PUT_12]: () => errorResponse(400, 'validation_error', 'Falta el turno.') })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Falta el turno.')
    expect(screen.getByRole('radio', { name: /Jueves/ })).toBeChecked()
  })

  it('RF08_aTimeoutRefreshesTheProfileAndTellsNotToAssumeAnything', async () => {
    const fetchFn = stubApi({
      ...routes,
      [PUT_12]: () => Promise.reject(new DOMException('slow', 'TimeoutError')),
    })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La API tardó demasiado. No sabemos si se guardó: revisá la ficha antes de intentar de nuevo.',
    )
    await waitFor(() => expect(requestsTo(fetchFn, 'GET /api/v1/students/12').length).toBeGreaterThanOrEqual(2))
  })

  it('RF08_withoutConnectionNothingIsRetriedOnItsOwn', async () => {
    const fetchFn = stubApi({ ...routes, [PUT_12]: () => Promise.reject(new TypeError('offline')) })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó nada.')
    expect(requestsTo(fetchFn, PUT_12)).toHaveLength(1)
  })

  it('RF08_aServerFailureShowsTheGenericText', async () => {
    stubApi({ ...routes, [PUT_12]: () => errorResponse(500, 'internal_error', 'boom') })
    renderSlot(12)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno fijo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo falló en la API. Probá de nuevo en un rato.')
  })
})

describe('FixedSlotScreen: change', () => {
  const routes = {
    ...studentRoute(luciaProfile),
    [SLOTS]: () => jsonResponse(200, [tuesdaySlot, thursdaySlot]),
  }

  it('DI27_showsTheCurrentSlotAsUnavailableAndAsksTheReplacementQuestion', async () => {
    stubApi(routes)
    renderSlot(11)

    expect(await screen.findByRole('heading', { name: 'Cambiar turno fijo' })).toBeInTheDocument()
    expect(screen.getByText('Turno actual: Martes 18:00 a 20:00')).toBeInTheDocument()
    const current = await screen.findByRole('radio', { name: /Martes 18:00 a 20:00/ })
    expect(current).toHaveAttribute('aria-disabled', 'true')
    expect(current).toHaveAccessibleDescription('Es su turno actual.')
    await userEvent.click(current)
    expect(current).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Reemplazar turno' })).toHaveAttribute('aria-disabled', 'true')

    await chooseThursday()

    expect(screen.getByText('¿Reemplazar el martes 18:00 por el jueves 18:00?')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Se cancelan sus clases fijas del martes que todavía no empezaron y se generan las del jueves. Si una fecha ya está llena, igual se le guarda el lugar y la clase queda excedida.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reemplazar turno' })).not.toHaveAttribute('aria-disabled')
  })

  it('DI27_replacingSendsTheNewSlotAndTheNoticeSaysTheOldClassesWereCancelled', async () => {
    const fetchFn = stubApi({ ...routes, [PUT_11]: () => assigned(thursdaySlot) })
    renderSlot(11)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Reemplazar turno' }))

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Listo: Cambiamos su turno fijo al jueves 18:00 a 20:00. Se cancelaron sus clases del martes que no habían empezado.',
    )
    expect(await requestsTo(fetchFn, PUT_11)[0]?.clone().json()).toEqual({ slotId: 4 })
  })

  it('DI27_theButtonSaysReemplazandoWhileSending', async () => {
    stubApi({ ...routes, [PUT_11]: () => new Promise<Response>(() => {}) })
    renderSlot(11)
    await chooseThursday()

    await userEvent.click(screen.getByRole('button', { name: 'Reemplazar turno' }))

    expect(await screen.findByRole('button', { name: 'Reemplazando…' })).toBeDisabled()
  })

  it('RF08_theListOfTheProfileIsKeptWhenGoingBack', async () => {
    stubApi(routes)
    renderSlot(11, { state: { from: '/students?q=lu' } })
    await userEvent.click(await screen.findByRole('link', { name: 'Cancelar' }))

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    expect(screen.getByRole('main').querySelector('a[href="/students?q=lu"]')).not.toBeNull()
  })
})

describe('FixedSlotScreen: states', () => {
  it('RF08_aDropInStudentGetsTheReasonInsteadOfTheForm', async () => {
    stubApi(studentRoute(lucasProfile))
    renderSlot(13)

    expect(await screen.findByText('Solo un alumno mensual tiene turno fijo.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ficha de Lucas Díaz/ })).toHaveAttribute('href', '/students/13')
  })

  it('RF08_anInactiveStudentGetsTheReasonInsteadOfTheForm', async () => {
    stubApi(studentRoute(brunoProfile))
    renderSlot(14)

    expect(
      await screen.findByText('El alumno está inactivo: no se le asignan turnos ni clases.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('RF08_withoutActiveSlotsItSendsToTheSlotsScreen', async () => {
    stubApi({ ...studentRoute(luisProfile), [SLOTS]: () => jsonResponse(200, []) })
    renderSlot(12)

    expect(await screen.findByText(/Todavía no hay turnos\./)).toHaveTextContent(
      'Todavía no hay turnos. Crealos en Turnos.',
    )
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Turnos' })).toHaveAttribute('href', '/slots')
  })

  it('RF08_showsALoadingTextForTheSlotsAndAnErrorWithRetryIfTheyFail', async () => {
    let up = false
    const fetchFn = stubApi({
      ...studentRoute(luisProfile),
      [SLOTS]: () => (up ? jsonResponse(200, [thursdaySlot]) : errorResponse(500, 'internal_error', 'x')),
    })
    renderSlot(12)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se pudieron cargar los turnos.')
    expect(requestsTo(fetchFn, SLOTS)).toHaveLength(2)

    up = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('radio', { name: /Jueves/ })).toBeInTheDocument()
  })

  it('RF08_aMissingStudentShowsTheNotFoundScreen', async () => {
    stubApi({ 'GET /api/v1/students/99': () => errorResponse(404, 'not_found', 'No existe ese alumno.') })
    renderSlot(99)

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: No encontramos a este alumno.')
  })
})
