import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 48rem)'

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia?.(QUERY)
  list?.addEventListener('change', onChange)
  return () => list?.removeEventListener('change', onChange)
}

function snapshot(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false
}

/** Whether the screen is at least 768 px wide (desktop layouts). */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
