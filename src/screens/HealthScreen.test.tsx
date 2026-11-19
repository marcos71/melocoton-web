import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, renderApp } from '../test/utils'

function stubFetch(answer: (request: Request) => Promise<Response>) {
  const fetchFn = vi.fn(answer)
  vi.stubGlobal('fetch', fetchFn)
  return fetchFn
}

describe('HealthScreen', () => {
  it('showsALoadingTextWhileAsking', () => {
    stubFetch(() => new Promise<Response>(() => {}))

    renderApp({ path: '/health', role: null })

    expect(screen.getByRole('heading', { name: 'Estado de la conexión' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Consultando el estado de la API…')
  })

  it('showsApiAndDatabaseUp', async () => {
    const fetchFn = stubFetch(async () => jsonResponse(200, { status: 'UP', database: 'UP' }))

    renderApp({ path: '/health', role: null })

    expect(
      await screen.findByText('✓ La API y la base de datos están funcionando.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Funcionando')).toBeInTheDocument()
    expect(screen.getByText('Conectada')).toBeInTheDocument()
    expect(fetchFn.mock.calls[0]?.[0].url).toBe('http://localhost:8080/api/v1/health')
  })

  it('showsTheDatabaseDownWhenTheApiAnswers503', async () => {
    stubFetch(async () => jsonResponse(503, { status: 'DOWN', database: 'DOWN' }))

    renderApp({ path: '/health', role: null })

    expect(
      await screen.findByText('✕ La API responde, pero algo no está funcionando.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Con problemas')).toBeInTheDocument()
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  })

  it('showsTheErrorAfterRetryingTheReadOnce', async () => {
    const fetchFn = stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    renderApp({ path: '/health', role: null })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se pudo consultar el estado de la API.')
    expect(alert).toHaveTextContent('No se pudo conectar con la API.')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('showsTheBusinessErrorMessageOfTheApi', async () => {
    stubFetch(async () =>
      jsonResponse(500, { error: { code: 'internal_error', message: 'Algo salió mal.' } }),
    )

    renderApp({ path: '/health', role: null })

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal.')
  })

  it('retriesOnDemandAfterAnError', async () => {
    const fetchFn = stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    renderApp({ path: '/health', role: null })
    await screen.findByRole('alert')
    fetchFn.mockImplementation(async () => jsonResponse(200, { status: 'UP', database: 'UP' }))

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(
      await screen.findByText('✓ La API y la base de datos están funcionando.'),
    ).toBeInTheDocument()
  })
})
