import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const PIECE = {
  id: 7,
  name: 'Bowl 1',
  notes: 'Esmalte celeste',
  status: 'BISQUE_FIRED',
  advanceTo: 'GLAZED',
  revertTo: 'IN_PROGRESS',
  createdAt: '2026-10-01T15:00:00Z',
  updatedAt: '2026-10-29T15:00:00Z',
  student: { id: 3, name: 'Lucía P.' },
  history: [
    {
      eventType: 'ADVANCED',
      previousStatus: 'IN_PROGRESS',
      newStatus: 'BISQUE_FIRED',
      occurredAt: '2026-10-29T15:00:00Z',
      correction: false,
      operationId: '6b2f0c1e-0000-4000-8000-000000000001',
      changedBy: { id: 1, name: 'Ana Docente' },
    },
    {
      eventType: 'CREATED',
      previousStatus: null,
      newStatus: 'IN_PROGRESS',
      occurredAt: '2026-10-01T15:00:00Z',
      correction: false,
      operationId: '6b2f0c1e-0000-4000-8000-000000000002',
      changedBy: { id: 1, name: 'Ana Docente' },
    },
  ],
}

const DETAIL = 'GET /api/v1/pieces/7'
const CHANGE = 'POST /api/v1/pieces/7/change-status'

function renderPiece(state?: unknown) {
  return renderApp({ role: 'LEAD_TEACHER', path: '/pieces/7', state })
}

describe('PieceScreen (teacher detail)', () => {
  it('RF28_showsTheDataTheStatusAndTheHistoryWithWhoChangedIt', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderPiece()

    const heading = await screen.findByRole('heading', { name: 'Bowl 1' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('De Lucía P.')).toBeInTheDocument()
    expect(screen.getByText('Paso 2 de 4')).toBeInTheDocument()
    const data = screen.getByRole('region', { name: 'Datos' })
    expect(within(data).getByText('Esmalte celeste')).toBeInTheDocument()
    expect(within(data).getByRole('link', { name: 'Editar nombre y notas' })).toHaveAttribute(
      'href',
      '/pieces/7/edit',
    )
    const history = within(screen.getByRole('region', { name: 'Historial' })).getAllByRole('listitem')
    expect(history[0]).toHaveTextContent('29 de oct de 2026 · En proceso a Bizcochada · Ana Docente')
    expect(history[1]).toHaveTextContent('Pieza creada en En proceso')
    expect(screen.getByRole('link', { name: 'Anular pieza' })).toHaveAttribute(
      'href',
      '/pieces/7/void',
    )
  })

  it('RF27_aPieceWithoutNotesSaysSo', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, { ...PIECE, notes: null }) })
    renderPiece()

    expect(await screen.findByText('Sin notas')).toBeInTheDocument()
  })

  it('RF26_onlyTheActionsTheApiAllowsAreShown', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, { ...PIECE, status: 'FINISHED', advanceTo: null }),
    })
    renderPiece()

    await screen.findByRole('heading', { name: 'Bowl 1' })
    expect(screen.queryByRole('button', { name: /Pasar a/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a En proceso' })).toBeInTheDocument()
  })

  it('RF26_aPieceWithoutRevertToHasNoRevertButton', async () => {
    stubApi({
      [DETAIL]: () =>
        jsonResponse(200, { ...PIECE, status: 'IN_PROGRESS', revertTo: null, advanceTo: 'BISQUE_FIRED' }),
    })
    renderPiece()

    await screen.findByRole('heading', { name: 'Bowl 1' })
    expect(screen.queryByRole('button', { name: /Volver a/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pasar a Bizcochada' })).toBeInTheDocument()
  })

  it('RNF01_advancesAPieceInTwoTapsFromTheDetail', async () => {
    const fetchFn = stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [CHANGE]: () =>
        jsonResponse(200, { ...PIECE, status: 'GLAZED', advanceTo: 'FINISHED', revertTo: 'BISQUE_FIRED' }),
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
    })
    renderPiece()

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a Esmaltada' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Avance individual' })
    expect(dialog).toHaveTextContent('Bowl 1 · Lucía P. pasa de Bizcochada a Esmaltada.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent('Listo: Bowl 1 pasó a Esmaltada.')
    expect(requestsTo(fetchFn, CHANGE)).toHaveLength(1)
    expect(await requestsTo(fetchFn, CHANGE)[0]?.json()).toEqual({
      expectedStatus: 'BISQUE_FIRED',
      newStatus: 'GLAZED',
    })
  })

  it('CU13_advanceFromTheDetailUpdatesWithoutASecondGet', async () => {
    const fetchFn = stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [CHANGE]: () =>
        jsonResponse(200, { ...PIECE, status: 'GLAZED', advanceTo: 'FINISHED', revertTo: 'BISQUE_FIRED' }),
    })
    renderPiece()

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    // The returned piece is on screen: the new step and the next action.
    expect(await screen.findByText('Paso 3 de 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pasar a Terminada' })).toBeInTheDocument()
    expect(requestsTo(fetchFn, DETAIL)).toHaveLength(1)
  })

  it('RNF01_revertsAPieceInTwoTapsFromTheDetail', async () => {
    const fetchFn = stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [CHANGE]: () =>
        jsonResponse(200, { ...PIECE, status: 'IN_PROGRESS', advanceTo: 'BISQUE_FIRED', revertTo: null }),
    })
    renderPiece()

    await userEvent.click(await screen.findByRole('button', { name: 'Volver a En proceso' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Listo:')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Listo: Bowl 1 volvió a En proceso. Quedó como corrección.',
    )
    expect(await requestsTo(fetchFn, CHANGE)[0]?.json()).toEqual({
      expectedStatus: 'BISQUE_FIRED',
      newStatus: 'IN_PROGRESS',
    })
  })

  it('CP21_revertConfirmationSaysItIsACorrection', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderPiece()

    await userEvent.click(await screen.findByRole('button', { name: 'Volver a En proceso' }))

    const dialog = screen.getByRole('alertdialog', { name: 'Volver a En proceso' })
    expect(dialog).toHaveTextContent(
      'Bowl 1 vuelve de Bizcochada a En proceso. Queda registrado como corrección.',
    )
  })

  it('RF26_cancelingTheDialogSendsNothingAndReturnsTheFocusToTheButton', async () => {
    const fetchFn = stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderPiece()

    const button = await screen.findByRole('button', { name: 'Pasar a Esmaltada' })
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(requestsTo(fetchFn, CHANGE)).toHaveLength(0)
  })

  it('D34_aConflictOnTheDetailShowsTheErrorAndReloads', async () => {
    let reads = 0
    stubApi({
      [DETAIL]: () => {
        reads += 1
        return jsonResponse(200, reads === 1 ? PIECE : { ...PIECE, status: 'GLAZED', advanceTo: 'FINISHED' })
      },
      [CHANGE]: () =>
        jsonResponse(409, {
          error: {
            code: 'status_conflict',
            message: 'Cambió',
            details: { pieces: [{ id: 7, name: 'Bowl 1', reason: 'CHANGED' }] },
          },
        }),
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
    })
    renderPiece()

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Error: No se aplicó el cambio. Alguien cambió Bowl 1 mientras tanto.')
    expect(alert.closest('[tabindex="-1"]')).toHaveFocus()
    // The detail was read again and shows the new state.
    expect(await screen.findByText('Paso 3 de 4')).toBeInTheDocument()
  })

  it('DI91_revertingAFinishedPieceWhoseNameIsTakenShowsTheNoticeAndKeepsThePiece', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, { ...PIECE, status: 'FINISHED', advanceTo: null, revertTo: 'GLAZED' }),
      [CHANGE]: () =>
        errorResponse(409, 'duplicate_piece_name', 'Ya hay otra pieza con ese nombre. Usá uno distinto, por ejemplo «Bowl 2».'),
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
    })
    renderPiece()

    await userEvent.click(await screen.findByRole('button', { name: 'Volver a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Error: No se aplicó el cambio. Lucía P. ya tiene otra pieza sin terminar llamada Bowl 1. Cambiá el nombre de una de las dos y volvé a intentar.',
    )
    expect(alert).not.toHaveTextContent('Usá uno distinto')
    expect(alert.closest('[tabindex="-1"]')).toHaveFocus()
    expect(screen.getByText('Paso 4 de 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a Esmaltada' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('RN20_aPieceVoidedMeanwhileOnAChangeShowsNotAvailable', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [CHANGE]: () =>
        jsonResponse(409, {
          error: {
            code: 'status_conflict',
            message: 'Anulada',
            details: { pieces: [{ id: 7, name: 'Bowl 1', reason: 'VOIDED' }] },
          },
        }),
    })
    renderPiece()

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver a Piezas' })).toHaveAttribute(
      'href',
      '/pieces',
    )
  })

  it('RN20_aVoidedPieceShowsNotAvailable', async () => {
    stubApi({ [DETAIL]: () => errorResponse(404, 'not_found', 'No existe') })
    renderPiece()

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
    expect(screen.getByText('Puede haber sido anulada. Volvé a Piezas para ver las demás.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('RF26_aNetworkTimeoutOnAChangeSaysWeDoNotKnowIfItWasSaved', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [CHANGE]: () => {
        throw new DOMException('timeout', 'TimeoutError')
      },
    })
    renderPiece()

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a Esmaltada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    // Whatever the failure, it is an Error notice and the piece stays where it was.
    expect(await screen.findByRole('alert')).toHaveTextContent('Error:')
    expect(screen.getByText('Paso 2 de 4')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('RF31_aFailedReadOffersRetryAndTheWayBack', async () => {
    stubApi({ [DETAIL]: () => errorResponse(500, 'internal_error', 'Falló') })
    renderPiece()

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver a Piezas' })).toHaveAttribute(
      'href',
      '/pieces',
    )
  })

  it('RF31_showsALoadingTextWhileLoading', async () => {
    stubApi({ [DETAIL]: () => new Promise<Response>(() => {}) })
    renderPiece()

    expect(await screen.findByText('Cargando la pieza…')).toBeInTheDocument()
  })

  it('backKeepsTheListFilters', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderPiece({ from: '/pieces?status=BISQUE_FIRED&student=3' })

    await screen.findByRole('heading', { name: 'Bowl 1' })

    expect(screen.getByRole('link', { name: 'Volver a Piezas' })).toHaveAttribute(
      'href',
      '/pieces?status=BISQUE_FIRED&student=3',
    )
    expect(screen.getByRole('link', { name: 'Anular pieza' })).toBeInTheDocument()
  })

  it('RF27_aNoticeFromThePreviousScreenIsShown', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderPiece({ notice: { kind: 'success', text: 'Guardamos los cambios.' } })

    expect(await screen.findByText('Guardamos los cambios.')).toBeInTheDocument()
  })
})
