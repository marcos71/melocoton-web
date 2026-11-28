import { readFileSync } from 'node:fs'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'
import { lucia, mateo, page, param, piece } from './pieceListFixtures'

const LIST = 'GET /api/v1/pieces'
const DIRECTORY = 'GET /api/v1/students/directory'

const bowl = piece(3, { name: 'Bowl azul' })
const finishedCup = piece(4, {
  name: 'Taza lista',
  status: 'FINISHED',
  advanceTo: null,
  revertTo: 'GLAZED',
})

const advancedBowl = {
  ...bowl,
  status: 'GLAZED',
  advanceTo: 'FINISHED',
  revertTo: 'BISQUE_FIRED',
  notes: null,
  createdAt: '2026-10-01T10:00:00Z',
  history: [],
}

function renderList(path = '/pieces') {
  return renderApp({ role: 'LEAD_TEACHER', path })
}

const location = () => screen.getByTestId('location')

describe('PiecesScreen', () => {
  it('RF32_studentAndStatusFiltersLiveInTheUrlAndInTheRequest', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList('/pieces?student=7&status=BISQUE_FIRED')

    expect(await screen.findByRole('link', { name: 'Bowl azul, de Lucía P., Bizcochada' })).toHaveAttribute(
      'href',
      '/pieces/3',
    )
    const [first] = requestsTo(fetchFn, LIST)
    expect(param(first, 'studentId')).toBe('7')
    expect(param(first, 'status')).toBe('BISQUE_FIRED')
    expect(param(first, 'limit')).toBe('100')
    expect(param(first, 'cursor')).toBeNull()
    expect(screen.getByRole('button', { name: 'Bizcochada' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Esmaltada' }))

    await waitFor(() => expect(location()).toHaveTextContent('/pieces?student=7&status=GLAZED'))
    await waitFor(() => expect(param(requestsTo(fetchFn, LIST).at(-1), 'status')).toBe('GLAZED'))
  })

  it('RF32_anInvalidFilterInTheUrlIsIgnored', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList('/pieces?student=abc&status=NOPE')

    await screen.findByRole('link', { name: /Bowl azul/ })
    const [first] = requestsTo(fetchFn, LIST)
    expect(param(first, 'studentId')).toBeNull()
    expect(param(first, 'status')).toBeNull()
  })

  it('DI85_choosingAStudentInThePickerWritesTheUrlAndTheRequest', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia, mateo]),
    })
    renderList()
    await screen.findByRole('link', { name: /Bowl azul/ })

    await userEvent.click(await screen.findByRole('button', { name: /Alumno/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Lucía P.' }))

    await waitFor(() => expect(location()).toHaveTextContent('/pieces?student=7'))
    await waitFor(() => expect(param(requestsTo(fetchFn, LIST).at(-1), 'studentId')).toBe('7'))
    expect(requestsTo(fetchFn, DIRECTORY)[0]).toBeDefined()
    expect(param(requestsTo(fetchFn, DIRECTORY)[0], 'status')).toBe('ALL')
  })

  it('RF31_listsPiecesOfInactiveStudentsMarkedInThePicker', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([piece(5, { name: 'Jarra', student: { id: 8, name: 'Mateo R.' } })])),
      [DIRECTORY]: () => jsonResponse(200, [lucia, mateo]),
    })
    renderList()
    await screen.findByRole('link', { name: 'Jarra, de Mateo R., Bizcochada' })

    await userEvent.click(await screen.findByRole('button', { name: /Alumno/ }))

    expect(await screen.findByRole('option', { name: 'Mateo R. (inactivo)' })).toBeInTheDocument()
  })

  it('RF31_showsALoadingTextWhileLoading', async () => {
    stubApi({
      [LIST]: () => new Promise<Response>(() => {}),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()

    expect(await screen.findByText('Cargando las piezas…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Piezas' })).toHaveFocus()
    // The filters stay usable while it loads.
    expect(screen.getByRole('button', { name: 'Esmaltada' })).toBeEnabled()
  })

  it('RF31_showsTheErrorAfterOneRetryAndRecovers', async () => {
    let calls = 0
    const fetchFn = stubApi({
      [LIST]: () => {
        calls += 1
        return calls <= 2
          ? errorResponse(503, 'unavailable', 'No disponible')
          : jsonResponse(200, page([bowl]))
      },
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()

    expect(await screen.findByText('No pudimos cargar las piezas')).toBeInTheDocument()
    expect(requestsTo(fetchFn, LIST)).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('link', { name: /Bowl azul/ })).toBeInTheDocument()
  })

  it('RF31_theCardsShowTheStatusAsTextAndTheCountLineSaysHowMany', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, finishedCup])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()

    const card = (await screen.findByRole('link', { name: /Bowl azul/ })).closest('li') as HTMLElement
    expect(within(card).getByText('Bizcochada')).toBeInTheDocument()
    expect(within(card).getByText('De Lucía P.')).toBeInTheDocument()
    expect(screen.getByText('2 piezas')).toBeInTheDocument()
    expect(screen.getByText('Las piezas anuladas no se muestran.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nueva pieza' })).toHaveAttribute('href', '/pieces/new')
  })

  it('RF24_newPieceKeepsTheStudentOfTheFilter', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList('/pieces?student=7')

    expect(await screen.findByRole('link', { name: 'Nueva pieza' })).toHaveAttribute(
      'href',
      '/pieces/new?student=7',
    )
  })

  it('CU15_emptyWithoutFiltersInvitesToCreateTheFirstPiece', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList()

    expect(await screen.findByRole('heading', { name: 'Todavía no hay piezas' })).toBeInTheDocument()
    expect(screen.getByText(/Creá la primera con/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Seleccionar varias' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).not.toBeInTheDocument()
  })

  it('CU15_emptyWithFiltersNamesTheFilterAndOffersToRemoveThem', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList('/pieces?student=7&status=GLAZED')

    expect(await screen.findByRole('heading', { name: 'No hay piezas con este filtro' })).toBeInTheDocument()
    expect(screen.getByText('Lucía P. no tiene piezas esmaltadas.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }))

    await waitFor(() => expect(location()).toHaveTextContent(/^\/pieces$/))
  })

  it('CU15_emptyWithOnlyAStatusNamesTheStatus', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList('/pieces?status=IN_PROGRESS')

    expect(await screen.findByText('No hay piezas en proceso.')).toBeInTheDocument()
  })

  it('RNF01_advancesAPieceFromTheListInTwoTaps', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      'POST /api/v1/pieces/3/change-status': () => jsonResponse(200, advancedBowl),
    })
    renderList()
    const advance = await screen.findByRole('button', { name: 'Pasar a Esmaltada' })

    // Tap 1: the button. Tap 2: the confirmation.
    await userEvent.click(advance)
    const dialog = screen.getByRole('alertdialog', { name: 'Avance individual' })
    expect(dialog).toHaveTextContent('Bowl azul · Lucía P. pasa de Bizcochada a Esmaltada.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Bowl azul pasó a Esmaltada.')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    const [post] = requestsTo(fetchFn, 'POST /api/v1/pieces/3/change-status')
    expect(await post?.json()).toEqual({ expectedStatus: 'BISQUE_FIRED', newStatus: 'GLAZED' })
  })

  it('DI87_anIndividualAdvanceRefreshesTheLoadedPages', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      'POST /api/v1/pieces/3/change-status': () => jsonResponse(200, advancedBowl),
    })
    renderList()
    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await screen.findByText('Bowl azul pasó a Esmaltada.')
    await waitFor(() => expect(requestsTo(fetchFn, LIST).length).toBeGreaterThanOrEqual(2))
  })

  it('RF26_cancellingTheAdvanceReturnsTheFocusToItsButton', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([bowl])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList()
    const advance = await screen.findByRole('button', { name: 'Pasar a Esmaltada' })

    await userEvent.click(advance)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(advance).toHaveFocus()
  })

  it('RN04_aPieceWithoutAdvanceToHasNoAdvanceButton', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([finishedCup])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()

    await screen.findByRole('link', { name: /Taza lista/ })
    expect(screen.queryByRole('button', { name: /^Pasar a/ })).not.toBeInTheDocument()
  })

  it('D34_aChangedPieceShowsTheConflictAndRefreshesTheList', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      'POST /api/v1/pieces/3/change-status': () =>
        jsonResponse(409, {
          error: {
            code: 'status_conflict',
            message: 'Cambió.',
            details: { pieces: [{ id: 3, name: 'Bowl azul', reason: 'CHANGED' }] },
          },
        }),
    })
    renderList()
    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Error: No se aplicó el cambio. Alguien cambió Bowl azul mientras tanto. Actualizamos la lista: revisá su estado y volvé a intentar.',
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchFn, LIST).length).toBeGreaterThanOrEqual(2))
  })

  it('RN20_aPieceVoidedMeanwhileIsNamedInTheError', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      'POST /api/v1/pieces/3/change-status': () =>
        jsonResponse(409, {
          error: {
            code: 'status_conflict',
            message: 'Cambió.',
            details: { pieces: [{ id: 3, name: 'Bowl azul', reason: 'VOIDED' }] },
          },
        }),
    })
    renderList()
    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: No se aplicó el cambio. Bowl azul fue anulada mientras tanto.',
    )
  })

  it('RF30_anUnreachableApiOnAnAdvanceSaysNothingWasSaved', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      'POST /api/v1/pieces/3/change-status': () => Promise.reject(new TypeError('offline')),
    })
    renderList()
    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó nada')
  })

  it('RF29_selectSeveralIsDisabledWithAReasonOnFinished', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([finishedCup])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList('/pieces?status=FINISHED')

    const button = await screen.findByRole('button', { name: 'Seleccionar varias' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('Las piezas Terminadas no tienen estado siguiente.')
  })

  it('RNF02_thePressedChipShowsACheckMark', () => {
    const css = readFileSync('src/components/StatusFilter.module.css', 'utf8')

    expect(css).toMatch(/\.pressed::before\s*\{[^}]*content:\s*'✓/)
  })

  it('RNF02_thePressedChipKeepsItsAriaPressedState', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([bowl])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList()
    await screen.findByRole('link', { name: /Bowl azul/ })

    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Terminada' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('DI87_theCountSaysLoadedAndThatThereAreMore', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, finishedCup], 'c2')),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()

    expect(await screen.findByText('2 piezas cargadas. Hay más.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargar más piezas' })).toBeInTheDocument()
  })

  it('DI87_loadMoreKeepsTheFiltersInTheNextRequest', async () => {
    const fetchFn = stubApi({
      [LIST]: (request) =>
        jsonResponse(
          200,
          param(request, 'cursor') === 'c2' ? page([piece(9, { name: 'Plato' })]) : page([bowl], 'c2'),
        ),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList('/pieces?student=7&status=BISQUE_FIRED')
    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más piezas' }))

    expect(await screen.findByRole('link', { name: /Plato/ })).toBeInTheDocument()
    const next = requestsTo(fetchFn, LIST).find((request) => param(request, 'cursor') === 'c2')
    expect(param(next, 'studentId')).toBe('7')
    expect(param(next, 'status')).toBe('BISQUE_FIRED')
    expect(screen.queryByRole('button', { name: 'Cargar más piezas' })).not.toBeInTheDocument()
    expect(screen.getByText('2 piezas')).toBeInTheDocument()
    // The focus goes to the first new card, not back to the top.
    expect(screen.getByRole('link', { name: /Plato/ })).toHaveFocus()
  })

  it('DI87_changingAFilterStartsAgainFromTheFirstPage', async () => {
    const fetchFn = stubApi({
      [LIST]: (request) =>
        jsonResponse(
          200,
          param(request, 'cursor') === 'c2' ? page([piece(9, { name: 'Plato' })]) : page([bowl], 'c2'),
        ),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()
    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más piezas' }))
    await screen.findByRole('link', { name: /Plato/ })

    await userEvent.click(screen.getByRole('button', { name: 'Esmaltada' }))

    await waitFor(() => expect(param(requestsTo(fetchFn, LIST).at(-1), 'status')).toBe('GLAZED'))
    expect(param(requestsTo(fetchFn, LIST).at(-1), 'cursor')).toBeNull()
  })

  it('DI87_aFailedNextPageKeepsTheCardsAndOffersRetry', async () => {
    stubApi({
      [LIST]: (request) =>
        param(request, 'cursor') === 'c2'
          ? errorResponse(503, 'unavailable', 'No disponible')
          : jsonResponse(200, page([bowl], 'c2')),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()
    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más piezas' }))

    expect(await screen.findByText('No pudimos cargar más piezas.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Bowl azul/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('RF31_aDirectoryErrorKeepsTheListWorking', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => errorResponse(503, 'unavailable', 'No disponible'),
    })
    renderList()

    expect(await screen.findByRole('link', { name: /Bowl azul/ })).toBeInTheDocument()
    expect(await screen.findByText('No pudimos cargar los alumnos.')).toBeInTheDocument()
  })

  it('CU13_aNoticeFromAnotherScreenIsShown', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([bowl])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderApp({
      role: 'LEAD_TEACHER',
      path: '/pieces',
      state: { notice: { kind: 'success', text: 'Anulaste Taza. Ya no aparece en las listas.' } },
    })

    expect(await screen.findByText('Anulaste Taza. Ya no aparece en las listas.')).toBeInTheDocument()
  })
})
