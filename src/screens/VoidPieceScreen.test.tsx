import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const PIECE = {
  id: 7,
  name: 'Bowl 1',
  notes: null,
  status: 'GLAZED',
  advanceTo: 'FINISHED',
  revertTo: 'BISQUE_FIRED',
  createdAt: '2026-10-01T15:00:00Z',
  updatedAt: '2026-10-29T15:00:00Z',
  student: { id: 3, name: 'Lucía P.' },
  history: [],
}

const DETAIL = 'GET /api/v1/pieces/7'
const VOID = 'POST /api/v1/pieces/7/void'
const LIST = 'GET /api/v1/pieces'

function renderVoid(state?: unknown) {
  return renderApp({ role: 'LEAD_TEACHER', path: '/pieces/7/void', state })
}

const emptyList = () => jsonResponse(200, { items: [], nextCursor: null })

describe('VoidPieceScreen', () => {
  it('RF56_showsWhatIsBeingVoidedAndTheWarning', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderVoid()

    expect(await screen.findByText('Bowl 1 · Lucía P. · Esmaltada')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Atención: No se puede deshacer. La pieza deja de verse para todos, también para el alumno. El historial se conserva.',
    )
    expect(screen.getByText('Obligatorio. Hasta 500 caracteres. El alumno no lo ve.')).toBeInTheDocument()
  })

  it('RF56_voidRequiresAReason', async () => {
    const fetchFn = stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderVoid()

    await userEvent.click(await screen.findByRole('button', { name: 'Anular pieza' }))

    expect(await screen.findByText('Escribí el motivo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true')
    expect(requestsTo(fetchFn, VOID)).toHaveLength(0)
  })

  it('DI72_reasonUpTo500Chars', async () => {
    const fetchFn = stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderVoid()

    await userEvent.click(await screen.findByLabelText('Motivo'))
    await userEvent.paste('a'.repeat(501))
    await userEvent.click(screen.getByRole('button', { name: 'Anular pieza' }))

    expect(await screen.findByText('Hasta 500 caracteres.', { selector: 'p' })).toBeInTheDocument()
    expect(requestsTo(fetchFn, VOID)).toHaveLength(0)
  })

  it('RF56_voidReturnsToTheListWithListoAndTheListNoLongerHasIt', async () => {
    const fetchFn = stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [VOID]: () => new Response(null, { status: 204 }),
      [LIST]: emptyList,
      'GET /api/v1/students/directory': () => jsonResponse(200, []),
    })
    renderVoid({ from: '/pieces?status=GLAZED' })

    await userEvent.type(await screen.findByLabelText('Motivo'), 'Se rompió en el horno')
    await userEvent.click(screen.getByRole('button', { name: 'Anular pieza' }))

    expect(await screen.findByRole('heading', { name: 'Piezas' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces?status=GLAZED')
    expect(await requestsTo(fetchFn, VOID)[0]?.json()).toEqual({ reason: 'Se rompió en el horno' })
  })

  it('RF56_alreadyVoidedShowsNotAvailable', async () => {
    stubApi({ [DETAIL]: () => errorResponse(404, 'not_found', 'No existe') })
    renderVoid()

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
    expect(screen.queryByLabelText('Motivo')).not.toBeInTheDocument()
  })

  it('RF56_aVoidThatRacesWithAnotherOneShowsNotAvailable', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [VOID]: () => errorResponse(409, 'status_conflict', 'Ya estaba anulada.'),
      [LIST]: emptyList,
    })
    renderVoid()

    await userEvent.type(await screen.findByLabelText('Motivo'), 'Duplicada')
    await userEvent.click(screen.getByRole('button', { name: 'Anular pieza' }))

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
  })

  it('RF56_aTimeoutKeepsTheFormAndSaysWeDoNotKnow', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [VOID]: () => {
        throw new DOMException('timeout', 'TimeoutError')
      },
      [LIST]: emptyList,
    })
    renderVoid()

    await userEvent.type(await screen.findByLabelText('Motivo'), 'Duplicada')
    await userEvent.click(screen.getByRole('button', { name: 'Anular pieza' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error:')
    expect(screen.getByLabelText('Motivo')).toHaveValue('Duplicada')
  })

  it('RF56_actionOnTopCancelBelow', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderVoid()

    const action = await screen.findByRole('button', { name: 'Anular pieza' })
    const cancel = screen.getByRole('link', { name: 'Cancelar' })

    expect(action.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(cancel).toHaveAttribute('href', '/pieces/7')
  })
})
