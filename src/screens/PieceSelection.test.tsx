import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onlineManager } from '@tanstack/react-query'
import { jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'
import { lucia, page, param, piece } from './pieceListFixtures'

const LIST = 'GET /api/v1/pieces'
const DIRECTORY = 'GET /api/v1/students/directory'
const BULK = 'POST /api/v1/pieces/bulk-change-status'

const ana = { id: 9, name: 'Ana G.' }
const bowl = piece(1, { name: 'Bowl azul' })
const plate = piece(2, { name: 'Plato', student: ana })
const cup = piece(3, { name: 'Taza' })
const stillWet = piece(4, { name: 'Jarra', status: 'IN_PROGRESS', advanceTo: 'BISQUE_FIRED', revertTo: null })
const bulkOk = { operationId: 'op-1', newStatus: 'GLAZED', count: 2, studentCount: 2 }

function renderList(path = '/pieces?status=BISQUE_FIRED') {
  return renderApp({ role: 'LEAD_TEACHER', path })
}

async function startSelecting() {
  await userEvent.click(await screen.findByRole('button', { name: 'Seleccionar varias' }))
}

const checkbox = (name: RegExp | string) => screen.getByRole('checkbox', { name })

describe('PieceSelection', () => {
  it('DI50_onTodasEnteringSelectionAsksForAnOriginStatus', async () => {
    stubApi({
      [LIST]: (request) =>
        jsonResponse(200, page(param(request, 'status') ? [bowl] : [bowl, finishedCup()])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList('/pieces')
    await startSelecting()

    expect(screen.getByText('¿Qué piezas vas a pasar de estado?')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Terminada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Todas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Nueva pieza' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Seleccionar varias' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Bizcochada' }))

    expect(await screen.findByRole('checkbox', { name: /Bowl azul/ })).not.toBeChecked()
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces?status=BISQUE_FIRED')
    expect(screen.queryByRole('button', { name: /^Pasar a/ })).not.toBeInTheDocument()
  })

  it('DI89_selectAllTicksOnlyTheLoadedPieces', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, plate], 'c2')),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      [BULK]: () => jsonResponse(200, bulkOk),
    })
    renderList()
    await startSelecting()

    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar las 2 cargadas' }))

    expect(checkbox(/Bowl azul/)).toBeChecked()
    expect(checkbox(/Plato/)).toBeChecked()
    expect(screen.getByRole('button', { name: 'Quitar selección' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver resumen: 2 piezas a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }))

    await screen.findByText(/pasaron a Esmaltada/)
    const [post] = requestsTo(fetchFn, BULK)
    expect(await post?.json()).toEqual({
      items: [
        { pieceId: 1, expectedStatus: 'BISQUE_FIRED' },
        { pieceId: 2, expectedStatus: 'BISQUE_FIRED' },
      ],
    })
  })

  it('DI50_selectAllReadsSeleccionarTodasWithoutMorePagesAndQuitarSeleccionWhenAllAreTicked', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([bowl, plate])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList()
    await startSelecting()

    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))
    expect(checkbox(/Plato/)).toBeChecked()

    await userEvent.click(screen.getByRole('button', { name: 'Quitar selección' }))

    expect(checkbox(/Plato/)).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Seleccionar todas' })).toBeInTheDocument()
  })

  it('RF29_counterAndSummaryButtonShowCountAndTarget', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([bowl, plate])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList()
    await startSelecting()

    expect(screen.getByText('0 seleccionadas de 2')).toBeInTheDocument()
    const none = screen.getByRole('button', { name: 'Ver resumen' })
    expect(none).toHaveAttribute('aria-disabled', 'true')
    expect(none).toHaveAccessibleDescription('Elegí al menos una pieza.')

    await userEvent.click(checkbox(/Bowl azul/))

    expect(screen.getByText('1 seleccionada de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver resumen: 1 pieza a Esmaltada' })).toBeEnabled()
  })

  it('RF29_counterSaysCargadasWhenThereIsAnotherPage', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, plate], 'c2')),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()
    await startSelecting()

    expect(screen.getByText('0 seleccionadas de 2 cargadas')).toBeInTheDocument()
    expect(screen.getByText('Hay más piezas: tocá Cargar más para sumarlas.')).toBeInTheDocument()
  })

  it('RF29_summaryNamesPiecesStudentsFromAndTo', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, plate, cup])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()
    await startSelecting()
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))

    await userEvent.click(screen.getByRole('button', { name: /^Ver resumen/ }))

    const dialog = screen.getByRole('alertdialog', { name: 'Resumen de la operación' })
    expect(dialog).toHaveTextContent('3 piezas de 2 alumnos pasarán de Bizcochada a Esmaltada.')
    expect(dialog).toHaveTextContent('Se aplica a todas o a ninguna.')
    expect(dialog).toHaveTextContent('Atención: No se puede deshacer.')
  })

  it('RF29_mixedSnapshotDisablesTheSummaryAndMarksThePieces', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, plate, stillWet])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()
    await startSelecting()

    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))

    const summary = screen.getByRole('button', { name: 'Ver resumen' })
    expect(summary).toHaveAttribute('aria-disabled', 'true')
    expect(summary).toHaveAccessibleDescription('Sacá las piezas marcadas.')
    expect(screen.getByRole('alert')).toHaveTextContent('Error: No se puede continuar.')
    const jarra = checkbox(/Jarra/).closest('li') as HTMLElement
    expect(within(jarra).getByText('Otro estado')).toBeInTheDocument()

    await userEvent.click(checkbox(/Jarra/))

    expect(screen.getByRole('button', { name: 'Ver resumen: 2 piezas a Esmaltada' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('RF29_aPieceWithoutNextStatusIsMarkedAndBlocksTheSummary', async () => {
    const done = piece(5, { name: 'Lista', status: 'FINISHED', advanceTo: null, revertTo: 'GLAZED' })
    stubApi({ [LIST]: () => jsonResponse(200, page([bowl, done])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList()
    await startSelecting()

    await userEvent.click(checkbox(/Bowl azul/))
    await userEvent.click(checkbox(/Lista/))

    expect(within(checkbox(/Lista/).closest('li') as HTMLElement).getByText('Sin estado siguiente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver resumen' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('DI69_confirmSendsEachPiecesExpectedStatus', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, plate])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      [BULK]: () => jsonResponse(200, bulkOk),
    })
    renderList()
    await startSelecting()
    await userEvent.click(checkbox(/Bowl azul/))
    await userEvent.click(checkbox(/Plato/))

    // Tap 1: select a piece; taps 2 and 3: summary and confirm (a bulk needs no more per piece).
    await userEvent.click(screen.getByRole('button', { name: /^Ver resumen/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }))

    await screen.findByText(/pasaron a Esmaltada/)
    const [post] = requestsTo(fetchFn, BULK)
    const body: unknown = await post?.json()
    expect(body).toEqual({
      items: [
        { pieceId: 1, expectedStatus: 'BISQUE_FIRED' },
        { pieceId: 2, expectedStatus: 'BISQUE_FIRED' },
      ],
    })
    expect(JSON.stringify(body)).not.toContain('newStatus')
  })

  it('CU14_successShowsListoWithTheResponseCountAndLeavesSelection', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, plate, cup])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      [BULK]: () => jsonResponse(200, { ...bulkOk, count: 2 }),
    })
    renderList()
    await startSelecting()
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))
    await userEvent.click(screen.getByRole('button', { name: /^Ver resumen/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }))

    const notice = await screen.findByText('2 piezas pasaron a Esmaltada.')
    expect(notice.closest('[role="status"]')).toHaveTextContent('Listo:')
    expect(screen.getByText('Los alumnos ya lo ven en Mis piezas.')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Seleccionar varias' })).toBeInTheDocument()
  })

  it('RF30_conflictNamesEachChangedAndVoidedPieceAndRefreshes', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, plate])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      [BULK]: () =>
        jsonResponse(409, {
          error: {
            code: 'status_conflict',
            message: 'Cambió.',
            details: {
              pieces: [
                { id: 1, name: 'Bowl azul', reason: 'CHANGED' },
                { id: 2, name: 'Plato', reason: 'VOIDED' },
              ],
            },
          },
        }),
    })
    renderList()
    await startSelecting()
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))
    await userEvent.click(screen.getByRole('button', { name: /^Ver resumen/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Error: No se aplicó ningún cambio')
    expect(alert).toHaveTextContent('Alguien modificó Bowl azul (Lucía P.) mientras elegías.')
    expect(alert).toHaveTextContent('Plato (Ana G.) fue anulada mientras tanto.')
    expect(alert).toHaveTextContent('Actualizá la lista y volvé a elegir.')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('2 seleccionadas de 2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar lista' }))

    expect(await screen.findByText('0 seleccionadas de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar todas' })).toBeInTheDocument()
    expect(param(requestsTo(fetchFn, LIST).at(-1), 'cursor')).toBeNull()
  })

  it('RF30_whileApplyingTheButtonsAreDisabled', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, plate])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      [BULK]: () => new Promise<Response>(() => {}),
    })
    renderList()
    await startSelecting()
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))
    await userEvent.click(screen.getByRole('button', { name: /^Ver resumen/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }))

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByRole('button', { name: 'Aplicando el cambio…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(within(dialog).getByText('Son 2 piezas. Tarda unos segundos.')).toBeInTheDocument()
  })

  it('RF30_aNetworkErrorKeepsTheSelection', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([bowl, plate])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      [BULK]: () => Promise.reject(new TypeError('offline')),
    })
    renderList()
    await startSelecting()
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))
    await userEvent.click(screen.getByRole('button', { name: /^Ver resumen/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó nada')
    expect(screen.getByText('2 seleccionadas de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver resumen: 2 piezas a Esmaltada' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Actualizar lista' })).not.toBeInTheDocument()
  })

  it('CU14_changingAFilterClearsTheSelection', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([bowl, plate])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList()
    await startSelecting()
    await userEvent.click(checkbox(/Bowl azul/))
    expect(screen.getByText('1 seleccionada de 2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'En proceso' }))

    expect(await screen.findByText(/^0 seleccionadas de/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar todas' })).toBeInTheDocument()
  })

  it('CU14_cancelSelectionKeepsTheFiltersAndReturnsTheFocus', async () => {
    stubApi({ [LIST]: () => jsonResponse(200, page([bowl])), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList()
    await startSelecting()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar selección' }))

    const again = await screen.findByRole('button', { name: 'Seleccionar varias' })
    expect(again).toHaveFocus()
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces?status=BISQUE_FIRED')
    expect(screen.getByRole('button', { name: /^Pasar a/ })).toBeInTheDocument()
  })

  it('DI89_loadMoreWhileSelectingKeepsTheTickedPiecesAndTheirExpectedStatus', async () => {
    const fetchFn = stubApi({
      [LIST]: (request) =>
        jsonResponse(200, param(request, 'cursor') === 'c2' ? page([plate]) : page([bowl], 'c2')),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      [BULK]: () => jsonResponse(200, bulkOk),
    })
    renderList()
    await startSelecting()
    await userEvent.click(checkbox(/Bowl azul/))

    await userEvent.click(screen.getByRole('button', { name: 'Cargar más piezas' }))

    const added = await screen.findByRole('checkbox', { name: /Plato/ })
    // The focus moves to the first new piece and ticks nothing.
    expect(added).toHaveFocus()
    expect(added).not.toBeChecked()
    expect(checkbox(/Bowl azul/)).toBeChecked()
    expect(screen.getByText('1 seleccionada de 2')).toBeInTheDocument()

    await userEvent.click(added)
    await userEvent.click(screen.getByRole('button', { name: /^Ver resumen/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }))

    await screen.findByText(/pasaron a Esmaltada/)
    const [post] = requestsTo(fetchFn, BULK)
    expect(await post?.json()).toEqual({
      items: [
        { pieceId: 1, expectedStatus: 'BISQUE_FIRED' },
        { pieceId: 2, expectedStatus: 'BISQUE_FIRED' },
      ],
    })
    // DI-87: after the operation the list starts again from page one.
    await waitFor(() => expect(requestsTo(fetchFn, LIST).length).toBeGreaterThanOrEqual(3))
    expect(param(requestsTo(fetchFn, LIST).at(-1), 'cursor')).toBeNull()
  })

  it('DI89_moreThan500SelectedDisablesTheSummaryWithTheReason', async () => {
    const many = Array.from({ length: 501 }, (_, index) => piece(1000 + index))
    stubApi({ [LIST]: () => jsonResponse(200, page(many)), [DIRECTORY]: () => jsonResponse(200, [lucia]) })
    renderList()
    await startSelecting()

    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))

    const summary = screen.getByRole('button', { name: 'Ver resumen' })
    expect(summary).toHaveAttribute('aria-disabled', 'true')
    expect(summary).toHaveAccessibleDescription('Elegí hasta 500 piezas por vez.')
  }, 20000)

  it('DI84_noRefetchOnWindowFocusWhileSelecting', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()
    await screen.findByRole('button', { name: 'Seleccionar varias' })

    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    await waitFor(() => expect(requestsTo(fetchFn, LIST)).toHaveLength(2))

    await startSelecting()
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(requestsTo(fetchFn, LIST)).toHaveLength(2)
  })

  it('DI84_noRefetchOnReconnectWhileSelecting', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
    })
    renderList()
    await screen.findByRole('button', { name: 'Seleccionar varias' })

    try {
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
      await waitFor(() => expect(requestsTo(fetchFn, LIST)).toHaveLength(2))

      await startSelecting()
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(requestsTo(fetchFn, LIST)).toHaveLength(2)
    } finally {
      onlineManager.setOnline(true)
    }
  })
})

function finishedCup() {
  return piece(6, { name: 'Taza lista', status: 'FINISHED', advanceTo: null, revertTo: 'GLAZED' })
}
