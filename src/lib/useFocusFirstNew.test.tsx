import { renderHook } from '@testing-library/react'
import { useFocusFirstNew } from './useFocusFirstNew'

describe('useFocusFirstNew', () => {
  it('DI88_focusesTheFirstNewIndexOnceTheCountGrows', () => {
    const focusAt = vi.fn()
    const { result, rerender } = renderHook(({ count }) => useFocusFirstNew(count, focusAt), {
      initialProps: { count: 3 },
    })

    rerender({ count: 4 })
    expect(focusAt).not.toHaveBeenCalled()

    result.current()
    rerender({ count: 4 })
    expect(focusAt).not.toHaveBeenCalled()
    rerender({ count: 6 })
    expect(focusAt).toHaveBeenCalledTimes(1)
    expect(focusAt).toHaveBeenCalledWith(4)

    rerender({ count: 9 })
    expect(focusAt).toHaveBeenCalledTimes(1)
  })
})
