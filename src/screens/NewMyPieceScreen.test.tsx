import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const CREATE = 'POST /api/v1/students/me/pieces'
const LIST = 'GET /api/v1/students/me/pieces'
const DETAIL = 'GET /api/v1/students/me/pieces/7'

function created(name = 'Bowl 1') {
  return {
    id: 7,
    name,
    notes: null,
    status: 'IN_PROGRESS',
    editable: true,
    createdAt: '2026-10-29T15:00:00Z',
    updatedAt: '2026-10-29T15:00:00Z',
    history: [
      {
        eventType: 'CREATED',
        newStatus: 'IN_PROGRESS',
        occurredAt: '2026-10-29T15:00:00Z',
        correction: false,
      },
    ],
  }
}

const STUBS = {
  [LIST]: () => jsonResponse(200, { items: [], nextCursor: null }),
}

function renderNew() {
  return renderApp({ role: 'STUDENT', path: '/pieces/new' })
}

function submit() {
  return userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))
}

describe('NewMyPieceScreen', () => {
  it('RF24_createsAPieceAndOpensItsDetailWithListo', async () => {
    const fetchFn = stubApi({
      ...STUBS,
      [CREATE]: () => jsonResponse(201, created()),
      [DETAIL]: () => jsonResponse(200, created()),
    })
    renderNew()

    expect(await screen.findByRole('heading', { name: 'Nueva pieza' })).toHaveFocus()
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription(
      'Hasta 100 caracteres. Para un juego, numeralas: Bowl 1, Bowl 2.',
    )
    await userEvent.type(screen.getByLabelText('Nombre'), '  Bowl 1 ')
    await userEvent.type(screen.getByLabelText('Notas (opcional)'), 'Esmalte celeste')
    await submit()

    expect(await screen.findByRole('heading', { name: 'Bowl 1', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces/7')
    expect(screen.getByText('Creaste Bowl 1.').closest('[role="status"]')).toHaveTextContent(
      'Listo: Creaste Bowl 1.',
    )
    const [request] = requestsTo(fetchFn, CREATE)
    expect(await request?.json()).toEqual({ name: 'Bowl 1', notes: 'Esmalte celeste' })
  })

  it('RF24_sendsNoNotesWhenTheyAreBlank', async () => {
    const fetchFn = stubApi({
      ...STUBS,
      [CREATE]: () => jsonResponse(201, created()),
      [DETAIL]: () => jsonResponse(200, created()),
    })
    renderNew()
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Bowl 1')
    await userEvent.type(screen.getByLabelText('Notas (opcional)'), '   ')
    await submit()

    await screen.findByRole('heading', { name: 'Bowl 1', level: 1 })
    const [request] = requestsTo(fetchFn, CREATE)
    expect(await request?.json()).toEqual({ name: 'Bowl 1' })
  })

  it('RF24_requiresTheNameAndLimitsTheLengths', async () => {
    const fetchFn = stubApi(STUBS)
    renderNew()
    await screen.findByLabelText('Nombre')

    await submit()
    expect(screen.getByText('Escribí el nombre de la pieza.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nombre'), 'a'.repeat(101))
    await submit()
    expect(screen.getByText('Hasta 100 caracteres.')).toBeInTheDocument()
    expect(requestsTo(fetchFn, CREATE)).toHaveLength(0)
  })

  it('DI26_aDuplicateNameIsShownOnTheNameField', async () => {
    stubApi({
      ...STUBS,
      [CREATE]: () =>
        errorResponse(409, 'duplicate_piece_name', 'Ya tenés una pieza con ese nombre.'),
    })
    renderNew()
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Bowl 1')
    await submit()

    const name = await screen.findByLabelText('Nombre')
    expect(name).toHaveAccessibleDescription(/Ya tenés una pieza con ese nombre\./)
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveFocus()
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces/new')
  })

  it('RF24_showsTheTimeoutText', async () => {
    stubApi({
      ...STUBS,
      [CREATE]: () => {
        throw new DOMException('timeout', 'TimeoutError')
      },
    })
    renderNew()
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Bowl 1')
    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: La API tardó demasiado. No sabemos si se guardó: revisá tus piezas antes de intentar de nuevo.',
    )
    // The form stays, with what was typed, to try again by hand.
    expect(screen.getByLabelText('Nombre')).toHaveValue('Bowl 1')
  })

  it('RF24_cancelGoesBackToMyPieces', async () => {
    stubApi(STUBS)
    renderNew()

    expect(await screen.findByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/pieces')
  })
})
