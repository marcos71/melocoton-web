import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, type ApiClient } from './client'
import { ApiError, callApi } from './errors'
import { dedupeById, refetchFromFirstPage } from './pagination'
import type { components } from './schema'

export type MyPieceItem = components['schemas']['MyPieceItemResponse']
export type MyPieceDetail = components['schemas']['MyPieceDetailResponse']
export type MyPiecePage = components['schemas']['MyPiecePageResponse']
export type CreateMyPieceRequest = components['schemas']['CreateMyPieceRequest']
export type EditMyPieceRequest = components['schemas']['EditPieceRequest']

/** The student's own pieces live under their own prefix, so they never mix with the teachers' (D-29). */
export const myPiecesQueryKey = ['myPieces'] as const
export const myPiecesListKey = [...myPiecesQueryKey, 'list'] as const
export const myPieceDetailKey = (id: number) => [...myPiecesQueryKey, 'detail', id] as const

/** GET /api/v1/students/me/pieces: one page, most recently updated first (DI-87). */
export function listMyPieces(
  { cursor }: { cursor?: string } = {},
  client: ApiClient = apiClient,
): Promise<MyPiecePage> {
  return callApi(() =>
    client.GET('/api/v1/students/me/pieces', {
      params: { query: cursor === undefined ? {} : { cursor } },
    }),
  )
}

/** GET /api/v1/students/me/pieces/{id}: 404 for a voided, missing or another student's piece. */
export function getMyPiece(id: number, client: ApiClient = apiClient): Promise<MyPieceDetail> {
  return callApi(() =>
    client.GET('/api/v1/students/me/pieces/{id}', { params: { path: { id } } }),
  )
}

/** POST /api/v1/students/me/pieces (CU-12). */
export function createMyPiece(
  input: CreateMyPieceRequest,
  client: ApiClient = apiClient,
): Promise<MyPieceDetail> {
  return callApi(() => client.POST('/api/v1/students/me/pieces', { body: input }))
}

/** PATCH /api/v1/students/me/pieces/{id}: name and notes, only while the piece is In progress. */
export function editMyPiece(
  id: number,
  input: EditMyPieceRequest,
  client: ApiClient = apiClient,
): Promise<MyPieceDetail> {
  return callApi(() =>
    client.PATCH('/api/v1/students/me/pieces/{id}', { params: { path: { id } }, body: input }),
  )
}

/** The student's pieces, page by page; the screens read the flat `data` and `fetchNextPage` (DI-87). */
export function useMyPiecesQuery() {
  return useInfiniteQuery({
    queryKey: myPiecesListKey,
    queryFn: ({ pageParam }) => listMyPieces({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (data) => dedupeById(data.pages),
  })
}

/** A missing piece is not fixed by trying again, so a 404 is not retried. */
const RETRIES = 1

export function useMyPieceQuery(id: number) {
  return useQuery({
    queryKey: myPieceDetailKey(id),
    queryFn: () => getMyPiece(id),
    enabled: Number.isInteger(id) && id > 0,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < RETRIES,
  })
}

export function useCreateMyPiece() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMyPieceRequest) => createMyPiece(input),
    onSuccess: (piece) => {
      queryClient.setQueryData(myPieceDetailKey(piece.id), piece)
      void refetchFromFirstPage(queryClient, myPiecesListKey)
    },
  })
}

export function useEditMyPiece(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EditMyPieceRequest) => editMyPiece(id, input),
    onSuccess: (piece) => {
      queryClient.setQueryData(myPieceDetailKey(id), piece)
      void refetchFromFirstPage(queryClient, myPiecesListKey)
    },
    onError: (error) => {
      // A 404 or piece_not_editable means the piece on screen is old: the detail read has to find out.
      if (error instanceof ApiError && (error.status === 404 || error.code === 'piece_not_editable')) {
        void queryClient.invalidateQueries({ queryKey: myPieceDetailKey(id) })
      }
    },
  })
}
