import { screen } from '@testing-library/react'
import { jsonResponse, renderApp, stubApi } from '../test/utils'
import { lucia, page, piece } from './pieceListFixtures'

const teacherPiece = {
  ...piece(3, { name: 'Bowl azul' }),
  notes: null,
  createdAt: '2026-10-01T10:00:00Z',
  history: [],
}

const studentPiece = {
  id: 3,
  name: 'Bowl azul',
  notes: null,
  status: 'IN_PROGRESS',
  editable: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-29T15:00:00Z',
  history: [],
}

/** Every read the piece screens make; each case uses only the ones its screen needs. */
function stubPieceApi() {
  return stubApi({
    'GET /api/v1/students/me/pieces': () => jsonResponse(200, page([])),
    'GET /api/v1/students/me/pieces/3': () => jsonResponse(200, studentPiece),
    'GET /api/v1/pieces': () => jsonResponse(200, page([])),
    'GET /api/v1/pieces/3': () => jsonResponse(200, teacherPiece),
    'GET /api/v1/students/directory': () => jsonResponse(200, [lucia]),
  })
}

describe('piece routes', () => {
  it('RF31_theStudentOpensTheirOwnPiecesInThePiecesTab', async () => {
    stubPieceApi()
    renderApp({ role: 'STUDENT', path: '/pieces' })

    expect(await screen.findByRole('heading', { name: 'Mis piezas' })).toBeInTheDocument()
  })

  it.each(['LEAD_TEACHER', 'ASSISTANT_TEACHER'] as const)(
    'RF32_%sOpensThePiecesOfEveryStudentInThePiecesTab',
    async (role) => {
      stubPieceApi()
      renderApp({ role, path: '/pieces' })

      expect(await screen.findByRole('heading', { name: 'Piezas' })).toBeInTheDocument()
    },
  )

  it.each([
    ['STUDENT', '/pieces/new', 'Nueva pieza'],
    ['STUDENT', '/pieces/3', 'Bowl azul'],
    ['STUDENT', '/pieces/3/edit', 'Editar pieza'],
    ['LEAD_TEACHER', '/pieces/3', 'Bowl azul'],
    ['ASSISTANT_TEACHER', '/pieces/3', 'Bowl azul'],
    ['LEAD_TEACHER', '/pieces/3/void', 'Anular pieza'],
    ['ASSISTANT_TEACHER', '/pieces/3/void', 'Anular pieza'],
    ['ASSISTANT_TEACHER', '/pieces/new', 'Nueva pieza'],
  ] as const)('RF24_%sOpens_%s', async (role, path, heading) => {
    stubPieceApi()
    renderApp({ role, path })

    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(path)
  })

  it('CP22_aStudentTypingTheVoidRouteGoesToTheirHome', async () => {
    stubApi({
      'GET /api/v1/students/me/home': () => new Promise<Response>(() => {}),
    })
    renderApp({ role: 'STUDENT', path: '/pieces/3/void' })

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/home')
  })
})
