import { useCallback, useEffect, useRef } from 'react'

/**
 * Focus for "Cargar más" lists (DI-88): the returned function marks the current `count` as the
 * first new index (call it right before fetching the next page); once `count` grows past it,
 * `focusAt(index)` runs once. It only moves the focus. `focusAt` must be stable (`useCallback`).
 */
export function useFocusFirstNew(count: number, focusAt: (index: number) => void): () => void {
  const firstNewIndex = useRef<number | null>(null)

  useEffect(() => {
    const index = firstNewIndex.current
    if (index === null || count <= index) return
    firstNewIndex.current = null
    focusAt(index)
  }, [count, focusAt])

  return useCallback(() => {
    firstNewIndex.current = count
  }, [count])
}
