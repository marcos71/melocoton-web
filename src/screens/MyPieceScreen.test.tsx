import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const DETAIL = 'GET /api/v1/students/me/pieces/7'

function piece(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'Bowl 1',
    notes: 'Esmalte celeste',
    status: 'IN_PROGRESS',
    editable: true,
    createdAt: '2026-10-01T15:00:00Z',
    updatedAt: '2026-10-29T15:00:00Z',
    history: [
      {
        eventType: 'CREATED',
        newStatus: 'IN_PROGRESS',
        occurredAt: '2026-10-01T15:00:00Z',
        correction: false,
      },
    ],
    ...overrides,
  }
}

function renderDetail(state?: unknown) {
  return renderApp({ role: 'STUDENT', path: '/pieces/7', state })
}

describe('MyPieceScreen', () => {
  it('RF27_editIsOfferedOnlyWhenEditable', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, piece()) })
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Bowl 1', level: 1 })).toHaveFocus()
    expect(screen.getByText('Estado actual')).toBeInTheDocument()
    expect(screen.getByText('Paso 1 de 4')).toBeInTheDocument()
    expect(screen.getByText('Falta bizcochar, esmaltar y hornear de nuevo.')).toBeInTheDocument()
    expect(screen.getByText('Esmalte celeste')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar nombre y notas' })).toHaveAttribute(
      'href',
      '/pieces/7/edit',
    )
  })

  it('RF27_otherwiseItIsDisabledWithTheReason', async () => {
    stubApi({
      [DETAIL]: () => jsonResponse(200, piece({ status: 'GLAZED', editable: false, notes: null })),
    })
    renderDetail()

    const edit = await screen.findByRole('button', { name: 'Editar nombre y notas' })
    expect(edit).toHaveAttribute('aria-disabled', 'true')
    expect(edit).toHaveAccessibleDescription('Solo se puede editar mientras está En proceso.')
    expect(screen.queryByRole('link', { name: 'Editar nombre y notas' })).not.toBeInTheDocument()
    expect(screen.getByText('Sin notas')).toBeInTheDocument()
  })

  it('RF28_historyShowsCreationAdvancesAndCorrections', async () => {
    stubApi({
      [DETAIL]: () =>
        jsonResponse(
          200,
          piece({
            status: 'BISQUE_FIRED',
            editable: false,
            history: [
              {
                eventType: 'REVERTED',
                previousStatus: 'GLAZED',
                newStatus: 'BISQUE_FIRED',
                occurredAt: '2026-10-29T15:00:00Z',
                correction: true,
              },
              {
                eventType: 'ADVANCED',
                previousStatus: 'IN_PROGRESS',
                newStatus: 'BISQUE_FIRED',
                occurredAt: '2026-10-15T15:00:00Z',
                correction: false,
              },
              {
                eventType: 'CREATED',
                newStatus: 'IN_PROGRESS',
                occurredAt: '2026-10-01T15:00:00Z',
                correction: false,
              },
            ],
          }),
        ),
    })
    renderDetail()

    const section = (await screen.findByRole('heading', { name: 'Historial' })).closest('section')
    const lines = within(section as HTMLElement).getAllByRole('listitem')
    expect(lines.map((line) => line.textContent)).toEqual([
      '29 de oct de 2026 · Esmaltada a BizcochadaCorrección',
      '15 de oct de 2026 · En proceso a Bizcochada',
      '1 de oct de 2026 · Pieza creada en En proceso',
    ])
  })

  it('CP22_anotherStudentsPieceShowsAsNotAvailable', async () => {
    const fetchFn = stubApi({ [DETAIL]: () => errorResponse(404, 'not_found', 'No existe.') })
    renderDetail()

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
    expect(
      screen.getByText('Un docente la quitó de tu lista. Volvé a Mis piezas para ver las demás.'),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver a Mis piezas' })).toHaveAttribute('href', '/pieces')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(requestsTo(fetchFn, DETAIL)).toHaveLength(1)
  })

  it('RN20_aVoidedPieceShowsTheNotAvailableNotice', async () => {
    stubApi({ [DETAIL]: () => errorResponse(404, 'not_found', 'Anulada.') })
    renderDetail()

    expect(await screen.findByText('Esta pieza ya no está disponible')).toBeInTheDocument()
    expect(screen.queryByText('Anulada.')).not.toBeInTheDocument()
  })

  it('RF27_showsALoadingTextWhileLoading', async () => {
    stubApi({ [DETAIL]: () => new Promise<Response>(() => {}) })
    renderDetail()

    expect(await screen.findByText('Cargando la pieza…')).toHaveAttribute('role', 'status')
  })

  it('RF27_aFailedReadOffersRetryAndTheWayBack', async () => {
    let calls = 0
    stubApi({
      [DETAIL]: () => {
        calls += 1
        return calls <= 2 ? errorResponse(500, 'internal_error', 'Falló.') : jsonResponse(200, piece())
      },
    })
    renderDetail()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: No pudimos cargar la pieza')
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver a Mis piezas' })).toHaveAttribute('href', '/pieces')

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { name: 'Bowl 1', level: 1 })).toBeInTheDocument()
  })

  it('RF27_showsTheNoticeLeftByTheEdit', async () => {
    stubApi({ [DETAIL]: () => jsonResponse(200, piece()) })
    renderDetail({ notice: { kind: 'success', text: 'Guardamos los cambios.' } })

    expect((await screen.findByText('Guardamos los cambios.')).closest('[role="status"]')).toHaveTextContent(
      'Listo: Guardamos los cambios.',
    )
  })
})
