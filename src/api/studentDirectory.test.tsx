import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { studentDirectoryKey, useCreateStudent, useStudentDirectoryQuery } from './students'
import { createTestQueryClient, jsonResponse, requestsTo, stubApi } from '../test/utils'

describe('student directory (DI-76)', () => {
  it('DI76_asksForTheDirectoryOfTheGivenStatus', async () => {
    const fetchFn = stubApi({
      'GET /api/v1/students/directory': () =>
        jsonResponse(200, [{ id: 1, name: 'Lucía P.', phone: '1155550000', active: true }]),
    })
    const queryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useStudentDirectoryQuery('ALL'), { wrapper })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    const [request] = requestsTo(fetchFn, 'GET /api/v1/students/directory')
    expect(new URL(request?.url ?? '').searchParams.get('status')).toBe('ALL')
    expect(queryClient.getQueryData(studentDirectoryKey('ALL'))).toHaveLength(1)
  })
})

describe('student writes refresh the directory', () => {
  it('DI76_creatingAStudentInvalidatesTheDirectory', async () => {
    stubApi({
      'POST /api/v1/students': () => jsonResponse(201, { id: 5, name: 'Nuevo' }),
    })
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(studentDirectoryKey('ACTIVE'), [])
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useCreateStudent(), { wrapper })
    await act(() =>
      result.current.mutateAsync({
        name: 'Nuevo',
        email: 'n@x.com',
        phone: '1',
        enrollmentType: 'DROP_IN',
      }),
    )

    expect(queryClient.getQueryState(studentDirectoryKey('ACTIVE'))?.isInvalidated).toBe(true)
  })
})
