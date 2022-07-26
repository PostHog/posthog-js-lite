import PostHog from '../'
jest.mock('undici')
import undici from 'undici'

const mockedUndici = jest.mocked(undici, true)

const getLastBatchEvents = (): any[] | undefined => {
  expect(mockedUndici.fetch).toHaveBeenCalledWith(
    'http://example.com/batch/',
    expect.objectContaining({ method: 'POST' })
  )

  const call = mockedUndici.fetch.mock.calls.find((x) => (x[0] as string).includes('/batch/'))
  if (!call) {
    return undefined
  }
  return JSON.parse((call[1] as any).body as any).batch
}

describe('PostHog Core', () => {
  let posthog: PostHog

  jest.useFakeTimers()

  beforeEach(() => {
    posthog = new PostHog('TEST_API_KEY', {
      host: 'http://example.com',
    })

    mockedUndici.fetch.mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('ok'),
      json: () =>
        Promise.resolve({
          status: 'ok',
        }),
    } as any)
  })

  describe('legacy methods', () => {
    it('should capture an event to shared queue', async () => {
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(0)
      posthog.capture({ distinctId: '123', event: 'test-event', properties: { foo: 'bar' }, groups: { org: 123 } })

      jest.runOnlyPendingTimers()
      const batchEvents = getLastBatchEvents()
      expect(batchEvents).toMatchObject([
        {
          distinct_id: '123',
          event: 'test-event',
          properties: {
            $groups: { org: 123 },
            foo: 'bar',
          },
        },
      ])
    })

    it('should capture identify events on shared queue', async () => {
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(0)
      posthog.identify({ distinctId: '123', properties: { foo: 'bar' } })
      jest.runOnlyPendingTimers()
      const batchEvents = getLastBatchEvents()
      expect(batchEvents).toMatchObject([
        {
          distinct_id: '123',
          event: '$identify',
          properties: {
            foo: 'bar',
          },
        },
      ])
    })

    it('should capture alias events on shared queue', async () => {
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(0)
      posthog.alias({ distinctId: '123', alias: '1234' })
      jest.runOnlyPendingTimers()
      const batchEvents = getLastBatchEvents()
      expect(batchEvents).toMatchObject([
        {
          distinct_id: '123',
          event: '$create_alias',
          properties: {
            distinct_id: '123',
            alias: '1234',
          },
        },
      ])
    })
  })
})
