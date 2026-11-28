import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient, type ApiClient } from './client'
import { ApiError, NETWORK_ERROR, callApi } from './errors'
import type { PieceStatus } from './pieceTypes'
import { dedupeById, refetchFromFirstPage } from './pagination'
import type { components } from './schema'

export { refetchFromFirstPage } from './pagination'

export type PieceItem = components['schemas']['PieceItemResponse']
export type PieceDetail = components['schemas']['PieceDetailResponse']
export type PiecePage = components['schemas']['PiecePageResponse']
export type ConflictingPiece = components['schemas']['ConflictingPiece']
export type CreatePieceRequest = components['schemas']['CreatePieceRequest']
export type EditPieceRequest = components['schemas']['EditPieceRequest']
export type BulkChangeItem = components['schemas']['BulkChangeItemRequest']
export type BulkChangeResult = components['schemas']['BulkChangeResponse']

export type PieceFilters = { studentId?: number; status?: PieceStatus }

export type ChangePieceStatusInput = {
  id: number
  expectedStatus: PieceStatus
  newStatus: PieceStatus
}

/** Pieces per page for the teachers (DI-88); the student's list uses the API default. */
export const TEACHER_PAGE_SIZE = 100

/** Common prefix of every piece query: invalidating it refreshes all of them. */
export const piecesQueryKey = ['pieces'] as const
export const piecesListKey = [...piecesQueryKey, 'list'] as const
export const pieceDetailRootKey = [...piecesQueryKey, 'detail'] as const
export const pieceDetailKey = (id: number) => [...pieceDetailRootKey, id] as const

/** GET /api/v1/pieces: one page. The filters travel on every page; the cursor is only a position (DI-87). */
export function listPieces(
  { studentId, status, cursor, limit }: PieceFilters & { cursor?: string; limit?: number },
  client: ApiClient = apiClient,
): Promise<PiecePage> {
  return callApi(() =>
    client.GET('/api/v1/pieces', {
      params: {
        query: {
          ...(studentId === undefined ? {} : { studentId }),
          ...(status === undefined ? {} : { status }),
          ...(cursor === undefined ? {} : { cursor }),
          ...(limit === undefined ? {} : { limit }),
        },
      },
    }),
  )
}

/** GET /api/v1/pieces/{id}. */
export function getPiece(id: number, client: ApiClient = apiClient): Promise<PieceDetail> {
  return callApi(() => client.GET('/api/v1/pieces/{id}', { params: { path: { id } } }))
}

/** POST /api/v1/pieces (CU-12). */
export function createPiece(
  input: CreatePieceRequest,
  client: ApiClient = apiClient,
): Promise<PieceDetail> {
  return callApi(() => client.POST('/api/v1/pieces', { body: input }))
}

/** PATCH /api/v1/pieces/{id}: name and notes; an empty string clears the notes. */
export function editPiece(
  id: number,
  input: EditPieceRequest,
  client: ApiClient = apiClient,
): Promise<PieceDetail> {
  return callApi(() =>
    client.PATCH('/api/v1/pieces/{id}', { params: { path: { id } }, body: input }),
  )
}

/** POST /api/v1/pieces/{id}/change-status (CU-13): the API decides if it is an advance or a correction. */
export function changePieceStatus(
  { id, expectedStatus, newStatus }: ChangePieceStatusInput,
  client: ApiClient = apiClient,
): Promise<PieceDetail> {
  return callApi(() =>
    client.POST('/api/v1/pieces/{id}/change-status', {
      params: { path: { id } },
      body: { expectedStatus, newStatus },
    }),
  )
}

/** POST /api/v1/pieces/{id}/void (RF-56): answers 204. */
export function voidPiece(
  id: number,
  reason: string,
  client: ApiClient = apiClient,
): Promise<void> {
  return callApi(() =>
    client.POST('/api/v1/pieces/{id}/void', { params: { path: { id } }, body: { reason } }),
  )
}

/**
 * POST /api/v1/pieces/bulk-change-status (CU-14, DI-69): each item carries the status the person
 * saw and never the target; the API decides it.
 */
export function bulkChangePieceStatus(
  items: BulkChangeItem[],
  client: ApiClient = apiClient,
): Promise<BulkChangeResult> {
  return callApi(() =>
    client.POST('/api/v1/pieces/bulk-change-status', { body: { items } }),
  )
}

const conflictDetailsSchema = z.object({
  pieces: z.array(
    z.object({ id: z.number(), name: z.string(), reason: z.enum(['CHANGED', 'VOIDED']) }),
  ),
})

/** The pieces a `status_conflict` error names (DI-23), or `null` when the details are missing or malformed. */
export function pieceConflictDetails(error: ApiError): ConflictingPiece[] | null {
  const parsed = conflictDetailsSchema.safeParse(error.details)
  return parsed.success ? parsed.data.pieces : null
}

/**
 * The pieces of the teachers, page by page; the screens read the flat `data` and `fetchNextPage` (DI-87).
 * While choosing pieces the list does not refresh on its own, neither on focus nor on reconnect (DI-84).
 */
export function usePiecesQuery(
  filters: PieceFilters,
  { autoRefresh = true }: { autoRefresh?: boolean } = {},
) {
  return useInfiniteQuery({
    // Filters only, never the cursor: pages live in the cache, not in the key.
    queryKey: [...piecesListKey, filters],
    queryFn: ({ pageParam }) =>
      listPieces({ ...filters, cursor: pageParam, limit: TEACHER_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (data) => dedupeById(data.pages),
    refetchOnWindowFocus: autoRefresh,
    refetchOnReconnect: autoRefresh,
  })
}

/** A missing or voided piece is not fixed by trying again, so a 404 is not retried. */
const RETRIES = 1

/**
 * One piece. While it loads, the piece of an already read list stands in: it has no notes and no
 * history yet, so a screen that shows them checks `isPlaceholderData` first.
 */
export function usePieceQuery(id: number) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: pieceDetailKey(id),
    queryFn: () => getPiece(id),
    enabled: Number.isInteger(id) && id > 0,
    placeholderData: (): PieceDetail | undefined => {
      for (const [, data] of queryClient.getQueriesData<InfiniteData<PiecePage>>({
        queryKey: piecesListKey,
      })) {
        const item = data?.pages.flatMap((page) => page.items).find((piece) => piece.id === id)
        if (item) return { ...item, createdAt: item.updatedAt, history: [] }
      }
      return undefined
    },
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < RETRIES,
  })
}

/** After a piece changes, every list starts again from page one (DI-87). */
function refreshPieceLists(queryClient: QueryClient): void {
  void refetchFromFirstPage(queryClient, piecesListKey)
}

/** Lists from page one plus every detail: for when the screen may hold something old. */
function refreshPieces(queryClient: QueryClient): void {
  refreshPieceLists(queryClient)
  void queryClient.invalidateQueries({ queryKey: pieceDetailRootKey })
}

export function useCreatePiece() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePieceRequest) => createPiece(input),
    onSuccess: (piece) => {
      queryClient.setQueryData(pieceDetailKey(piece.id), piece)
      refreshPieceLists(queryClient)
    },
    // student_inactive, a duplicate or a timeout can all mean what is on screen is old.
    onError: () => refreshPieces(queryClient),
  })
}

export function useEditPiece(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EditPieceRequest) => editPiece(id, input),
    onSuccess: (piece) => {
      queryClient.setQueryData(pieceDetailKey(id), piece)
      refreshPieceLists(queryClient)
    },
    onError: () => refreshPieces(queryClient),
  })
}

/** One hook for the list and the detail: the variables say which piece and which change (RN-04 is the API's). */
export function useChangePieceStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ChangePieceStatusInput) => changePieceStatus(input),
    onSuccess: (piece) => {
      queryClient.setQueryData(pieceDetailKey(piece.id), piece)
      refreshPieceLists(queryClient)
    },
    // A conflict (D-34), an invalid transition or a timeout all mean the status on screen is old.
    onError: () => refreshPieces(queryClient),
  })
}

export function useVoidPiece(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => voidPiece(id, reason),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: pieceDetailKey(id) })
      refreshPieceLists(queryClient)
    },
    onError: () => refreshPieces(queryClient),
  })
}

/** The call never arrived: nothing was applied, so the list on screen is still right. */
function neverArrived(error: unknown): boolean {
  return error instanceof ApiError && error.code === NETWORK_ERROR && error.reason !== 'timeout'
}

export function useBulkChangePieceStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: BulkChangeItem[]) => bulkChangePieceStatus(items),
    // After a success or any answer of the API the lists start again from page one (DI-87).
    onSettled: (_result, error) => {
      if (neverArrived(error)) return
      void refetchFromFirstPage(queryClient, piecesListKey)
      void queryClient.invalidateQueries({ queryKey: pieceDetailRootKey })
    },
  })
}
