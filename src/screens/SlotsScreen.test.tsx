import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { apiLesson, mondayMorning, slotItem, thursdayEvening, tuesdayEvening } from '../test/slots'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const SLOTS = 'GET /api/v1/slots'
const LESSONS = 'GET /api/v1/lessons'

// Friday 20 Nov 2026, 12:00 in the workshop.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

function renderSlots(state?: unknown) {
  return renderApp({ role: 'LEAD_TEACHER', path: '/slots', state })
}

function cardOf(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name: title })
  const card = heading.closest('li')
  if (!card) throw new Error(`No card for ${title}`)
  return card
}

describe('SlotsScreen: list', () => {
  it('RF06_listsTheSlotsInOrderOfTheWeekWithTheFixedCountAndCapacityText', async () => {
    stubApi({
      [SLOTS]: () =>
        jsonResponse(200, [
          slotItem({ ...thursdayEvening, fixedStudents: 12 }),
          slotItem({ ...mondayMorning, fixedStudents: 7 }),
          tuesdayEvening,
        ]),
      [LESSONS]: () => jsonResponse(200, []),
    })
    renderSlots()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Turnos' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('Cada turno tiene cupo para 12 alumnos.')).toBeInTheDocument()
    expect(await screen.findByText('3 turnos')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Lunes 10:00 a 12:00',
      'Martes 18:00 a 20:00',
      'Jueves 18:00 a 20:00',
    ])
    expect(cardOf('Lunes 10:00 a 12:00')).toHaveTextContent('Fijos: 7 de 12')
    expect(cardOf('Lunes 10:00 a 12:00')).not.toHaveTextContent('completo')
    expect(cardOf('Jueves 18:00 a 20:00')).toHaveTextContent('Fijos: 12 de 12 (completo)')
    expect(screen.getByRole('link', { name: 'Nuevo turno' })).toHaveAttribute('href', '/slots/new')
  })

  it('DI66_aFullSlotWithOverbookedLessonsSaysSoInBoldText', async () => {
    stubApi({
      [SLOTS]: () =>
        jsonResponse(200, [
          slotItem({
            ...thursdayEvening,
            fixedStudents: 12,
            upcomingOverbookedLessons: [{ lessonDate: '2026-12-03', occupancy: 13, capacity: 12 }],
          }),
        ]),
      [LESSONS]: () => jsonResponse(200, []),
    })
    renderSlots()

    await screen.findByText('1 turno')
    const card = cardOf('Jueves 18:00 a 20:00')
    expect(card).toHaveTextContent('Fijos: 12 de 12 (completo) · 1 clase excedida')
    expect(within(card).getByText('1 clase excedida').tagName).toBe('STRONG')
  })

  it('DI43_overbookedLessonsOfAllTheSlotsAreMergedSortedAndShownAsAnAttentionNotice', async () => {
    stubApi({
      [SLOTS]: () =>
        jsonResponse(200, [
          slotItem({
            ...mondayMorning,
            upcomingOverbookedLessons: [{ lessonDate: '2026-12-07', occupancy: 13, capacity: 12 }],
          }),
          slotItem({
            ...thursdayEvening,
            upcomingOverbookedLessons: [
              { lessonDate: '2026-12-10', occupancy: 14, capacity: 12 },
              { lessonDate: '2026-12-03', occupancy: 13, capacity: 12 },
            ],
          }),
        ]),
      [LESSONS]: () => jsonResponse(200, []),
    })
    renderSlots()

    const text = await screen.findByText('Hay clases excedidas.')
    const box = text.closest('[role="status"]')
    if (!(box instanceof HTMLElement)) throw new Error('The notice is not a status')
    expect(box).toHaveTextContent('Atención: Hay clases excedidas.')
    expect(within(box).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Jue 3 de dic, 18:00 a 20:00: 13 alumnos para 12 lugares',
      'Lun 7 de dic, 10:00 a 12:00: 13 alumnos para 12 lugares',
      'Jue 10 de dic, 18:00 a 20:00: 14 alumnos para 12 lugares',
    ])
    expect(box).toHaveTextContent('Para resolverlo, cancelá alguna clase suelta de ese día.')
    expect(within(box).queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument()
  })

  it('DI43_withoutOverbookedLessonsThereIsNoAttentionNotice', async () => {
    stubApi({ [SLOTS]: () => jsonResponse(200, [mondayMorning]), [LESSONS]: () => jsonResponse(200, []) })
    renderSlots()

    await screen.findByText('1 turno')
    expect(screen.queryByText(/Hay clases excedidas/)).not.toBeInTheDocument()
  })

  it('DI62_eachCardShowsItsNextLessonThatHasNotStartedWithItsOccupancy', async () => {
    const fetchFn = stubApi({
      [SLOTS]: () => jsonResponse(200, [mondayMorning, thursdayEvening, tuesdayEvening]),
      [LESSONS]: () =>
        jsonResponse(200, [
          apiLesson(2, '2026-11-20', { started: true, occupancy: 5 }),
          apiLesson(2, '2026-11-23', { occupancy: 9 }),
          apiLesson(4, '2026-11-26', { occupancy: 13, startTime: '18:00', endTime: '20:00' }),
        ]),
    })
    renderSlots()

    await screen.findByText('Próxima: Lun 23 de nov · 9 de 12 lugares')
    expect(cardOf('Jueves 18:00 a 20:00')).toHaveTextContent(
      'Próxima: Jue 26 de nov · 13 de 12 lugares (excedida)',
    )
    // A slot without a lesson in the next days shows no line.
    expect(cardOf('Martes 18:00 a 20:00')).not.toHaveTextContent('Próxima')
    const query = new URL(requestsTo(fetchFn, LESSONS)[0]?.url ?? '').searchParams
    expect(query.get('from')).toBe('2026-11-20')
    expect(query.get('to')).toBe('2026-11-26')
    expect(requestsTo(fetchFn, LESSONS)).toHaveLength(1)
  })

  it('DI62_ifTheLessonsFailTheSlotsStayAndAnErrorWithRetryAppears', async () => {
    let up = false
    stubApi({
      [SLOTS]: () => jsonResponse(200, [mondayMorning]),
      [LESSONS]: () =>
        up ? jsonResponse(200, [apiLesson(2, '2026-11-23')]) : errorResponse(500, 'internal_error', 'x'),
    })
    renderSlots()

    expect(
      await screen.findByText(/No se pudo cargar la ocupación de las próximas clases\./),
    ).toBeInTheDocument()
    expect(cardOf('Lunes 10:00 a 12:00')).toHaveTextContent('Fijos: 0 de 12')

    up = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText(/Próxima: Lun 23 de nov · 9 de 12 lugares/)).toBeInTheDocument()
    expect(screen.queryByText(/No se pudo cargar la ocupación/)).not.toBeInTheDocument()
  })

  it('DI63_onlyASlotWithoutBookingsOffersToCorrectItsDayOrTime', async () => {
    stubApi({
      [SLOTS]: () =>
        jsonResponse(200, [slotItem({ ...mondayMorning, scheduleEditable: true }), tuesdayEvening]),
      [LESSONS]: () => jsonResponse(200, []),
    })
    renderSlots()

    await screen.findByText('2 turnos')
    const edit = within(cardOf('Lunes 10:00 a 12:00')).getByRole('link', {
      name: 'Corregir día u horario',
    })
    expect(edit).toHaveAttribute('href', '/slots/2/edit')
    expect(within(cardOf('Martes 18:00 a 20:00')).queryByRole('link')).not.toBeInTheDocument()
  })

  it('RF06_withoutSlotsItSaysSoAndPointsToNuevoTurno', async () => {
    stubApi({ [SLOTS]: () => jsonResponse(200, []), [LESSONS]: () => jsonResponse(200, []) })
    renderSlots()

    expect(await screen.findByText('Todavía no hay turnos.')).toBeInTheDocument()
    expect(screen.getByText('Nuevo turno', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nuevo turno' })).toBeInTheDocument()
  })

  it('RF06_showsALoadingTextWhileTheSlotsLoadAndNuevoTurnoWorks', async () => {
    stubApi({ [SLOTS]: () => new Promise<Response>(() => {}), [LESSONS]: () => jsonResponse(200, []) })
    renderSlots()

    expect(await screen.findByText('Cargando turnos…')).toHaveAttribute('role', 'status')
    expect(screen.getByRole('link', { name: 'Nuevo turno' })).toBeInTheDocument()
  })

  it('RF06_aFailedReadShowsTheErrorWithRetry', async () => {
    let up = false
    const fetchFn = stubApi({
      [SLOTS]: () => (up ? jsonResponse(200, [mondayMorning]) : errorResponse(500, 'internal_error', 'x')),
      [LESSONS]: () => jsonResponse(200, []),
    })
    renderSlots()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: No se pudieron cargar los turnos.')
    expect(requestsTo(fetchFn, SLOTS)).toHaveLength(2)

    up = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('1 turno')).toBeInTheDocument()
  })

  it('RF06_aNoticeFromTheNavigationShowsAboveTheListAndCanBeClosed', async () => {
    stubApi({ [SLOTS]: () => jsonResponse(200, [mondayMorning]), [LESSONS]: () => jsonResponse(200, []) })
    renderSlots({ notice: { kind: 'success', text: 'Creamos el turno del martes 18:00 a 20:00.' } })

    const notice = await screen.findByText('Creamos el turno del martes 18:00 a 20:00.')
    expect(notice.closest('[role="status"]')).toHaveTextContent('Listo: Creamos el turno')
    expect(await screen.findByRole('heading', { level: 1, name: 'Turnos' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))

    await waitFor(() => expect(screen.queryByText(/Creamos el turno/)).not.toBeInTheDocument())
  })

  it('RF06_theTurnosTabStaysMarkedInTheSubroutes', async () => {
    stubApi({ [SLOTS]: () => jsonResponse(200, []), [LESSONS]: () => jsonResponse(200, []) })
    renderApp({ role: 'LEAD_TEACHER', path: '/slots/new' })

    const tab = await screen.findByRole('link', { name: 'Turnos' })
    expect(tab).toHaveAttribute('aria-current', 'page')
  })
})
