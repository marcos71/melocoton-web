import type { ReactNode } from 'react'
import { QueryClientProvider, useMutation } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QUERY_RETRIES, createQueryClient } from './queryClient'

describe('createQueryClient', () => {
  it('retriesReadsOnceAndActionsNever', () => {
    const defaults = createQueryClient().getDefaultOptions()

    expect(defaults.queries?.retry).toBe(1)
    expect(QUERY_RETRIES).toBe(1)
    expect(defaults.mutations?.retry).toBe(false)
  })

  it('aFailedReadIsTriedTwiceInTotal', async () => {
    vi.useFakeTimers()
    try {
      const queryFn = vi.fn().mockRejectedValue(new Error('down'))
      const result = createQueryClient()
        .fetchQuery({ queryKey: ['read'], queryFn })
        .catch((error: unknown) => error)

      await vi.advanceTimersByTimeAsync(60_000)

      expect(await result).toEqual(new Error('down'))
      expect(queryFn).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('aFailedActionIsNotRetried', async () => {
    const client = createQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const mutationFn = vi.fn().mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useMutation({ mutationFn }), { wrapper })

    act(() => result.current.mutate(undefined))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mutationFn).toHaveBeenCalledTimes(1)
  })
})
