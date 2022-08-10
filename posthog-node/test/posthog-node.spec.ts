// import PostHog from '../'
import { PostHogGlobal as PostHog } from '../src/posthog-node'
jest.mock('undici')
import undici from 'undici'
import { decideImplementation, localEvaluationImplementation } from './feature-flags.spec'
import { waitForPromises } from '../../posthog-core/test/test-utils/test-utils'

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

  afterEach(async () => {
    // ensure clean shutdown & no test interdependencies
    await posthog.shutdownAsync()
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

      mockedUndici.fetch.mockImplementation(decideImplementation(mockFeatureFlags))

      posthog = new PostHog('TEST_API_KEY', {
        host: 'http://example.com',
        // flushAt: 1,
      })
    })

    it('should do getFeatureFlag', async () => {
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(0)
      await expect(posthog.getFeatureFlag('feature-variant', '123', false, { org: '123' })).resolves.toEqual('variant')
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(1)
    })

    it('should do isFeatureEnabled', async () => {
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(0)
      await expect(posthog.isFeatureEnabled('feature-1', '123', false, { org: '123' })).resolves.toEqual(true)
      await expect(posthog.isFeatureEnabled('feature-4', '123', false, { org: '123' })).resolves.toEqual(false)
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(2)
    })

    it('captures feature flags when no personal API key is present', async () => {
      mockedUndici.fetch.mockClear()
      mockedUndici.request.mockClear()
      expect(mockedUndici.fetch).toHaveBeenCalledTimes(0)

      posthog = new PostHog('TEST_API_KEY', {
        host: 'http://example.com',
        flushAt: 1,
      })

      posthog.capture({
        distinctId: 'distinct_id',
        event: 'node test event',
        sendFeatureFlags: true,
      })

      expect(mockedUndici.fetch).toHaveBeenCalledWith(
        'http://example.com/decide/?v=2',
        expect.objectContaining({ method: 'POST' })
      )

      jest.runOnlyPendingTimers()

      await waitForPromises()

      const batchEvents = getLastBatchEvents()
      expect(batchEvents).toMatchObject([
        {
          distinct_id: 'distinct_id',
          event: 'node test event',
          properties: expect.objectContaining({
            $active_feature_flags: ['feature-1', 'feature-2', 'feature-variant'],
            '$feature/feature-1': true,
            '$feature/feature-2': true,
            '$feature/feature-variant': 'variant',
            $lib: 'posthog-node',
            $lib_version: expect.stringContaining('2.0'),
          }),
        },
      ])

      // no calls to `/local_evaluation`
      expect(mockedUndici.request).not.toHaveBeenCalled()
    })

    it('manages memory well when sending feature flags', async () => {
      const flags = {
        flags: [
          {
            id: 1,
            name: 'Beta Feature',
            key: 'beta-feature',
            active: true,
            filters: {
              groups: [
                {
                  properties: [],
                  rollout_percentage: 100,
                },
              ],
            },
          },
        ],
      }
      mockedUndici.request.mockImplementation(localEvaluationImplementation(flags))

      mockedUndici.fetch.mockImplementation(decideImplementation({ 'beta-feature': 'decide-fallback-value' }))

      posthog = new PostHog('TEST_API_KEY', {
        host: 'http://example.com',
        personalApiKey: 'TEST_PERSONAL_API_KEY',
        maxCacheSize: 10,
      })

      expect(Object.keys(posthog.distinctIdHasSentFlagCalls).length).toEqual(0)

      for (let i = 0; i < 1000; i++) {
        const distinctId = `some-distinct-id${i}`
        await posthog.getFeatureFlag('beta-feature', distinctId)

        jest.runOnlyPendingTimers()

        const batchEvents = getLastBatchEvents()
        expect(batchEvents).toMatchObject([
          {
            distinct_id: distinctId,
            event: '$feature_flag_called',
            properties: expect.objectContaining({
              $feature_flag: 'beta-feature',
              $feature_flag_response: true,
              $lib: 'posthog-node',
              $lib_version: expect.stringContaining('2.0'),
              locally_evaluated: true,
            }),
          },
        ])
        mockedUndici.fetch.mockClear()

        expect(Object.keys(posthog.distinctIdHasSentFlagCalls).length <= 10).toEqual(true)
      }
    })
  })
})
