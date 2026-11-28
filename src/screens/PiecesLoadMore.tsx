import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/errors'
import { piecesListKey, refetchFromFirstPage, type usePiecesQuery } from '../api/pieces'
import { LoadMore } from '../components/LoadMore'
import { useFocusFirstNew } from '../lib/useFocusFirstNew'

type PiecesLoadMoreProps = {
  query: ReturnType<typeof usePiecesQuery>
  /** The card whose first control receives the focus after a page loads: its link, or its checkbox. */
  cardAt: (index: number) => Element | null | undefined
}

/**
 * "Cargar más piezas" of the teacher's list (DI-87). After a page arrives the focus moves to the
 * first new card; it only moves, it never ticks anything.
 */
export function PiecesLoadMore({ query, cardAt }: PiecesLoadMoreProps) {
  const queryClient = useQueryClient()
  const count = query.data?.length ?? 0
  const focusAt = useCallback(
    (index: number) => cardAt(index)?.querySelector<HTMLElement>('a, input')?.focus(),
    [cardAt],
  )
  const markFirstNew = useFocusFirstNew(count, focusAt)

  const staleCursor =
    query.isFetchNextPageError && query.error instanceof ApiError && query.error.status === 400

  return (
    <LoadMore
      hasNext={query.hasNextPage}
      loading={query.isFetchingNextPage}
      error={query.isFetchNextPageError}
      staleCursor={staleCursor}
      onLoad={() => {
        markFirstNew()
        void query.fetchNextPage()
      }}
      onRefresh={() => void refetchFromFirstPage(queryClient, piecesListKey)}
    />
  )
}
