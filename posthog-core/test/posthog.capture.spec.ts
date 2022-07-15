import { parseBody } from './test-utils/test-utils'
import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  jest.useFakeTimers()

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 })
  })

  describe('capture', () => {
    it('should capture an event', async () => {
      jest.setSystemTime(new Date('2022-01-01'))

      posthog.capture('custom-event')

      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      const [url, options] = mocks.fetch.mock.calls[0]
      expect(url).toMatch(/^https:\/\/app\.posthog\.com\/e\/\?ip=1&_=[0-9]+&v=[0-9\.a-z\-]+$/)
      expect(options.method).toBe('POST')
      const body = parseBody(mocks.fetch.mock.calls[0])

      expect(body).toEqual({
        api_key: 'TEST_API_KEY',
        batch: [
          {
            event: 'custom-event',
            distinct_id: posthog.getDistinctId(),
            library: 'posthog-core-tests',
            library_version: '2.0.0-alpha',
            properties: {
              $lib: 'posthog-core-tests',
              $lib_version: '2.0.0-alpha',
            },
            timestamp: '2022-01-01T00:00:00.000Z',
            type: 'capture',
          },
        ],
        sent_at: '2022-01-01T00:00:00.000Z',
      })
    })
  })
})
// it('capture - enqueue a message with groups', () => {
//   const client = createClient()
//   stub(client, 'enqueue')

//   const message = {
//     distinctId: '1',
//     event: 'event',
//     groups: { company: 'id: 5' },
//   }
//   const apiMessage = {
//     distinctId: '1',
//     properties: { $groups: { company: 'id: 5' }, $lib: 'posthog-node', $lib_version: version },
//     event: 'event',
//   }

//   client.capture(message, noop)

//   t.true(client.enqueue.calledOnce)
//   t.deepEqual(client.enqueue.firstCall.args, ['capture', apiMessage, noop])
// })

// it('alias - enqueue a message', () => {
//   const client = createClient()
//   stub(client, 'enqueue')

//   const message = {
//     distinctId: 'id',
//     alias: 'id',
//   }
//   const apiMessage = {
//     properties: { distinct_id: 'id', alias: 'id', $lib: 'posthog-node', $lib_version: version },
//     event: '$create_alias',
//     distinct_id: 'id',
//   }

//   client.alias(message, noop)

//   t.true(client.enqueue.calledOnce)
//   t.deepEqual(client.enqueue.firstCall.args, ['alias', apiMessage, noop])
// })

// it('alias - require alias and distinctId', () => {
//   const client = createClient()
//   stub(client, 'enqueue')

//   t.throws(() => client.alias(), { message: 'You must pass a message object.' })
//   t.throws(() => client.alias({}), { message: 'You must pass a "distinctId".' })
//   t.throws(() => client.alias({ distinctId: 'id' }), { message: 'You must pass a "alias".' })
//   t.notThrows(() => {
//     client.alias({
//       distinctId: 'id',
//       alias: 'id',
//     })
//   })
// })

// test.serial('feature flags - default override', async () => {
//   const client = createClient({ personalApiKey: 'my very secret key' })

//   let flagEnabled = await client.isFeatureEnabled('i-dont-exist', 'some id')
//   t.is(flagEnabled, false)

//   flagEnabled = await client.isFeatureEnabled('i-dont-exist', 'some id', true)
//   t.is(flagEnabled, true)

//   client.shutdown()
// })
