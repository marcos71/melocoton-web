import { useCallback } from 'react'

/** Ref callback for a screen's `h1` (with `tabIndex={-1}`): the focus goes there on entering (1.4). */
export function useHeadingFocus() {
  return useCallback((element: HTMLElement | null) => element?.focus(), [])
}
