import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const LIST = 'GET /api/v1/students/me/pieces'

function item(id: number, name: string, status = 'IN_PROGRESS') {
  return { id, name, status, updatedAt: '2026-10-29T15:00:00Z' }
}

function page(items: ReturnType<typeof item>[], nextCursor: string | null = null) {
  return jsonResponse(200, { items, nextCursor })
}

function renderList(state?: unknown) {
  return renderApp({ role: 'STUDENT', path: '/pieces', state })
}

describe('MyPiecesScreen', () => {
  it('RF31_listsMyPiecesWithStatusStepAndDate', async () => {
    stubApi({ [LIST]: () => page([item(1, 'Bowl 1', 'BISQUE_FIRED'), item(2, 'Taza')]) })
    renderList()

    const link = await screen.findByRole('link', { name: 'Bowl 1, Bizcochada, paso 2 de 4' })
    expect(link).toHaveAttribute('href', '/pieces/1')
    expect(within(link).getByText('Paso 2 de 4')).toBeInTheDocument()
    expect(within(link).getByText('Actualizada el 29 de oct de 2026')).toBeInTheDocument()
    expect(within(link).getByText('Ver historial ›')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Taza, En proceso, paso 1 de 4' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mis piezas' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Nueva pieza' })).toHaveAttribute('href', '/pieces/new')
    expect(screen.getByText('No se muestran piezas anuladas.')).toBeInTheDocument()
  })

  it('RNF02_eachCardShowsTheStatusAsText', async () => {
    stubApi({
      [LIST]: () =>
        page([
          item(1, 'Uno', 'IN_PROGRESS'),
          item(2, 'Dos', 'BISQUE_FIRED'),
          item(3, 'Tres', 'GLAZED'),
          item(4, 'Cuatro', 'FINISHED'),
        ]),
    })
    renderList()

    const cards = await screen.findAllByRole('listitem')
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('En proceso'),
      expect.stringContaining('Bizcochada'),
      expect.stringContaining('Esmaltada'),
      expect.stringContaining('Terminada'),
    ])
  })

  it('CU15_showsTheEmptyStateWithCreateFirstPiece', async () => {
    stubApi({ [LIST]: () => page([]) })
    renderList()

    expect(await screen.findByRole('heading', { name: 'Todavía no tenés piezas' })).toBeInTheDocument()
    expect(
      screen.getByText('Cuando crees una o la docente la cargue, la vas a ver acá con su estado.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear mi primera pieza' })).toHaveAttribute(
      'href',
      '/pieces/new',
    )
    // One primary action only.
    expect(screen.queryByRole('link', { name: 'Nueva pieza' })).not.toBeInTheDocument()
  })

  it('RF31_showsALoadingTextWhileLoading', async () => {
    stubApi({ [LIST]: () => new Promise<Response>(() => {}) })
    renderList()

    expect(await screen.findByText('Cargando tus piezas…')).toHaveAttribute('role', 'status')
  })

  it('RF31_showsTheErrorAfterOneRetryAndRecovers', async () => {
    let calls = 0
    const fetchFn = stubApi({
      [LIST]: () => {
        calls += 1
        return calls <= 2 ? errorResponse(500, 'internal_error', 'Falló.') : page([item(1, 'Bowl 1')])
      },
    })
    renderList()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Error: No pudimos cargar tus piezas')
    expect(requestsTo(fetchFn, LIST)).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('link', { name: /Bowl 1/ })).toBeInTheDocument()
  })

  it('RF31_doesNotOfferTheIdeasEntry', async () => {
    stubApi({ [LIST]: () => page([item(1, 'Bowl 1')]) })
    renderList()

    await screen.findByRole('link', { name: /Bowl 1/ })
    expect(screen.queryByText(/Ideas/)).not.toBeInTheDocument()
  })

  it('RF31_showsTheNoticeLeftByAnotherScreen', async () => {
    stubApi({ [LIST]: () => page([item(1, 'Bowl 1')]) })
    renderList({ notice: { kind: 'success', text: 'Guardamos los cambios.' } })

    expect((await screen.findByText('Guardamos los cambios.')).closest('[role="status"]')).toHaveTextContent(
      'Listo: Guardamos los cambios.',
    )
  })

  it('DI87_loadMoreAppendsTheNextPageAndDisappearsOnTheLast', async () => {
    const fetchFn = stubApi({
      [LIST]: (request) =>
        new URL(request.url).searchParams.get('cursor') === 'c1'
          ? page([item(2, 'Taza')])
          : page([item(1, 'Bowl 1')], 'c1'),
    })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más piezas' }))

    expect(await screen.findByRole('link', { name: /Taza/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Bowl 1/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cargar más piezas' })).not.toBeInTheDocument()
    const [, second] = requestsTo(fetchFn, LIST)
    expect(new URL(second?.url ?? '').searchParams.get('cursor')).toBe('c1')
  })

  it('DI87_loadingTheNextPageDisablesTheButtonAndKeepsTheCards', async () => {
    stubApi({
      [LIST]: (request) =>
        new URL(request.url).searchParams.get('cursor')
          ? new Promise<Response>(() => {})
          : page([item(1, 'Bowl 1')], 'c1'),
    })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más piezas' }))

    expect(await screen.findByRole('button', { name: 'Cargando más piezas…' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando más piezas…')
    expect(screen.getByRole('link', { name: /Bowl 1/ })).toBeInTheDocument()
  })

  it('DI87_aFailedNextPageKeepsTheLoadedPiecesAndOffersRetry', async () => {
    let failing = true
    stubApi({
      [LIST]: (request) => {
        if (!new URL(request.url).searchParams.get('cursor')) return page([item(1, 'Bowl 1')], 'c1')
        return failing ? errorResponse(500, 'internal_error', 'Falló.') : page([item(2, 'Taza')])
      },
    })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más piezas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: No pudimos cargar más piezas.')
    expect(screen.getByRole('link', { name: /Bowl 1/ })).toBeInTheDocument()

    failing = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('link', { name: /Taza/ })).toBeInTheDocument()
  })

  it('DI87_aStaleCursorOffersToRefreshTheList', async () => {
    const fetchFn = stubApi({
      [LIST]: (request) =>
        new URL(request.url).searchParams.get('cursor')
          ? errorResponse(400, 'validation_error', 'Cursor inválido.')
          : page([item(1, 'Bowl 1')], 'c1'),
    })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más piezas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: La lista cambió mientras la mirabas.',
    )
    const before = requestsTo(fetchFn, LIST).length
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar lista' }))

    await screen.findByRole('button', { name: 'Cargar más piezas' })
    const fresh = requestsTo(fetchFn, LIST).slice(before)
    expect(fresh.length).toBeGreaterThan(0)
    expect(fresh.every((request) => !new URL(request.url).searchParams.has('cursor'))).toBe(true)
  })

  it('DI87_afterLoadingMoreFocusGoesToTheFirstNewPiece', async () => {
    stubApi({
      [LIST]: (request) =>
        new URL(request.url).searchParams.get('cursor')
          ? page([item(2, 'Taza'), item(3, 'Plato')])
          : page([item(1, 'Bowl 1')], 'c1'),
    })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más piezas' }))

    const first = await screen.findByRole('link', { name: /Taza/ })
    expect(first).toHaveFocus()
    expect(screen.getByRole('link', { name: /Plato/ })).not.toHaveFocus()
  })
})
