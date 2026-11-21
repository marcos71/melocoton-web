import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'
import {
  brunoItem,
  lucasItem,
  luciaItem,
  luciaProfile,
  luisItem,
  mondaySlot,
  tuesdaySlot,
} from '../test/students'

const LIST = 'GET /api/v1/students'
const SLOTS = 'GET /api/v1/slots'

function param(request: Request | undefined, name: string): string | null {
  return request ? new URL(request.url).searchParams.get(name) : null
}

function renderList(path = '/students') {
  return renderApp({ role: 'LEAD_TEACHER', path })
}

describe('StudentsScreen', () => {
  it('RF04_showsALoadingTextWhileLoading', async () => {
    stubApi({ [LIST]: () => new Promise<Response>(() => {}), [SLOTS]: () => jsonResponse(200, []) })
    renderList()

    expect(await screen.findByText('Cargando alumnos…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alumnos' })).toHaveFocus()
    // The filters stay usable while it loads.
    expect(screen.getByRole('button', { name: 'Inactivos' })).toBeEnabled()
  })

  it('RF04_listsActiveStudentsByNameWithStatusModalityAndSlotAsText', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, [luisItem, lucasItem, luciaItem]),
      [SLOTS]: () => jsonResponse(200, [tuesdaySlot]),
    })
    renderList()

    const lucia = await screen.findByRole('link', {
      name: 'Lucía Pérez, Activo, Mensual, Martes 18:00 a 20:00',
    })
    expect(lucia).toHaveAttribute('href', '/students/11')
    expect(screen.getByRole('link', { name: 'Luis Gómez, Activo, Mensual, Sin turno fijo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lucas Díaz, Activo, Clase suelta' })).toBeInTheDocument()
    // Sorted by name: Lucas, Lucía, Luis.
    const names = screen.getAllByRole('link', { name: /Activo/ }).map((link) => link.textContent)
    expect(names).toEqual(['Lucas Díaz', 'Lucía Pérez', 'Luis Gómez'])
    expect(screen.getByText('Sin turno fijo').tagName).toBe('STRONG')
    expect(screen.getByText('3 alumnos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Nuevo alumno' })).toHaveAttribute('href', '/students/new')
    expect(param(requestsTo(fetchFn, LIST)[0], 'status')).toBe('ACTIVE')
    expect(param(requestsTo(fetchFn, SLOTS)[0], 'status')).toBe('ACTIVE')
  })

  it('RF04_eachRowKeepsTheNameModalitySlotAndStatusInSeparateCells', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, [luciaItem]), [SLOTS]: () => jsonResponse(200, []) })
    renderList()

    await screen.findByRole('link', { name: /Lucía Pérez/ })
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual(['Nombre', 'Modalidad', 'Turno fijo', 'Estado'])
    const [, row] = screen.getAllByRole('row')
    const cells = within(row as HTMLElement).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'Lucía Pérez',
      'Mensual',
      'Martes 18:00 a 20:00',
      'Activo',
    ])
  })

  it('RF04_anInactiveStudentIsLabelledInactivoWithText', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, [brunoItem]), [SLOTS]: () => jsonResponse(200, []) })
    renderList('/students?status=inactive')

    expect(
      await screen.findByRole('link', { name: 'Bruno Ríos, Inactivo, Mensual, Sin turno fijo' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Inactivo', { selector: 'span' })).toBeInTheDocument()
  })

  it('RF04_countsOneStudentInTheSingular', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, [luciaItem]), [SLOTS]: () => jsonResponse(200, []) })
    renderList()

    expect(await screen.findByText('1 alumno')).toBeInTheDocument()
  })

  it('RF04_theStatusModalityAndSlotFiltersLiveInTheUrlAndInTheRequest', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, [luciaItem]),
      [SLOTS]: () => jsonResponse(200, [tuesdaySlot, mondaySlot]),
    })
    renderList()
    await screen.findByRole('link', { name: /Lucía Pérez/ })

    await userEvent.click(screen.getByRole('button', { name: 'Todos' }))
    await userEvent.selectOptions(screen.getByLabelText('Modalidad'), 'monthly')
    await userEvent.selectOptions(screen.getByLabelText('Turno fijo'), 'Martes 18:00 a 20:00')

    await waitFor(() => {
      const last = requestsTo(fetchFn, LIST).at(-1)
      expect(param(last, 'status')).toBe('ALL')
      expect(param(last, 'enrollmentType')).toBe('MONTHLY')
      expect(param(last, 'slotId')).toBe('3')
    })
    const location = screen.getByTestId('location').textContent ?? ''
    expect(location).toContain('status=all')
    expect(location).toContain('type=monthly')
    expect(location).toContain('slot=3')
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    // The options of the slot filter are in order of the week.
    const options = within(screen.getByLabelText('Turno fijo')).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Todos', 'Lunes 10:00 a 12:00', 'Martes 18:00 a 20:00'])
  })

  it('RF04_goingBackToActiveAndAllRemovesTheParameters', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, [luciaItem]), [SLOTS]: () => jsonResponse(200, []) })
    renderList('/students?status=all&type=drop-in')
    await screen.findByRole('link', { name: /Lucía Pérez/ })

    await userEvent.click(screen.getByRole('button', { name: 'Activos' }))
    await userEvent.selectOptions(screen.getByLabelText('Modalidad'), '')

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/students$/))
  })

  it('RF04_readsTheFiltersOfTheUrlWhenOpened', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, [luciaItem]),
      [SLOTS]: () => jsonResponse(200, [tuesdaySlot]),
    })
    renderList('/students?status=inactive&type=drop-in&slot=3')

    await screen.findByRole('link', { name: /Lucía Pérez/ })
    const [request] = requestsTo(fetchFn, LIST)
    expect(param(request, 'status')).toBe('INACTIVE')
    expect(param(request, 'enrollmentType')).toBe('DROP_IN')
    expect(param(request, 'slotId')).toBe('3')
    expect(screen.getByRole('button', { name: 'Inactivos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Modalidad')).toHaveValue('drop-in')
    await waitFor(() => expect(screen.getByLabelText('Turno fijo')).toHaveValue('3'))
  })

  it('RF04_anInvalidValueInTheUrlIsIgnoredSoTheApiNeverGetsAMalformedFilter', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, [luciaItem]),
      [SLOTS]: () => jsonResponse(200, []),
    })
    renderList('/students?status=bogus&type=weekly&slot=abc')

    await screen.findByRole('link', { name: /Lucía Pérez/ })
    const [request] = requestsTo(fetchFn, LIST)
    expect(param(request, 'status')).toBe('ACTIVE')
    expect(param(request, 'enrollmentType')).toBeNull()
    expect(param(request, 'slotId')).toBeNull()
  })

  it('RF04_aSlotOfTheUrlThatIsNoLongerActiveKeepsAnOptionSoTheFilterIsNotLostSilently', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, []), [SLOTS]: () => jsonResponse(200, [tuesdaySlot]) })
    renderList('/students?slot=9')

    await screen.findByRole('option', { name: 'Turno 9 (inactivo)' })
    expect(screen.getByLabelText('Turno fijo')).toHaveValue('9')
  })

  it('RF04_theSearchFiltersInThePwaIgnoringCaseAndAccentsAndIsKeptInTheUrl', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, [luciaItem, luisItem, lucasItem]),
      [SLOTS]: () => jsonResponse(200, []),
    })
    renderList()
    await screen.findByText('3 alumnos')

    await userEvent.type(screen.getByLabelText('Buscar por nombre'), 'LUCIA')

    expect(await screen.findByText('1 alumno')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Lucía Pérez/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Luis Gómez/ })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('q=LUCIA'))
    // The search does not ask the API again.
    expect(requestsTo(fetchFn, LIST)).toHaveLength(1)
  })

  it('RF04_theSearchMatchesAnyPartOfTheNameAndTheClearButtonEmptiesIt', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, [luciaItem, luisItem]),
      [SLOTS]: () => jsonResponse(200, []),
    })
    renderList('/students?q=pérez')

    expect(await screen.findByText('1 alumno')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar por nombre')).toHaveValue('pérez')

    await userEvent.click(screen.getByRole('button', { name: 'Borrar búsqueda' }))

    expect(await screen.findByText('2 alumnos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/students$/))
  })

  it.each([
    ['active', 'No hay alumnos activos.'],
    ['inactive', 'No hay alumnos inactivos.'],
  ])('RF04_showsTheEmptyTextOfTheStatus_%s', async (status, text) => {
    stubApi({ [LIST]: () => jsonResponse(200, []), [SLOTS]: () => jsonResponse(200, []) })
    renderList(`/students?status=${status}`)

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument()
  })

  it('RF04_withNoStudentsAtAllItInvitesToCreateTheFirstOne', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, []), [SLOTS]: () => jsonResponse(200, []) })
    renderList('/students?status=all')

    expect(await screen.findByText('Todavía no hay alumnos.')).toBeInTheDocument()
    expect(screen.getByText(/Creá el primero con/)).toHaveTextContent('Creá el primero con Nuevo alumno.')
  })

  it('RF04_whenFiltersLeaveNoStudentsItOffersToRemoveThem', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, [luciaItem]), [SLOTS]: () => jsonResponse(200, []) })
    renderList('/students?status=all&q=zzz')

    expect(await screen.findByText('Ningún alumno coincide con los filtros.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }))

    expect(await screen.findByRole('link', { name: /Lucía Pérez/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar por nombre')).toHaveValue('')
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/students$/)
  })

  it('RF04_showsTheErrorAfterOneRetryOfTheReadAndRecoversOnRetry', async () => {
    let up = false
    const fetchFn = stubApi({
      [LIST]: () =>
        up ? jsonResponse(200, [luciaItem]) : errorResponse(500, 'internal_error', 'Algo salió mal.'),
      [SLOTS]: () => jsonResponse(200, []),
    })
    renderList()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Error:')
    expect(alert).toHaveTextContent('No se pudo cargar la lista.')
    expect(alert).toHaveTextContent('Algo falló en la API. Probá de nuevo en un rato.')
    expect(requestsTo(fetchFn, LIST)).toHaveLength(2)

    up = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('link', { name: /Lucía Pérez/ })).toBeInTheDocument()
  })

  it('RF04_ifOnlyTheSlotsFailTheListShowsAndTheSlotFilterIsDisabledWithAReason', async () => {
    let slotsUp = false
    stubApi({
      [LIST]: () => jsonResponse(200, [luciaItem]),
      [SLOTS]: () =>
        slotsUp ? jsonResponse(200, [tuesdaySlot]) : errorResponse(500, 'internal_error', 'x'),
    })
    renderList()

    expect(await screen.findByRole('link', { name: /Lucía Pérez/ })).toBeInTheDocument()
    expect(await screen.findByText(/No se pudieron cargar los turnos\./)).toBeInTheDocument()
    expect(screen.getByLabelText('Turno fijo')).toBeDisabled()
    expect(screen.getByLabelText('Turno fijo')).toHaveAccessibleDescription(/No se pudieron cargar los turnos\./)

    slotsUp = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(screen.getByLabelText('Turno fijo')).toBeEnabled())
    expect(screen.queryByText(/No se pudieron cargar los turnos\./)).not.toBeInTheDocument()
  })

  it('RF04_openingAStudentKeepsTheFiltersSoTheBackLinkReturnsToTheSameList', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, [luciaItem]),
      [SLOTS]: () => jsonResponse(200, []),
      'GET /api/v1/students/11': () => jsonResponse(200, luciaProfile),
    })
    renderList('/students?status=all&type=monthly')

    await userEvent.click(await screen.findByRole('link', { name: /Lucía Pérez/ }))

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    const back = screen.getByRole('link', { name: 'Volver a Alumnos' })
    expect(back).toHaveAttribute('href', '/students?status=all&type=monthly')
  })
})
