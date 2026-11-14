import { QueryClient } from '@tanstack/react-query'

/**
 * Retry policy (CLAUDE.md): a failed read is retried once; an action
 * (mutation) is never retried on its own, so it cannot run twice.
 */
export const QUERY_RETRIES = 1

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: QUERY_RETRIES },
      mutations: { retry: false },
    },
  })
}
