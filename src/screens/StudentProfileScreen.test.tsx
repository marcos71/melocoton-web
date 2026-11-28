import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'
import {
  brunoProfile,
  lesson,
  lucasProfile,
  luciaProfile,
  luisProfile,
  tuesdaySlot,
} from '../test/students'

const SLOTS = 'GET /api/v1/slots'

beforeEach(() => {
  // 12:00 in the workshop on Friday 20 November 2026.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T15:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function renderProfile(id: number, options: { state?: unknown } = {}) {
  return renderApp({ role: 'LEAD_TEACHER', path: `/students/${id}`, state: options.state })
}

function profileRoute(id: number, body: unknown) {
  return { [`GET /api/v1/students/${id}`]: () => jsonResponse(200, body) }
}

describe('StudentProfileScreen: monthly student', () => {
  it('RF04_showsALoadingTextWhileLoading', async () => {
    stubApi({ 'GET /api/v1/students/11': () => new Promise<Response>(() => {}) })
    renderProfile(11)

    expect(await screen.findByText('Cargando ficha…')).toBeInTheDocument()
  })

  it('RF04_showsTheDataTheFixedSlotAndTheUpcomingClasses', async () => {
    const fetchFn = stubApi(profileRoute(11, luciaProfile))
    renderProfile(11)

    const heading = await screen.findByRole('heading', { name: 'Lucía Pérez' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    const data = screen.getByRole('region', { name: 'Datos' })
    expect(within(data).getByText('Mensual')).toBeInTheDocument()
    expect(within(data).getByText('2 de nov de 2026')).toBeInTheDocument()
    expect(within(data).getByText('lucia@ejemplo.com')).toBeInTheDocument()
    expect(
      within(data).getByRole('link', { name: 'Llamar a Lucía Pérez, 11 5555-0101' }),
    ).toHaveAttribute('href', 'tel:1155550101')
    expect(within(data).getByRole('link', { name: 'Editar datos' })).toHaveAttribute(
      'href',
      '/students/11/edit',
    )
    const fixed = screen.getByRole('region', { name: 'Turno fijo' })
    expect(within(fixed).getByText('Martes 18:00 a 20:00')).toBeInTheDocument()
    expect(within(fixed).getByRole('link', { name: 'Cambiar turno fijo' })).toHaveAttribute(
      'href',
      '/students/11/fixed-slot',
    )
    const lessons = screen.getByRole('region', { name: 'Próximas clases' })
    const items = within(lessons).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Mar 24 de nov · 18:00 a 20:00')
    expect(items[0]).toHaveTextContent('Fija')
    expect(items[1]).toHaveTextContent('Mar 1 de dic · 18:00 a 20:00')
    // A monthly student is not offered a drop-in class, and nothing can be cancelled.
    expect(screen.queryByRole('link', { name: 'Anotar clase suelta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelar/ })).not.toBeInTheDocument()
    // It does not ask for the slots when the student already has one.
    expect(requestsTo(fetchFn, SLOTS)).toHaveLength(0)
  })

  it('RF08_withoutAFixedSlotTheNextThingToDoIsAssigningOne', async () => {
    stubApi({ ...profileRoute(12, luisProfile), [SLOTS]: () => jsonResponse(200, [tuesdaySlot]) })
    renderProfile(12)

    await screen.findByRole('heading', { name: 'Luis Gómez' })
    expect(screen.getByText('Todavía no tiene turno fijo.').tagName).toBe('STRONG')
    expect(await screen.findByRole('link', { name: 'Asignar turno fijo' })).toHaveAttribute(
      'href',
      '/students/12/fixed-slot',
    )
    expect(
      screen.getByText('No tiene clases próximas. Asignale un turno fijo para generarlas.'),
    ).toBeInTheDocument()
  })

  it('RF08_whenThereAreNoActiveSlotsAssigningIsUnavailableWithTheReasonAndALinkToSlots', async () => {
    stubApi({ ...profileRoute(12, luisProfile), [SLOTS]: () => jsonResponse(200, []) })
    renderProfile(12)

    const button = await screen.findByRole('button', { name: 'Asignar turno fijo' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('Todavía no hay turnos. Crealos en Turnos.')
    expect(screen.queryByRole('link', { name: 'Asignar turno fijo' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Turnos' })).toHaveAttribute('href', '/slots')
  })

  it('RF08_withAFixedSlotButNoClassesItSaysSo', async () => {
    stubApi(profileRoute(11, { ...luciaProfile, upcomingLessons: [] }))
    renderProfile(11)

    expect(await screen.findByText('No tiene clases próximas.')).toBeInTheDocument()
  })

  it('RF05_anInactiveStudentShowsTheReasonInsteadOfTheActionsButCanBeEdited', async () => {
    stubApi(profileRoute(14, brunoProfile))
    renderProfile(14)

    await screen.findByRole('heading', { name: 'Bruno Ríos' })
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    const assign = screen.getByRole('button', { name: 'Asignar turno fijo' })
    expect(assign).toHaveAttribute('aria-disabled', 'true')
    expect(assign).toHaveAccessibleDescription(
      'El alumno está inactivo: no se le asignan turnos ni clases.',
    )
    expect(screen.getByRole('link', { name: 'Editar datos' })).toBeInTheDocument()
  })

  it('RF05_anInactiveMonthlyStudentWithASlotCannotChangeIt', async () => {
    stubApi(profileRoute(14, { ...brunoProfile, fixedSlot: luciaProfile.fixedSlot }))
    renderProfile(14)

    const change = await screen.findByRole('button', { name: 'Cambiar turno fijo' })
    expect(change).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('link', { name: 'Cambiar turno fijo' })).not.toBeInTheDocument()
  })

  it('RF04_showsOnlySixClassesAndUnfoldsTheRestWithTheButton', async () => {
    const eight = Array.from({ length: 8 }, (_, i) =>
      lesson(300 + i, `2026-12-${String(i + 1).padStart(2, '0')}`, 'FIXED'),
    )
    stubApi(profileRoute(11, { ...luciaProfile, upcomingLessons: eight }))
    renderProfile(11)
    const lessons = await screen.findByRole('region', { name: 'Próximas clases' })
    expect(within(lessons).getAllByRole('listitem')).toHaveLength(6)

    const toggle = screen.getByRole('button', { name: 'Ver las 8 clases' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)

    expect(within(lessons).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Ver menos clases' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('RF04_withSixClassesOrFewerThereIsNoUnfoldButton', async () => {
    stubApi(profileRoute(11, luciaProfile))
    renderProfile(11)
    await screen.findByRole('heading', { name: 'Lucía Pérez' })

    expect(screen.queryByRole('button', { name: /Ver las/ })).not.toBeInTheDocument()
  })

  it('DI57_seeTheirPiecesOpensPiecesFilteredByTheStudent', async () => {
    stubApi({
      ...profileRoute(11, luciaProfile),
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
      'GET /api/v1/students/directory': () => jsonResponse(200, []),
    })
    renderProfile(11)

    await userEvent.click(await screen.findByRole('link', { name: 'Ver sus piezas' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/pieces?student=11')
  })
})

describe('StudentProfileScreen: drop-in student', () => {
  it('RF09_showsNoFixedSlotSectionAndOffersToBookADropInClass', async () => {
    stubApi(profileRoute(13, lucasProfile))
    renderProfile(13)

    await screen.findByRole('heading', { name: 'Lucas Díaz' })
    expect(screen.queryByRole('region', { name: 'Turno fijo' })).not.toBeInTheDocument()
    expect(screen.queryByText('Ingreso')).not.toBeInTheDocument()
    expect(screen.getByText('Clase suelta', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Anotar clase suelta' })).toHaveAttribute(
      'href',
      '/students/13/drop-in/new',
    )
    const item = within(screen.getByRole('region', { name: 'Próximas clases' })).getByRole('listitem')
    expect(item).toHaveTextContent('Jue 26 de nov · 10:00 a 12:00')
    expect(item).toHaveTextContent('Suelta')
    expect(
      within(item).getByRole('button', {
        name: 'Cancelar la clase suelta del jueves 26 de noviembre, 10:00',
      }),
    ).toBeInTheDocument()
  })

  it('RF09_withoutBookedClassesItSaysSo', async () => {
    stubApi(profileRoute(13, { ...lucasProfile, upcomingLessons: [] }))
    renderProfile(13)

    expect(await screen.findByText('No tiene clases sueltas anotadas.')).toBeInTheDocument()
  })

  it('RF09_anInactiveDropInStudentCannotBookAndHasNoCancelButtons', async () => {
    stubApi(profileRoute(13, { ...lucasProfile, active: false }))
    renderProfile(13)

    const book = await screen.findByRole('button', { name: 'Anotar clase suelta' })
    expect(book).toHaveAttribute('aria-disabled', 'true')
    expect(book).toHaveAccessibleDescription(
      'El alumno está inactivo: no se le asignan turnos ni clases.',
    )
    expect(screen.queryByRole('link', { name: 'Anotar clase suelta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelar la clase suelta/ })).not.toBeInTheDocument()
  })

  it('RF11_aDropInClassThatAlreadyStartedCannotBeCancelledAndSaysSo', async () => {
    // 14:00 in the workshop on the 26th: the 10:00 class started.
    vi.setSystemTime(new Date('2026-11-26T17:00:00Z'))
    stubApi(profileRoute(13, lucasProfile))
    renderProfile(13)

    expect(await screen.findByText('Ya empezó: no se puede cancelar.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelar la clase suelta/ })).not.toBeInTheDocument()
  })
})

describe('StudentProfileScreen: cancel a drop-in class', () => {
  const CANCEL = 'POST /api/v1/students/13/drop-in-bookings/201/cancel'
  const PROFILE = 'GET /api/v1/students/13'

  async function openDialog() {
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Cancelar la clase suelta del jueves 26 de noviembre, 10:00',
      }),
    )
    return screen.getByRole('alertdialog')
  }

  it('CU04_C1_askForConfirmationWithASpecificSafeOptionAndSendsNothingOnVolver', async () => {
    const fetchFn = stubApi(profileRoute(13, lucasProfile))
    renderProfile(13)

    const dialog = await openDialog()

    expect(dialog).toHaveAccessibleName('¿Cancelar la clase suelta del jueves 26 de noviembre, 10:00?')
    expect(dialog).toHaveAccessibleDescription(
      'Se libera el lugar. No genera recuperación y, si la pagó, el pago no cambia.',
    )
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toHaveFocus()
    const labels = within(dialog).getAllByRole('button').map((b) => b.textContent)
    expect(labels).toEqual(['Volver', 'Cancelar clase'])

    await userEvent.click(within(dialog).getByRole('button', { name: 'Volver' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(requestsTo(fetchFn, CANCEL)).toHaveLength(0)
  })

  it('CU04_C1_confirmingCancelsTheClassRefreshesTheProfileAndShowsTheNotice', async () => {
    let cancelled = false
    const fetchFn = stubApi({
      [PROFILE]: () =>
        jsonResponse(200, cancelled ? { ...lucasProfile, upcomingLessons: [] } : lucasProfile),
      [CANCEL]: () => {
        cancelled = true
        return jsonResponse(200, {
          id: 201,
          lessonDate: '2026-11-26',
          slotId: 5,
          status: 'CANCELLED',
          type: 'DROP_IN',
        })
      },
    })
    renderProfile(13)
    const dialog = await openDialog()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar clase' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Listo: Cancelamos la clase del Jue 26 de nov.',
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await screen.findByText('No tiene clases sueltas anotadas.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximas clases' })).toHaveFocus()
    expect(requestsTo(fetchFn, CANCEL)).toHaveLength(1)
    expect(requestsTo(fetchFn, PROFILE)).toHaveLength(2)
  })

  it('CU04_C1_theConfirmButtonSaysCancelandoWhileSending', async () => {
    stubApi({ ...profileRoute(13, lucasProfile), [CANCEL]: () => new Promise<Response>(() => {}) })
    renderProfile(13)
    const dialog = await openDialog()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar clase' }))

    expect(await within(dialog).findByRole('button', { name: 'Cancelando…' })).toBeDisabled()
  })

  it.each([
    ['lesson_already_started', 409, 'La clase ya empezó, así que no se puede cancelar.'],
    ['status_conflict', 409, 'La clase ya no está prevista, así que no se puede cancelar.'],
    ['not_found', 404, 'No encontramos esa clase. Actualizamos la lista.'],
  ])('CU04_C1_%sShowsItsTextAboveTheClassesAndRefreshesTheProfile', async (code, status, text) => {
    const fetchFn = stubApi({
      ...profileRoute(13, lucasProfile),
      [CANCEL]: () => errorResponse(status, code, 'Mensaje de la API.'),
    })
    renderProfile(13)
    const dialog = await openDialog()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar clase' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(`Error: ${text}`)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // The alert comes before the "Próximas clases" title.
    const title = screen.getByRole('heading', { name: 'Próximas clases' })
    expect(alert.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(requestsTo(fetchFn, PROFILE)).toHaveLength(2))
  })

  it('CU04_C1_withoutConnectionTheErrorSaysNothingChangedAndIsNotRetried', async () => {
    const fetchFn = stubApi({
      ...profileRoute(13, lucasProfile),
      [CANCEL]: () => Promise.reject(new TypeError('offline')),
    })
    renderProfile(13)
    const dialog = await openDialog()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar clase' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar. Revisá tu conexión e intentá de nuevo. No se guardó nada.',
    )
    expect(requestsTo(fetchFn, CANCEL)).toHaveLength(1)
  })

  it('CU04_C1_aServerFailureShowsTheGenericText', async () => {
    stubApi({
      ...profileRoute(13, lucasProfile),
      [CANCEL]: () => errorResponse(500, 'internal_error', 'boom'),
    })
    renderProfile(13)
    const dialog = await openDialog()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar clase' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Algo falló en la API. Probá de nuevo en un rato.',
    )
  })
})

describe('StudentProfileScreen: states', () => {
  it('RF04_aMissingStudentShowsTheErrorWithoutRetryAndALinkBack', async () => {
    const fetchFn = stubApi({
      'GET /api/v1/students/99': () => errorResponse(404, 'not_found', 'No existe ese alumno.'),
    })
    renderProfile(99)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Error: No encontramos a este alumno.')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver a Alumnos' })).toHaveAttribute('href', '/students')
    expect(requestsTo(fetchFn, 'GET /api/v1/students/99')).toHaveLength(1)
  })

  it('RF04_anIdThatIsNotANumberIsNotFoundWithoutAskingTheApi', async () => {
    const fetchFn = stubApi({})
    renderApp({ role: 'LEAD_TEACHER', path: '/students/abc' })

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos a este alumno.')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('RF04_aFailedReadShowsTheErrorAndRecoversOnRetry', async () => {
    let up = false
    const fetchFn = stubApi({
      'GET /api/v1/students/11': () =>
        up ? jsonResponse(200, luciaProfile) : errorResponse(503, 'unavailable', 'Caída.'),
    })
    renderProfile(11)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se pudo cargar la ficha.')
    expect(alert).toHaveTextContent('Algo falló en la API. Probá de nuevo en un rato.')
    expect(requestsTo(fetchFn, 'GET /api/v1/students/11')).toHaveLength(2)

    up = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { name: 'Lucía Pérez' })).toBeInTheDocument()
  })

  it('RF04_aNoticeFromThePreviousScreenIsShownAndCanBeClosed', async () => {
    stubApi(profileRoute(11, luciaProfile))
    renderProfile(11, { state: { notice: { kind: 'success', text: 'Guardamos los cambios.' } } })

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    expect(screen.getByRole('status')).toHaveTextContent('Listo: Guardamos los cambios.')

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))

    expect(screen.queryByText(/Guardamos los cambios/)).not.toBeInTheDocument()
  })

  it('RF04_theBackLinkReturnsToTheListWithItsFilters', async () => {
    stubApi(profileRoute(11, luciaProfile))
    renderProfile(11, { state: { from: '/students?status=all&q=lu' } })

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    const back = screen.getByRole('link', { name: 'Volver a Alumnos' })
    expect(back).toHaveAttribute('href', '/students?status=all&q=lu')
  })

  it('RF04_withoutASavedListTheBackLinkGoesToTheList', async () => {
    stubApi(profileRoute(11, luciaProfile))
    renderProfile(11)

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    expect(screen.getByRole('link', { name: 'Volver a Alumnos' })).toHaveAttribute(
      'href',
      '/students',
    )
  })

  it('RF04_theSubscreensKeepTheListUrlInTheirLinks', async () => {
    stubApi(profileRoute(11, luciaProfile))
    renderProfile(11, { state: { from: '/students?q=lu' } })

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    await userEvent.click(screen.getByRole('link', { name: 'Editar datos' }))

    expect(await screen.findByRole('heading', { name: 'Editar datos' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Volver a Ficha' }))

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    expect(screen.getByRole('link', { name: 'Volver a Alumnos' })).toHaveAttribute(
      'href',
      '/students?q=lu',
    )
  })
})
