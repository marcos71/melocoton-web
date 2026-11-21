import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTestQueryClient, errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'
import { brunoProfile, lucasProfile, luciaProfile, mondaySlot, thursdaySlot, tuesdaySlot } from '../test/students'

const SLOTS = 'GET /api/v1/slots'
const LESSONS = 'GET /api/v1/lessons'
const STUDENT = 'GET /api/v1/students/13'
const POST = 'POST /api/v1/students/13/drop-in-bookings'

// Friday 20 Nov 2026, 12:00 in the workshop.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

type LessonOverrides = Partial<{
  slotId: number
  dayOfWeek: number
  startTime: string
  endTime: string
  freeSpots: number
  started: boolean
}>

function apiLesson(lessonDate: string, overrides: LessonOverrides = {}) {
  const freeSpots = overrides.freeSpots ?? 3
  return {
    slotId: 4,
    lessonDate,
    dayOfWeek: 4,
    startTime: '18:00',
    endTime: '20:00',
    capacity: 8,
    occupancy: 8 - freeSpots,
    freeSpots,
    overbooked: false,
    started: false,
    ...overrides,
  }
}

const standardLessons = [
  apiLesson('2026-11-20', { started: true, startTime: '10:00', endTime: '12:00' }),
  apiLesson('2026-11-20'),
  apiLesson('2026-11-24', { slotId: 3, dayOfWeek: 2, freeSpots: 1 }),
  apiLesson('2026-11-26', { slotId: 5, startTime: '10:00', endTime: '12:00' }),
  apiLesson('2026-11-26', { freeSpots: 0 }),
  apiLesson('2026-12-03'),
]

function renderDropIn(options: { state?: unknown; queryClient?: ReturnType<typeof createTestQueryClient> } = {}) {
  return renderApp({ role: 'LEAD_TEACHER', path: '/students/13/drop-in/new', ...options })
}

const baseRoutes = {
  [STUDENT]: () => jsonResponse(200, lucasProfile),
  [SLOTS]: () => jsonResponse(200, [thursdaySlot, mondaySlot, tuesdaySlot]),
  [LESSONS]: () => jsonResponse(200, standardLessons),
}

async function chooseLesson(name: RegExp) {
  await userEvent.click(await screen.findByRole('radio', { name }))
}

const THURSDAY_1800_FULL = /Jue 26 de nov.*18:00 a 20:00/
const bookButton = () => screen.getByRole('button', { name: 'Anotar el jue 3 de dic, 18:00' })

describe('DropInBookingScreen: list', () => {
  it('RF09_showsTheTitleFocusedTheBackTargetAndTheTextSkeletonWhileLoading', async () => {
    stubApi({ ...baseRoutes, [LESSONS]: () => new Promise<Response>(() => {}) })
    renderDropIn()

    const heading = await screen.findByRole('heading', { name: 'Anotar clase suelta' })
    expect(heading).toHaveFocus()
    expect(await screen.findByRole('status')).toHaveTextContent('Cargando clases…')
    expect(screen.getByRole('link', { name: 'Volver a Ficha de Lucas Díaz' })).toHaveAttribute(
      'href',
      '/students/13',
    )
  })

  it('DI56_buildsTheListFromTheApiHidingStartedLessonsAndLabellingToday', async () => {
    const fetchFn = stubApi(baseRoutes)
    renderDropIn()

    const radios = await screen.findAllByRole('radio')
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual([
      'Hoy, vie 20 de nov18:00 a 20:00Quedan 3 lugares',
      'Mar 24 de nov18:00 a 20:00Queda 1 lugar',
      'Jue 26 de nov10:00 a 12:00Ya está anotado.',
      'Jue 26 de nov18:00 a 20:00Completa',
      'Jue 3 de dic18:00 a 20:00Quedan 3 lugares',
    ])
    radios.forEach((radio) => expect(radio).not.toBeChecked())
    const [request] = requestsTo(fetchFn, LESSONS)
    const params = new URL(request?.url ?? '').searchParams
    expect(params.get('from')).toBe('2026-11-20')
    expect(params.get('to')).toBe('2027-02-20')
    expect(params.has('slotId')).toBe(false)
  })

  it('DI41_anAlreadyBookedLessonIsUnavailableWithItsReasonInText', async () => {
    stubApi(baseRoutes)
    renderDropIn()

    const booked = await screen.findByRole('radio', { name: /10:00 a 12:00/ })
    expect(booked).toHaveAttribute('aria-disabled', 'true')
    expect(booked).toHaveAccessibleDescription('Ya está anotado.')
    await userEvent.click(booked)
    expect(booked).not.toBeChecked()
  })

  it('RF11_aFullLessonIsUnavailableAsCompleta', async () => {
    stubApi(baseRoutes)
    renderDropIn()

    const full = await screen.findByRole('radio', { name: THURSDAY_1800_FULL })
    expect(full).toHaveAttribute('aria-disabled', 'true')
    expect(full).toHaveAccessibleDescription('Completa')
    await userEvent.click(full)
    expect(full).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Anotar clase suelta' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('DI43_anOverbookedLessonIsCompletaToo', async () => {
    stubApi({
      ...baseRoutes,
      [LESSONS]: () =>
        jsonResponse(200, [{ ...apiLesson('2026-12-03', { freeSpots: 0 }), occupancy: 9, overbooked: true }]),
    })
    renderDropIn()

    expect(await screen.findByRole('radio', { name: /Jue 3 de dic/ })).toHaveAccessibleDescription('Completa')
  })

  it('RF09_theButtonIsUnavailableWithItsReasonUntilALessonIsChosenAndThenNamesIt', async () => {
    stubApi(baseRoutes)
    renderDropIn()

    const unavailable = await screen.findByRole('button', { name: 'Anotar clase suelta' })
    expect(unavailable).toHaveAttribute('aria-disabled', 'true')
    expect(unavailable).toHaveAccessibleDescription('Elegí una clase.')
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/students/13')
    expect(screen.queryByText(/Si la clase está llena/)).not.toBeInTheDocument()

    await chooseLesson(/Jue 3 de dic/)

    expect(bookButton()).not.toHaveAttribute('aria-disabled')
  })

  it('RN03_aLessonThatStartsWhileTheScreenIsOpenDropsOutOfTheList', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-11-20T15:00:00Z'))
    stubApi(baseRoutes)
    renderDropIn()
    expect(await screen.findByRole('radio', { name: /Hoy, vie 20 de nov/ }, { timeout: 3000 })).toBeInTheDocument()

    await act(async () => {
      vi.setSystemTime(new Date('2026-11-20T21:30:00Z'))
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(screen.queryByRole('radio', { name: /Hoy, vie 20 de nov/ })).not.toBeInTheDocument()
  })
})

describe('DropInBookingScreen: gate and states', () => {
  it('RF09_aMonthlyStudentSeesTheReasonInsteadOfTheForm', async () => {
    stubApi({
      'GET /api/v1/students/11': () => jsonResponse(200, luciaProfile),
      [SLOTS]: () => jsonResponse(200, []),
      [LESSONS]: () => jsonResponse(200, []),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/students/11/drop-in/new' })

    expect(await screen.findByRole('heading', { name: 'Anotar clase suelta' })).toBeInTheDocument()
    expect(screen.getByText('La clase suelta es solo para alumnos de clase suelta.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('RF09_anInactiveStudentSeesTheReasonInsteadOfTheForm', async () => {
    stubApi({
      'GET /api/v1/students/14': () => jsonResponse(200, { ...brunoProfile, enrollmentType: 'DROP_IN' }),
      [SLOTS]: () => jsonResponse(200, []),
      [LESSONS]: () => jsonResponse(200, []),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/students/14/drop-in/new' })

    expect(await screen.findByText('El alumno está inactivo: no se le asignan turnos ni clases.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('DI56_withoutLessonsAndWithoutActiveSlotsTheNoticeLinksToSlots', async () => {
    stubApi({ ...baseRoutes, [SLOTS]: () => jsonResponse(200, []), [LESSONS]: () => jsonResponse(200, []) })
    renderDropIn()

    expect(await screen.findByText('No hay clases en los próximos 3 meses.')).toBeInTheDocument()
    expect(screen.getByText('Info:')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crealos en Turnos' })).toHaveAttribute('href', '/slots')
    expect(screen.queryByLabelText('Turno')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('DI56_withoutLessonsButWithActiveSlotsTheNoticeHasNoLink', async () => {
    stubApi({ ...baseRoutes, [LESSONS]: () => jsonResponse(200, [apiLesson('2026-11-20', { started: true })]) })
    renderDropIn()

    expect(await screen.findByText('No hay clases en los próximos 3 meses.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Crealos en Turnos' })).not.toBeInTheDocument()
  })

  it('DI56_aFailedLessonsReadShowsTheErrorWithRetryAndRecovers', async () => {
    let fails = true
    const fetchFn = stubApi({
      ...baseRoutes,
      [LESSONS]: () => (fails ? errorResponse(500, 'internal_error', 'boom') : jsonResponse(200, standardLessons)),
    })
    renderDropIn()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Error: No se pudieron cargar las clases.')
    expect(alert).toHaveTextContent('Algo falló en la API. Probá de nuevo en un rato.')
    // A read is tried once more on its own.
    expect(requestsTo(fetchFn, LESSONS)).toHaveLength(2)

    fails = false
    await userEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findAllByRole('radio')).toHaveLength(5)
  })
})

describe('DropInBookingScreen: slot filter', () => {
  it('RF09_theFilterListsTheActiveSlotsInTheOrderOfTheWeekAndStartsOnAll', async () => {
    stubApi(baseRoutes)
    renderDropIn()

    const select = await screen.findByLabelText('Turno')
    expect(select).toHaveValue('')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Todos los turnos',
      'Lunes 10:00 a 12:00',
      'Martes 18:00 a 20:00',
      'Jueves 18:00 a 20:00',
    ])
  })

  it('RF09_choosingASlotAsksForItsLessonsAndClearsTheChoice', async () => {
    const fetchFn = stubApi({
      ...baseRoutes,
      [LESSONS]: (request) =>
        new URL(request.url).searchParams.get('slotId') === '4'
          ? jsonResponse(200, [apiLesson('2026-12-03'), apiLesson('2026-12-10')])
          : jsonResponse(200, standardLessons),
    })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.selectOptions(screen.getByLabelText('Turno'), 'Jueves 18:00 a 20:00')

    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(2))
    expect(requestsTo(fetchFn, LESSONS).at(-1)?.url).toContain('slotId=4')
    screen.getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked())
    expect(screen.getByRole('button', { name: 'Anotar clase suelta' })).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('DropInBookingScreen: show more', () => {
  const many = Array.from({ length: 25 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 10, 26 + index * 7))
    return apiLesson(date.toISOString().slice(0, 10))
  })

  it('DI44_showsTenRowsAndAddsTenMoreMovingTheFocusToTheFirstNewOne', async () => {
    stubApi({ ...baseRoutes, [LESSONS]: () => jsonResponse(200, many) })
    renderDropIn()

    expect(await screen.findAllByRole('radio')).toHaveLength(10)
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar más fechas' }))

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(20)
    expect(radios[10]).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar más fechas' }))

    expect(screen.getAllByRole('radio')).toHaveLength(25)
    expect(screen.getAllByRole('radio')[20]).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Mostrar más fechas' })).not.toBeInTheDocument()
  })

  it('DI44_withTenOrFewerRowsThereIsNoShowMoreButton', async () => {
    stubApi({ ...baseRoutes, [LESSONS]: () => jsonResponse(200, many.slice(0, 10)) })
    renderDropIn()

    expect(await screen.findAllByRole('radio')).toHaveLength(10)
    expect(screen.queryByRole('button', { name: 'Mostrar más fechas' })).not.toBeInTheDocument()
  })
})

describe('DropInBookingScreen: book', () => {
  it('RF09_bookingSendsTheLessonGoesBackToTheProfileWithTheNoticeAndInvalidatesWhatChanged', async () => {
    const queryClient = createTestQueryClient()
    const fetchFn = stubApi({
      ...baseRoutes,
      [POST]: () =>
        jsonResponse(201, { id: 300, lessonDate: '2026-12-03', slotId: 4, status: 'SCHEDULED', type: 'DROP_IN' }),
    })
    renderDropIn({ queryClient })
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('heading', { name: 'Lucas Díaz' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/students\/13$/)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Listo: Anotamos a Lucas Díaz el jueves 3 de diciembre, 18:00 a 20:00.',
    )
    expect(await requestsTo(fetchFn, POST)[0]?.clone().json()).toEqual({ slotId: 4, lessonDate: '2026-12-03' })
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: ['lessons', { from: '2026-11-20', to: '2027-02-20', slotId: null }], exact: true }),
    ).toBeDefined()
    await waitFor(() => expect(requestsTo(fetchFn, SLOTS).length).toBeGreaterThanOrEqual(2))
  })

  it('RF09_cancelGoesBackToTheProfile', async () => {
    stubApi(baseRoutes)
    renderDropIn({ state: { from: '/students?status=ACTIVE' } })

    expect(await screen.findByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/students/13')
  })

  it('RF09_theButtonSaysAnotandoWhileSending', async () => {
    stubApi({ ...baseRoutes, [POST]: () => new Promise<Response>(() => {}) })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('button', { name: 'Anotando…' })).toBeDisabled()
  })

  it.each([
    ['capacity_full', 'No queda lugar en esa clase. Elegí otra fecha.'],
    ['already_booked', 'El alumno ya está anotado en esa clase.'],
    ['lesson_already_started', 'Esa clase ya empezó. Elegí otra fecha.'],
    ['slot_inactive', 'Ese turno está desactivado: no admite reservas nuevas. Elegí otra clase.'],
  ])('RF09_%sShowsItsTextClearsTheChoiceAndRefreshesTheLists', async (code, text) => {
    const fetchFn = stubApi({ ...baseRoutes, [POST]: () => errorResponse(409, code, 'Mensaje de la API.') })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(`Error: ${text}`)
    expect(screen.getByRole('radio', { name: /Jue 3 de dic/ })).not.toBeChecked()
    await waitFor(() => expect(requestsTo(fetchFn, LESSONS).length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(requestsTo(fetchFn, STUDENT).length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(requestsTo(fetchFn, SLOTS).length).toBeGreaterThanOrEqual(2))
  })

  it('RF11_capacity_fullLeavesTheRowAsCompletaOnceTheListIsRead', async () => {
    let full = false
    stubApi({
      ...baseRoutes,
      [LESSONS]: () =>
        jsonResponse(200, full ? [apiLesson('2026-12-03', { freeSpots: 0 })] : [apiLesson('2026-12-03')]),
      [POST]: () => {
        full = true
        return errorResponse(409, 'capacity_full', 'x')
      },
    })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Jue 3 de dic/ })).toHaveAccessibleDescription('Completa'),
    )
  })

  it('DI41_already_bookedLeavesTheRowAsYaEstaAnotadoOnceTheStudentIsRead', async () => {
    let booked = false
    const added = {
      bookingId: 9,
      lessonDate: '2026-12-03',
      type: 'DROP_IN',
      slotId: 4,
      dayOfWeek: 4,
      startTime: '18:00',
      endTime: '20:00',
    }
    stubApi({
      ...baseRoutes,
      [STUDENT]: () =>
        jsonResponse(
          200,
          booked ? { ...lucasProfile, upcomingLessons: [...lucasProfile.upcomingLessons, added] } : lucasProfile,
        ),
      [POST]: () => {
        booked = true
        return errorResponse(409, 'already_booked', 'x')
      },
    })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Jue 3 de dic/ })).toHaveAccessibleDescription('Ya está anotado.'),
    )
  })

  it('DI44_invalid_lesson_dateShowsTheApiMessageClearsTheChoiceAndRefreshesTheLessons', async () => {
    const fetchFn = stubApi({
      ...baseRoutes,
      [POST]: () => errorResponse(400, 'invalid_lesson_date', 'Solo se puede reservar hasta 3 meses adelante.'),
    })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: Solo se puede reservar hasta 3 meses adelante.',
    )
    expect(screen.getByRole('radio', { name: /Jue 3 de dic/ })).not.toBeChecked()
    await waitFor(() => expect(requestsTo(fetchFn, LESSONS).length).toBeGreaterThanOrEqual(2))
  })

  it('RF09_aNotFoundWhereTheStudentStillExistsMeansTheSlotWithoutReadingTheMessage', async () => {
    const fetchFn = stubApi({ ...baseRoutes, [POST]: () => errorResponse(404, 'not_found', 'Cualquier texto.') })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Ese turno ya no existe. Elegí otra clase.')
    expect(screen.getByRole('radio', { name: /Jue 3 de dic/ })).not.toBeChecked()
    expect(requestsTo(fetchFn, STUDENT).length).toBeGreaterThanOrEqual(2)
    await waitFor(() => expect(requestsTo(fetchFn, SLOTS).length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(requestsTo(fetchFn, LESSONS).length).toBeGreaterThanOrEqual(2))
  })

  it('RF09_aNotFoundWhereTheStudentReadIsAlso404ShowsTheNotFoundScreen', async () => {
    let gone = false
    stubApi({
      ...baseRoutes,
      [STUDENT]: () => (gone ? errorResponse(404, 'not_found', 'Otro.') : jsonResponse(200, lucasProfile)),
      [POST]: () => {
        gone = true
        return errorResponse(404, 'not_found', 'Otro texto distinto.')
      },
    })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Error: No encontramos a este alumno.'))
  })

  it.each([
    ['enrollment_type_mismatch', 'La clase suelta es solo para alumnos de clase suelta.'],
    ['student_inactive', 'El alumno está inactivo.'],
  ])('RF09_%sShowsItsTextAndRefreshesTheStudent', async (code, text) => {
    const fetchFn = stubApi({ ...baseRoutes, [POST]: () => errorResponse(409, code, 'Mensaje de la API.') })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(`Error: ${text}`)
    await waitFor(() => expect(requestsTo(fetchFn, STUDENT).length).toBeGreaterThanOrEqual(2))
  })

  it('RF09_aTimeoutTellsNotToAssumeAnythingAndRefreshesTheStudent', async () => {
    const fetchFn = stubApi({
      ...baseRoutes,
      [POST]: () => Promise.reject(new DOMException('slow', 'TimeoutError')),
    })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La API tardó demasiado. No sabemos si se guardó: revisá la ficha antes de intentar de nuevo.',
    )
    await waitFor(() => expect(requestsTo(fetchFn, STUDENT).length).toBeGreaterThanOrEqual(2))
  })

  it('RF09_withoutConnectionNothingIsRetriedOnItsOwn', async () => {
    const fetchFn = stubApi({ ...baseRoutes, [POST]: () => Promise.reject(new TypeError('offline')) })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó nada.')
    expect(requestsTo(fetchFn, POST)).toHaveLength(1)
  })

  it('RF09_aServerFailureShowsTheGenericText', async () => {
    stubApi({ ...baseRoutes, [POST]: () => errorResponse(500, 'internal_error', 'boom') })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo falló en la API. Probá de nuevo en un rato.')
    expect(screen.getByRole('radio', { name: /Jue 3 de dic/ })).toBeChecked()
  })

  it('RF09_tooManyRequestsShowsTheApiMessage', async () => {
    stubApi({
      ...baseRoutes,
      [POST]: () => errorResponse(429, 'too_many_requests', 'Demasiados pedidos. Esperá un minuto.'),
    })
    renderDropIn()
    await chooseLesson(/Jue 3 de dic/)

    await userEvent.click(bookButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Demasiados pedidos. Esperá un minuto.')
  })
})
