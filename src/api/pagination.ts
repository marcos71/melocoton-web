import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'

/** Flattens the loaded pages keeping the first occurrence of each id: a piece can move between pages while someone pages through (DI-87). */
export function dedupeById<T extends { id: number }>(pages: readonly { items: readonly T[] }[]): T[] {
  const seen = new Set<number>()
  const unique: T[] = []
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      unique.push(item)
    }
  }
  return unique
}

/**
 * Keeps only the first page of every matching list and refetches it (DI-87): the page-1-again
 * refresh. The first page stays on screen while it reloads, so there is no skeleton flash.
 */
export function refetchFromFirstPage(queryClient: QueryClient, queryKey: QueryKey): Promise<void> {
  queryClient.setQueriesData<InfiniteData<unknown>>(
    { queryKey },
    (data) =>
      data && { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
  )
  return queryClient.invalidateQueries({ queryKey })
}
