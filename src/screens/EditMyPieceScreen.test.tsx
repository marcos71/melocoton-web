import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const DETAIL = 'GET /api/v1/students/me/pieces/7'
const EDIT = 'PATCH /api/v1/students/me/pieces/7'
const LIST = 'GET /api/v1/students/me/pieces'

function piece(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'Bowl 1',
    notes: 'Esmalte celeste',
    status: 'IN_PROGRESS',
    editable: true,
    createdAt: '2026-10-01T15:00:00Z',
    updatedAt: '2026-10-29T15:00:00Z',
    history: [],
    ...overrides,
  }
}

const LIST_STUB = { [LIST]: () => jsonResponse(200, { items: [], nextCursor: null }) }

function renderEdit() {
  return renderApp({ role: 'STUDENT', path: '/pieces/7/edit' })
}

function save() {
  return userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
}

describe('EditMyPieceScreen', () => {
  it('RF27_editsNameAndNotesAndReturnsToTheDetail', async () => {
    let current = piece()
    const fetchFn = stubApi({
      ...LIST_STUB,
      [DETAIL]: () => jsonResponse(200, current),
      [EDIT]: () => {
        current = piece({ name: 'Bowl grande', notes: 'Otra nota' })
        return jsonResponse(200, current)
      },
    })
    renderEdit()

    const name = await screen.findByLabelText('Nombre')
    expect(screen.getByRole('heading', { name: 'Editar pieza' })).toHaveFocus()
    expect(name).toHaveValue('Bowl 1')
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('Esmalte celeste')
    await userEvent.clear(name)
    await userEvent.type(name, 'Bowl grande')
    await userEvent.clear(screen.getByLabelText('Notas (opcional)'))
    await userEvent.type(screen.getByLabelText('Notas (opcional)'), 'Otra nota')
    await save()

    expect(await screen.findByRole('heading', { name: 'Bowl grande', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces/7')
    expect(screen.getByText('Guardamos los cambios.').closest('[role="status"]')).toHaveTextContent(
      'Listo: Guardamos los cambios.',
    )
    const [request] = requestsTo(fetchFn, EDIT)
    expect(await request?.json()).toEqual({ name: 'Bowl grande', notes: 'Otra nota' })
  })

  it('RF27_saveIsDisabledWithAReasonWhileNothingChanged', async () => {
    stubApi({ ...LIST_STUB, [DETAIL]: () => jsonResponse(200, piece()) })
    renderEdit()

    const save = await screen.findByRole('button', { name: 'Guardar cambios' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(save).toHaveAccessibleDescription('No hay cambios para guardar.')
  })

  it('RF27_clearingNotesSendsAnEmptyString', async () => {
    const fetchFn = stubApi({
      ...LIST_STUB,
      [DETAIL]: () => jsonResponse(200, piece()),
      [EDIT]: () => jsonResponse(200, piece({ notes: null })),
    })
    renderEdit()
    await userEvent.clear(await screen.findByLabelText('Notas (opcional)'))
    await save()

    await screen.findByRole('heading', { name: 'Bowl 1', level: 1 })
    const [request] = requestsTo(fetchFn, EDIT)
    expect(await request?.json()).toEqual({ name: 'Bowl 1', notes: '' })
  })

  it('DI26_aDuplicateNameOnEditIsShownOnTheNameField', async () => {
    stubApi({
      ...LIST_STUB,
      [DETAIL]: () => jsonResponse(200, piece()),
      [EDIT]: () => errorResponse(409, 'duplicate_piece_name', 'Ya tenés una pieza con ese nombre.'),
    })
    renderEdit()
    const name = await screen.findByLabelText('Nombre')
    await userEvent.clear(name)
    await userEvent.type(name, 'Taza')
    await save()

    expect(await screen.findByLabelText('Nombre')).toHaveAccessibleDescription(
      /Ya tenés una pieza con ese nombre\./,
    )
  })

  it('RF27_pieceNotEditableReplacesTheForm', async () => {
    let editable = true
    stubApi({
      ...LIST_STUB,
      [DETAIL]: () => jsonResponse(200, piece({ editable, status: editable ? 'IN_PROGRESS' : 'BISQUE_FIRED' })),
      [EDIT]: () => {
        editable = false
        return errorResponse(409, 'piece_not_editable', 'No se puede editar.')
      },
    })
    renderEdit()
    const name = await screen.findByLabelText('Nombre')
    await userEvent.type(name, ' 2')
    await save()

    expect(await screen.findByText('Esta pieza ya no se puede editar')).toBeInTheDocument()
    expect(screen.getByText('Solo se edita mientras está En proceso.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la pieza' })).toHaveAttribute('href', '/pieces/7')
  })

  it('RF27_aNonEditablePieceOpenedByUrlShowsTheReason', async () => {
    stubApi({
      ...LIST_STUB,
      [DETAIL]: () => jsonResponse(200, piece({ editable: false, status: 'GLAZED' })),
    })
    renderEdit()

    expect(await screen.findByText('Esta pieza ya no se puede editar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la pieza' })).toBeInTheDocument()
  })

  it('CP22_editingAnotherStudentsPieceShowsAsNotAvailable', async () => {
    stubApi({ ...LIST_STUB, [DETAIL]: () => errorResponse(404, 'not_found', 'No existe.') })
    renderEdit()

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
  })

  it('RF27_aPieceVoidedWhileEditingShowsAsNotAvailable', async () => {
    stubApi({
      ...LIST_STUB,
      [DETAIL]: () => jsonResponse(200, piece()),
      [EDIT]: () => errorResponse(404, 'not_found', 'No existe.'),
    })
    renderEdit()
    await userEvent.type(await screen.findByLabelText('Nombre'), ' 2')
    await save()

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
  })

  it('RF27_showsALoadingTextWhileLoading', async () => {
    stubApi({ ...LIST_STUB, [DETAIL]: () => new Promise<Response>(() => {}) })
    renderEdit()

    expect(await screen.findByText('Cargando la pieza…')).toHaveAttribute('role', 'status')
  })

  it('RF27_showsTheTimeoutText', async () => {
    stubApi({
      ...LIST_STUB,
      [DETAIL]: () => jsonResponse(200, piece()),
      [EDIT]: () => {
        throw new DOMException('timeout', 'TimeoutError')
      },
    })
    renderEdit()
    await userEvent.type(await screen.findByLabelText('Nombre'), ' 2')
    await save()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: La API tardó demasiado. No sabemos si se guardó: revisá tus piezas antes de intentar de nuevo.',
    )
  })
})
