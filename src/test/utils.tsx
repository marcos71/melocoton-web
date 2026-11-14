import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../App'
import { createQueryClient } from '../app/queryClient'
import { RoleProvider } from '../auth/RoleProvider'
import type { Role } from '../auth/role'

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** The app's query client, keeping its retry policy but without waiting between retries. */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient()
  const defaults = client.getDefaultOptions()
  client.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retryDelay: 0 } })
  return client
}

export function renderApp({
  role = 'STUDENT',
  path = '/',
  showRoleSwitch = true,
  queryClient = createTestQueryClient(),
}: {
  role?: Role
  path?: string
  showRoleSwitch?: boolean
  queryClient?: QueryClient
} = {}) {
  return render(
    <Providers queryClient={queryClient} role={role} path={path}>
      <AppRoutes showRoleSwitch={showRoleSwitch} />
    </Providers>,
  )
}

function Providers({
  queryClient,
  role,
  path,
  children,
}: {
  queryClient: QueryClient
  role: Role
  path: string
  children: ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider initialRole={role}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </RoleProvider>
    </QueryClientProvider>
  )
}
