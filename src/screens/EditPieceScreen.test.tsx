import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const PIECE = {
  id: 7,
  name: 'Bowl 1',
  notes: 'Esmalte celeste',
  status: 'IN_PROGRESS',
  advanceTo: 'BISQUE_FIRED',
  revertTo: null,
  createdAt: '2026-10-01T15:00:00Z',
  updatedAt: '2026-10-01T15:00:00Z',
  student: { id: 3, name: 'Lucía P.' },
  history: [],
}

const DETAIL = 'GET /api/v1/pieces/7'
const EDIT = 'PATCH /api/v1/pieces/7'

function renderEdit(state?: unknown) {
  return renderApp({ role: 'ASSISTANT_TEACHER', path: '/pieces/7/edit', state })
}

describe('EditPieceScreen (teacher)', () => {
  it('CU13_editsNameAndNotes', async () => {
    const fetchFn = stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [EDIT]: () => jsonResponse(200, { ...PIECE, name: 'Bowl grande' }),
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
    })
    renderEdit()

    const name = await screen.findByLabelText('Nombre')
    expect(name).toHaveValue('Bowl 1')
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('Esmalte celeste')
    await userEvent.clear(name)
    await userEvent.type(name, 'Bowl grande')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('heading', { name: 'Bowl grande' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Listo: Guardamos los cambios.')
    expect(await requestsTo(fetchFn, EDIT)[0]?.json()).toEqual({
      name: 'Bowl grande',
      notes: 'Esmalte celeste',
    })
  })

  it('RF27_clearingNotesSendsAnEmptyString', async () => {
    const fetchFn = stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [EDIT]: () => jsonResponse(200, { ...PIECE, notes: null }),
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
    })
    renderEdit()

    await userEvent.clear(await screen.findByLabelText('Notas (opcional)'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await screen.findByRole('heading', { name: 'Bowl 1' })
    expect(await requestsTo(fetchFn, EDIT)[0]?.json()).toEqual({ name: 'Bowl 1', notes: '' })
  })

  it('RF27_saveIsDisabledWithAReasonWhileNothingChanged', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, PIECE) })
    renderEdit()

    const button = await screen.findByRole('button', { name: 'Guardar cambios' })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('No hay cambios para guardar.')
  })

  it('DI26_duplicateNameOnTheNameField', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [EDIT]: () =>
        errorResponse(409, 'duplicate_piece_name', 'Lucía P. ya tiene una pieza con ese nombre.'),
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
    })
    renderEdit()

    const name = await screen.findByLabelText('Nombre')
    await userEvent.type(name, ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Lucía P. ya tiene una pieza con ese nombre.')).toBeInTheDocument()
    expect(name).toHaveAttribute('aria-invalid', 'true')
  })

  it('RN20_editingAPieceVoidedMeanwhileShowsNotAvailable', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [EDIT]: () => errorResponse(409, 'status_conflict', 'La pieza fue anulada.'),
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
    })
    renderEdit()

    await userEvent.type(await screen.findByLabelText('Nombre'), ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver a Piezas' })).toHaveAttribute(
      'href',
      '/pieces',
    )
  })

  it('RN20_aVoidedPieceOpenedByUrlShowsNotAvailable', async () => {
    stubApi({ [DETAIL]: () => errorResponse(404, 'not_found', 'No existe') })
    renderEdit()

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
  })

  it('RF27_waitsForTheRealPieceBeforeShowingTheForm', async () => {
    stubApi({ [DETAIL]: () => new Promise<Response>(() => {}) })
    renderEdit()

    expect(await screen.findByText('Cargando la pieza…')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
  })

  it('RF27_showsTheTimeoutText', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, PIECE),
      [EDIT]: () => {
        throw new DOMException('timeout', 'TimeoutError')
      },
      'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
    })
    renderEdit()

    await userEvent.type(await screen.findByLabelText('Nombre'), ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error:')
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces/7/edit')
  })
})
