import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCreateMyPiece, useEditMyPiece, useMyPieceQuery, useMyPiecesQuery } from './myPieces'
import {
  createTestQueryClient,
  errorResponse,
  jsonResponse,
  requestsTo,
  stubApi,
} from '../test/utils'

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function item(id: number) {
  return { id, name: `Pieza ${id}`, status: 'IN_PROGRESS', updatedAt: '2026-10-29T15:00:00Z' }
}

const LIST = 'GET /api/v1/students/me/pieces'

describe('useMyPiecesQuery (DI-87)', () => {
  it('DI87_theStudentListPagesWithTheCursorAndSendsNoLimit', async () => {
    const fetchFn = stubApi({
      [LIST]: (request) =>
        new URL(request.url).searchParams.get('cursor')
          ? jsonResponse(200, { items: [item(2)], nextCursor: null })
          : jsonResponse(200, { items: [item(1)], nextCursor: 'abc' }),
    })

    const { result } = renderHook(() => useMyPiecesQuery(), {
      wrapper: wrapperFor(createTestQueryClient()),
    })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(() => result.current.fetchNextPage())

    await waitFor(() => expect(result.current.data).toHaveLength(2))
    const [first, second] = requestsTo(fetchFn, LIST).map((request) => new URL(request.url))
    expect(first?.searchParams.has('cursor')).toBe(false)
    expect(first?.searchParams.has('limit')).toBe(false)
    expect(second?.searchParams.get('cursor')).toBe('abc')
  })
})

describe('useMyPieceQuery', () => {
  it('CP22_aMissingPieceIsNotRetried', async () => {
    const fetchFn = stubApi({
      'GET /api/v1/students/me/pieces/9': () => errorResponse(404, 'not_found', 'No existe.'),
    })

    const { result } = renderHook(() => useMyPieceQuery(9), {
      wrapper: wrapperFor(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(requestsTo(fetchFn, 'GET /api/v1/students/me/pieces/9')).toHaveLength(1)
  })
})

describe('refreshing after a mutation (DI-87)', () => {
  it('DI87_creatingOrEditingMyPieceRefreshesFromPageOne', async () => {
    const fetchFn = stubApi({
      [LIST]: (request) =>
        new URL(request.url).searchParams.get('cursor')
          ? jsonResponse(200, { items: [item(2)], nextCursor: null })
          : jsonResponse(200, { items: [item(1)], nextCursor: 'abc' }),
      'POST /api/v1/students/me/pieces': () => jsonResponse(201, item(3)),
      'PATCH /api/v1/students/me/pieces/1': () => jsonResponse(200, item(1)),
    })
    const { result } = renderHook(
      () => ({ list: useMyPiecesQuery(), create: useCreateMyPiece(), edit: useEditMyPiece(1) }),
      { wrapper: wrapperFor(createTestQueryClient()) },
    )

    for (const run of [
      () => result.current.create.mutateAsync({ name: 'Nueva' }),
      () => result.current.edit.mutateAsync({ name: 'Otro' }),
    ]) {
      await waitFor(() => expect(result.current.list.hasNextPage).toBe(true))
      await act(() => result.current.list.fetchNextPage())
      await waitFor(() => expect(result.current.list.data).toHaveLength(2))
      const before = requestsTo(fetchFn, LIST).length

      await act(run)

      await waitFor(() => expect(result.current.list.data).toHaveLength(1))
      const after = requestsTo(fetchFn, LIST).slice(before)
      expect(after.every((request) => !new URL(request.url).searchParams.has('cursor'))).toBe(true)
    }
  })
})
