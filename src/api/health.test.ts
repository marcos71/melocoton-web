import { createApiClient } from './client'
import { ApiError, NETWORK_ERROR, UNEXPECTED_RESPONSE } from './errors'
import { fetchHealth } from './health'
import { jsonResponse } from '../test/utils'

function clientAnswering(answer: (request: Request) => Promise<Response>) {
  const fetchFn = vi.fn(answer)
  return { client: createApiClient('http://api.test', fetchFn), fetchFn }
}

describe('fetchHealth', () => {
  it('callsTheHealthEndpointOfTheConfiguredApi', async () => {
    const { client, fetchFn } = clientAnswering(async () =>
      jsonResponse(200, { status: 'UP', database: 'UP' }),
    )

    await fetchHealth(client)

    const request = fetchFn.mock.calls[0]?.[0]
    expect(request?.method).toBe('GET')
    expect(request?.url).toBe('http://api.test/api/v1/health')
  })

  it('returnsTheStatusWhenEverythingIsUp', async () => {
    const { client } = clientAnswering(async () =>
      jsonResponse(200, { status: 'UP', database: 'UP' }),
    )

    await expect(fetchHealth(client)).resolves.toEqual({ status: 'UP', database: 'UP' })
  })

  it('returnsTheStatusOfA503BecauseItsBodySaysWhatIsDown', async () => {
    const { client } = clientAnswering(async () =>
      jsonResponse(503, { status: 'DOWN', database: 'DOWN' }),
    )

    await expect(fetchHealth(client)).resolves.toEqual({ status: 'DOWN', database: 'DOWN' })
  })

  it('throwsTheBusinessErrorWhenTheApiAnswersWithTheErrorShape', async () => {
    const { client } = clientAnswering(async () =>
      jsonResponse(500, { error: { code: 'internal_error', message: 'Algo salió mal.' } }),
    )

    const error = await fetchHealth(client).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500, code: 'internal_error', message: 'Algo salió mal.' })
  })

  it('throwsAnUnexpectedResponseWhenA503HasAnotherBody', async () => {
    const { client } = clientAnswering(
      async () => new Response('Service Unavailable', { status: 503 }),
    )

    await expect(fetchHealth(client)).rejects.toMatchObject({
      status: 503,
      code: UNEXPECTED_RESPONSE,
    })
  })

  it('throwsANetworkErrorWhenTheApiCannotBeReached', async () => {
    const { client } = clientAnswering(() => Promise.reject(new TypeError('Failed to fetch')))

    await expect(fetchHealth(client)).rejects.toMatchObject({ code: NETWORK_ERROR })
  })
})
