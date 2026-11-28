import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'
import { lucia, page, piece } from './pieceListFixtures'

const LIST = 'GET /api/v1/pieces'
const DIRECTORY = 'GET /api/v1/students/directory'
const DETAIL = 'GET /api/v1/pieces/3'
const CHANGE = 'POST /api/v1/pieces/3/change-status'
const VOID = 'POST /api/v1/pieces/3/void'

const bowl = piece(3, { name: 'Bowl azul' })
const bowlDetail = { ...bowl, notes: null, createdAt: '2026-10-01T10:00:00Z', history: [] }

describe('piece flows across screens', () => {
  it('RNF01_revertsAPieceInThreeTapsFromTheList', async () => {
    const fetchFn = stubApi({
      [LIST]: () => jsonResponse(200, page([bowl])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      [DETAIL]: () => jsonResponse(200, bowlDetail),
      [CHANGE]: () =>
        jsonResponse(200, { ...bowlDetail, status: 'IN_PROGRESS', advanceTo: 'BISQUE_FIRED', revertTo: null }),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/pieces' })

    // Tap 1: the card opens the detail.
    await userEvent.click(await screen.findByRole('link', { name: /Bowl azul/ }))
    // Tap 2: revert. Tap 3: confirm.
    await userEvent.click(await screen.findByRole('button', { name: 'Volver a En proceso' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Paso 1 de 4')).toBeInTheDocument()
    expect(requestsTo(fetchFn, CHANGE)).toHaveLength(1)
    expect(await requestsTo(fetchFn, CHANGE)[0]?.json()).toEqual({
      expectedStatus: 'BISQUE_FIRED',
      newStatus: 'IN_PROGRESS',
    })
  })

  it('RF56_afterVoidTheListShowsTheNotice', async () => {
    stubApi({
      [LIST]: () => jsonResponse(200, page([])),
      [DIRECTORY]: () => jsonResponse(200, [lucia]),
      [DETAIL]: () => jsonResponse(200, bowlDetail),
      [VOID]: () => new Response(null, { status: 204 }),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/pieces/3/void' })

    await userEvent.type(await screen.findByLabelText('Motivo'), 'Se rompió en el horno')
    await userEvent.click(screen.getByRole('button', { name: 'Anular pieza' }))

    expect(await screen.findByRole('heading', { name: 'Piezas' })).toBeInTheDocument()
    expect(screen.getByText('Anulaste Bowl azul. Ya no aparece en las listas.')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces')
  })
})
