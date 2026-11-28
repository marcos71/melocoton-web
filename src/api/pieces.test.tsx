import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError, toApiError } from './errors'
import {
  TEACHER_PAGE_SIZE,
  bulkChangePieceStatus,
  piecesListKey,
  pieceConflictDetails,
  useChangePieceStatus,
  useCreatePiece,
  useEditPiece,
  useVoidPiece,
  refetchFromFirstPage,
  usePieceQuery,
  usePiecesQuery,
  type PieceItem,
} from './pieces'
import { createTestQueryClient, errorResponse, jsonResponse, requestsTo, stubApi } from '../test/utils'

function piece(id: number, overrides: Partial<PieceItem> = {}): PieceItem {
  return {
    id,
    name: `Pieza ${id}`,
    status: 'BISQUE_FIRED',
    advanceTo: 'GLAZED',
    revertTo: 'IN_PROGRESS',
    updatedAt: '2026-10-29T15:00:00Z',
    student: { id: 7, name: 'Lucía P.' },
    ...overrides,
  }
}

function conflictError(details: unknown): ApiError {
  return toApiError(409, {
    error: { code: 'status_conflict', message: 'Cambió.', details },
  })
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const LIST = 'GET /api/v1/pieces'

describe('pieceConflictDetails', () => {
  it('D34_readsTheConflictingPiecesOfAStatusConflict', () => {
    const error = conflictError({
      pieces: [
        { id: 3, name: 'Bowl', reason: 'CHANGED' },
        { id: 4, name: 'Taza', reason: 'VOIDED' },
      ],
    })

    expect(pieceConflictDetails(error)).toEqual([
      { id: 3, name: 'Bowl', reason: 'CHANGED' },
      { id: 4, name: 'Taza', reason: 'VOIDED' },
    ])
  })

  it('D34_returnsNullWhenTheDetailsAreMissing', () => {
    const error = toApiError(409, { error: { code: 'status_conflict', message: 'Cambió.' } })

    expect(pieceConflictDetails(error)).toBeNull()
  })

  it('D34_returnsNullWhenAReasonIsMalformed', () => {
    const error = conflictError({ pieces: [{ id: 3, name: 'Bowl', reason: 'EXPLODED' }] })

    expect(pieceConflictDetails(error)).toBeNull()
  })
})

describe('bulkChangePieceStatus', () => {
  it('DI69_bulkSendsEachPiecesExpectedStatusAndNoTarget', async () => {
    const fetchFn = stubApi({
      'POST /api/v1/pieces/bulk-change-status': () =>
        jsonResponse(200, {
          operationId: '6f1c4a3e-0000-4000-8000-000000000001',
          newStatus: 'GLAZED',
          count: 2,
          studentCount: 1,
        }),
    })

    const result = await bulkChangePieceStatus([
      { pieceId: 1, expectedStatus: 'BISQUE_FIRED' },
      { pieceId: 2, expectedStatus: 'BISQUE_FIRED' },
    ])

    const [request] = requestsTo(fetchFn, 'POST /api/v1/pieces/bulk-change-status')
    expect(await request?.json()).toEqual({
      items: [
        { pieceId: 1, expectedStatus: 'BISQUE_FIRED' },
        { pieceId: 2, expectedStatus: 'BISQUE_FIRED' },
      ],
    })
    expect(result.newStatus).toBe('GLAZED')
  })
})

describe('usePiecesQuery pagination (DI-87)', () => {
  it('DI87_theFirstPageSendsNoCursor', async () => {
    const fetchFn = stubApi({ [LIST]: () => jsonResponse(200, { items: [piece(1)], nextCursor: null }) })

    const { result } = renderHook(() => usePiecesQuery({}), {
      wrapper: wrapperFor(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    const url = new URL(requestsTo(fetchFn, LIST)[0]?.url ?? '')
    expect(url.searchParams.has('cursor')).toBe(false)
  })

  it('DI88_theTeacherListAsksForLimit100', async () => {
    const fetchFn = stubApi({ [LIST]: () => jsonResponse(200, { items: [], nextCursor: null }) })

    const { result } = renderHook(() => usePiecesQuery({}), {
      wrapper: wrapperFor(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const url = new URL(requestsTo(fetchFn, LIST)[0]?.url ?? '')
    expect(TEACHER_PAGE_SIZE).toBe(100)
    expect(url.searchParams.get('limit')).toBe('100')
  })

  it('DI87_theNextPageSendsTheCursorAndTheSameFilters', async () => {
    const fetchFn = stubApi({
      [LIST]: (request) =>
        new URL(request.url).searchParams.get('cursor')
          ? jsonResponse(200, { items: [piece(2)], nextCursor: null })
          : jsonResponse(200, { items: [piece(1)], nextCursor: 'abc' }),
    })

    const { result } = renderHook(() => usePiecesQuery({ studentId: 7, status: 'BISQUE_FIRED' }), {
      wrapper: wrapperFor(createTestQueryClient()),
    })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(() => result.current.fetchNextPage())

    await waitFor(() => expect(result.current.data).toHaveLength(2))
    const second = new URL(requestsTo(fetchFn, LIST)[1]?.url ?? '')
    expect(second.searchParams.get('cursor')).toBe('abc')
    expect(second.searchParams.get('studentId')).toBe('7')
    expect(second.searchParams.get('status')).toBe('BISQUE_FIRED')
    expect(second.searchParams.get('limit')).toBe('100')
  })

  it('DI87_duplicatedIdsAcrossPagesShowOnce', async () => {
    stubApi({
      [LIST]: (request) =>
        new URL(request.url).searchParams.get('cursor')
          ? jsonResponse(200, { items: [piece(1, { name: 'Repetida' }), piece(2)], nextCursor: null })
          : jsonResponse(200, { items: [piece(1)], nextCursor: 'abc' }),
    })

    const { result } = renderHook(() => usePiecesQuery({}), {
      wrapper: wrapperFor(createTestQueryClient()),
    })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(() => result.current.fetchNextPage())

    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(result.current.data?.map((item) => item.id)).toEqual([1, 2])
    expect(result.current.data?.[0]?.name).toBe('Pieza 1')
  })

  it('DI87_refetchFromFirstPageKeepsOnlyPageOneAndRefetchesIt', async () => {
    let firstPageCalls = 0
    const fetchFn = stubApi({
      [LIST]: (request) => {
        if (new URL(request.url).searchParams.get('cursor')) {
          return jsonResponse(200, { items: [piece(2)], nextCursor: null })
        }
        firstPageCalls += 1
        return jsonResponse(200, { items: [piece(1)], nextCursor: 'abc' })
      },
    })
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => usePiecesQuery({}), { wrapper: wrapperFor(queryClient) })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(() => result.current.fetchNextPage())
    await waitFor(() => expect(result.current.data).toHaveLength(2))

    await act(() => refetchFromFirstPage(queryClient, piecesListKey))

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(firstPageCalls).toBe(2)
    // The refetch started from page one: no cursor on the last request.
    const requests = requestsTo(fetchFn, LIST)
    const last = new URL(requests[requests.length - 1]?.url ?? '')
    expect(last.searchParams.has('cursor')).toBe(false)
  })
})

describe('refreshing after a piece mutation (DI-87)', () => {
  const CHANGE = 'POST /api/v1/pieces/1/change-status'

  function twoPageList() {
    return (request: Request) =>
      new URL(request.url).searchParams.get('cursor')
        ? jsonResponse(200, { items: [piece(2)], nextCursor: null })
        : jsonResponse(200, { items: [piece(1)], nextCursor: 'abc' })
  }

  async function loadTwoPages<T>(queryClient: QueryClient, useMutationHook: () => T) {
    const view = renderHook(
      () => ({ list: usePiecesQuery({}), mutation: useMutationHook() }),
      { wrapper: wrapperFor(queryClient) },
    )
    await waitFor(() => expect(view.result.current.list.hasNextPage).toBe(true))
    await act(() => view.result.current.list.fetchNextPage())
    await waitFor(() => expect(view.result.current.list.data).toHaveLength(2))
    return view
  }

  function expectLastListRequestFromPageOne(fetchFn: { mock: { calls: unknown[][] } }) {
    const requests = requestsTo(fetchFn, LIST)
    const last = new URL(requests[requests.length - 1]?.url ?? '')
    expect(last.searchParams.has('cursor')).toBe(false)
  }

  it('DI87_anIndividualStatusChangeRefreshesFromPageOne', async () => {
    const fetchFn = stubApi({
      [LIST]: twoPageList(),
      [CHANGE]: () => jsonResponse(200, { ...piece(1), status: 'GLAZED' }),
    })
    const view = await loadTwoPages(createTestQueryClient(), useChangePieceStatus)
    const before = requestsTo(fetchFn, LIST).length

    await act(() =>
      view.result.current.mutation.mutateAsync({ id: 1, expectedStatus: 'BISQUE_FIRED', newStatus: 'GLAZED' }),
    )

    await waitFor(() => expect(view.result.current.list.data).toHaveLength(1))
    const after = requestsTo(fetchFn, LIST).slice(before)
    expect(after.length).toBeGreaterThan(0)
    expect(after.every((request) => !new URL(request.url).searchParams.has('cursor'))).toBe(true)
    expectLastListRequestFromPageOne(fetchFn)
  })

  it('DI87_aFailedStatusChangeRefreshesTheListFromPageOneAndTheDetail', async () => {
    const fetchFn = stubApi({
      [LIST]: twoPageList(),
      'GET /api/v1/pieces/1': () => jsonResponse(200, { ...piece(1), createdAt: '2026-10-29T15:00:00Z', history: [] }),
      [CHANGE]: () => errorResponse(409, 'status_conflict', 'Cambió.'),
    })
    const queryClient = createTestQueryClient()
    const view = await loadTwoPages(queryClient, useChangePieceStatus)
    const detail = renderHook(() => usePieceQuery(1), { wrapper: wrapperFor(queryClient) })
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true))
    const listBefore = requestsTo(fetchFn, LIST).length
    const detailBefore = requestsTo(fetchFn, 'GET /api/v1/pieces/1').length

    await act(() =>
      view.result.current.mutation
        .mutateAsync({ id: 1, expectedStatus: 'BISQUE_FIRED', newStatus: 'GLAZED' })
        .catch(() => undefined),
    )

    await waitFor(() => expect(view.result.current.list.data).toHaveLength(1))
    await waitFor(() =>
      expect(requestsTo(fetchFn, 'GET /api/v1/pieces/1').length).toBeGreaterThan(detailBefore),
    )
    const after = requestsTo(fetchFn, LIST).slice(listBefore)
    expect(after.every((request) => !new URL(request.url).searchParams.has('cursor'))).toBe(true)
  })

  async function expectRefreshFromPageOne<T>(
    useMutationHook: () => T,
    route: string,
    response: () => Response,
    run: (mutation: T) => Promise<unknown>,
  ) {
    const fetchFn = stubApi({ [LIST]: twoPageList(), [route]: response })
    const view = await loadTwoPages(createTestQueryClient(), useMutationHook)
    const before = requestsTo(fetchFn, LIST).length

    await act(() => run(view.result.current.mutation))

    await waitFor(() => expect(view.result.current.list.data).toHaveLength(1))
    const after = requestsTo(fetchFn, LIST).slice(before)
    expect(after.every((request) => !new URL(request.url).searchParams.has('cursor'))).toBe(true)
  }

  it('DI87_creatingAPieceRefreshesFromPageOne', () =>
    expectRefreshFromPageOne(
      useCreatePiece,
      'POST /api/v1/pieces',
      () => jsonResponse(201, piece(3)),
      (mutation) => mutation.mutateAsync({ studentId: 7, name: 'Nueva' }),
    ))

  it('DI87_editingAPieceRefreshesFromPageOne', () =>
    expectRefreshFromPageOne(
      () => useEditPiece(1),
      'PATCH /api/v1/pieces/1',
      () => jsonResponse(200, piece(1)),
      (mutation) => mutation.mutateAsync({ name: 'Otro' }),
    ))

  it('DI87_voidingAPieceRefreshesFromPageOne', () =>
    expectRefreshFromPageOne(
      () => useVoidPiece(1),
      'POST /api/v1/pieces/1/void',
      () => new Response(null, { status: 204 }),
      (mutation) => mutation.mutateAsync('Motivo'),
    ))
})
