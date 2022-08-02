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

describe('PostHog Node.js', () => {
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

  describe('core methods', () => {
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

  describe('feature flags', () => {
    beforeEach(() => {
      const mockFeatureFlags = {
        'feature-1': true,
        'feature-2': true,
        'feature-variant': 'variant',
      }

      mockedUndici.fetch.mockImplementation((url) => {
        if ((url as any).includes('/decide/')) {
          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve('ok'),
            json: () =>
              Promise.resolve({
                featureFlags: mockFeatureFlags,
              }),
          }) as any
        }

        return Promise.resolve({
          status: 200,
          text: () => Promise.resolve('ok'),
          json: () =>
            Promise.resolve({
              status: 'ok',
            }),
        }) as any
      })
    })

    it('should do getFeatureFlag', async () => {
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(0)
      await expect(posthog.getFeatureFlag('feature-variant', '123', { org: '123' })).resolves.toEqual('variant')
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(1)
    })

    it('should do isFeatureEnabled', async () => {
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(0)
      await expect(posthog.isFeatureEnabled('feature-1', '123', false, { org: '123' })).resolves.toEqual(true)
      await expect(posthog.isFeatureEnabled('feature-4', '123', false, { org: '123' })).resolves.toEqual(false)
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(2)
    })
  })
})
