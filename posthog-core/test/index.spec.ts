import { LZString } from 'posthog-core/src/lz-string'
import { PostHogWeb } from 'posthog-web/src/posthog-web'
// import { version } from 'posthog-web/package.json'
import { wait } from './test-utils'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

const waitForPromises = async () => {
  await new Promise(((globalThis as any).process as any).nextTick)
}

const TEST_API_KEY = 'TEST_API_KEY'

// We use the web as the basis for core tests
const PosthogClient = PostHogWeb

describe('PostHog Core', () => {
  let fetch: jest.Mock
  let posthog: PostHogWeb

  beforeEach(() => {
    ;(globalThis as any).fetch = fetch = jest.fn(() =>
      Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ status: 'ok' }),
      })
    )

    posthog = new PosthogClient(TEST_API_KEY)
  })

  describe('init', () => {
    it('should initialise', () => {
      expect(posthog.enabled).toEqual(true)
    })

    it('should throw if missing api key', () => {
      expect(() => new PosthogClient((undefined as unknown) as string)).toThrowError(
        "You must pass your PostHog project's api key."
      )
    })

    it('should create an empty queue', () => {
      expect((posthog as any)._queue).toEqual([])
    })

    it('should initialise default options', () => {
      expect(posthog as any).toMatchObject({
        apiKey: 'TEST_API_KEY',
        host: 'https://app.posthog.com',
        flushAt: 20,
        flushInterval: 10000,
      })
    })

    it('overwrites defaults with options', () => {
      const client = new PosthogClient('key', {
        host: 'https://a.com',
        flushAt: 1,
        flushInterval: 2,
      })

      expect(client as any).toMatchObject({
        apiKey: 'key',
        host: 'https://a.com',
        flushAt: 1,
        flushInterval: 2,
      })
    })

    it('should keep the flushAt option above zero', () => {
      const client = new PosthogClient('key', { flushAt: -2 }) as any
      expect(client.flushAt).toEqual(1)
    })

    it('should remove trailing slashes from `host`', () => {
      const client = new PosthogClient(TEST_API_KEY, { host: 'http://my-posthog.com///' })

      expect((client as any).host).toEqual('http://my-posthog.com')
    })
  })

  describe('enqueue', () => {
    it('should add a message to the queue', () => {
      const timestamp = new Date()
      posthog.enqueue('type', { timestamp })

      expect((posthog as any)._queue).toHaveLength(1)

      const item = (posthog as any)._queue.pop()

      expect(item).toEqual({
        message: {
          timestamp,
          library: 'posthog-web',
          library_version: version,
          type: 'type',
        },
      })
    })

    it('should not modify the original message', () => {
      const message = { event: 'test' }
      posthog.enqueue('type', message)
      expect(message).toEqual({ event: 'test' })
    })

    // NOTE: This was from nodejs lib. Do we want this?
    // it('should flush on first message', () => {
    //   const client = new PosthogClient('key', { flushAt: 2 })
    //   client.flush = jest.fn()

    //   client.enqueue('type', {})
    //   expect(client.flush).toHaveBeenCalledTimes(1)

    //   client.enqueue('type', {})
    //   expect(client.flush).toHaveBeenCalledTimes(1)

    //   client.enqueue('type', {})
    //   expect(client.flush).toHaveBeenCalledTimes(2)
    // })

    it('should flush the queue if it hits the max length', () => {
      const client = new PosthogClient('key', {
        flushAt: 1,
        flushInterval: undefined,
      })
      client.flush = jest.fn()
      client.enqueue('type', {})
      expect(client.flush).toHaveBeenCalledTimes(1)
    })

    it('should flush after a period of time', async () => {
      const client = new PosthogClient('key', {
        flushInterval: 10,
      })
      client.flush = jest.fn()
      client.enqueue('type', {})
      expect(client.flush).toHaveBeenCalledTimes(0)
      await wait(20)
      expect(client.flush).toHaveBeenCalledTimes(1)
    })

    it('should not reset an existing timer', async () => {
      const client = new PosthogClient('key', {
        flushInterval: 10,
      })
      client.flush = jest.fn()
      client.enqueue('type', {})
      expect(client.flush).toHaveBeenCalledTimes(0)
      await wait(5)
      expect(client.flush).toHaveBeenCalledTimes(0)
      await wait(5)
      expect(client.flush).toHaveBeenCalledTimes(1)
    })

    it('should skip when client is disabled', async () => {
      posthog.flush = jest.fn()
      posthog.disable()
      posthog.enqueue('type', {})

      expect((posthog as any)._queue).toHaveLength(0)
      expect(posthog.flush).toHaveBeenCalledTimes(0)
    })
  })

  describe('capture', () => {
    it('should capture an event', async () => {
      const postHog = new PosthogClient(TEST_API_KEY, { flushAt: 1 })
      postHog.capture('hi there!')
      await waitForPromises()

      expect(fetch).toHaveBeenCalledTimes(1)
      const [url, options] = fetch.mock.calls[0]
      expect(url).toMatch(/^https:\/\/app\.posthog\.com\/e\/\?ip=1&_=[0-9]+&v=[0-9\.a-z\-]+$/)
      expect(options.method).toBe('POST')
      const bodyText = decodeURIComponent(options.body.split('&')[0].split('=')[1])
      const body = JSON.parse(LZString.decompressFromBase64(bodyText) || '')

      expect(body.api_key).toBe(TEST_API_KEY)
      expect(body.batch[0].event).toBe('hi there!')
    })
  })
})

// it("flush - don't fail when queue is empty", async () => {
//   const client = createClient()

//   await t.notThrows(() => client.flush())
// })

// it('flush - send messages', async () => {
//   const client = createClient({ flushAt: 2 })

//   const callbackA = spy()
//   const callbackB = spy()
//   const callbackC = spy()

//   client.queue = [
//     {
//       message: 'a',
//       callback: callbackA,
//     },
//     {
//       message: 'b',
//       callback: callbackB,
//     },
//     {
//       message: 'c',
//       callback: callbackC,
//     },
//   ]

//   const data = await client.flush()
//   t.deepEqual(Object.keys(data), ['api_key', 'batch'])
//   t.deepEqual(data.batch, ['a', 'b'])
//   t.true(callbackA.calledOnce)
//   t.true(callbackB.calledOnce)
//   t.false(callbackC.called)
// })

// it('flush - respond with an error', async () => {
//   const client = createClient()
//   const callback = spy()

//   client.queue = [
//     {
//       message: 'error',
//       callback,
//     },
//   ]

//   await t.throwsAsync(() => client.flush(), { message: 'Bad Request' })
// })

// it('flush - time out if configured', async () => {
//   const client = createClient({ timeout: 500 })
//   const callback = spy()

//   client.queue = [
//     {
//       message: 'timeout',
//       callback,
//     },
//   ]
//   await t.throwsAsync(() => client.flush(), { message: 'timeout of 500ms exceeded' })
// })

// it('flush - skip when client is disabled', async () => {
//   const client = createClient({ enable: false })
//   const callback = spy()

//   client.queue = [
//     {
//       message: 'test',
//       callback,
//     },
//   ]

//   await client.flush()

//   t.false(callback.called)
// })

// it('identify - enqueue a message', () => {
//   const client = createClient()
//   stub(client, 'enqueue')

//   const message = { distinctId: 'id', properties: { fish: 'swim in the sea' } }
//   client.identify(message, noop)

//   const apiMessage = {
//     distinctId: 'id',
//     $set: { fish: 'swim in the sea' },
//     event: '$identify',
//     properties: { $lib: 'posthog-node', $lib_version: version },
//   }

//   t.true(client.enqueue.calledOnce)
//   t.deepEqual(client.enqueue.firstCall.args, ['identify', apiMessage, noop])
// })

// it('identify - require a distinctId or alias', () => {
//   const client = createClient()
//   stub(client, 'enqueue')

//   t.throws(() => client.identify(), { message: 'You must pass a message object.' })
//   t.throws(() => client.identify({}), { message: 'You must pass a "distinctId".' })
//   t.notThrows(() => client.identify({ distinctId: 'id' }))
// })

// it('capture - enqueue a message', () => {
//   const client = createClient()
//   stub(client, 'enqueue')

//   const message = {
//     distinctId: '1',
//     event: 'event',
//   }
//   const apiMessage = {
//     distinctId: '1',
//     properties: { $lib: 'posthog-node', $lib_version: version },
//     event: 'event',
//   }

//   client.capture(message, noop)

//   t.true(client.enqueue.calledOnce)
//   t.deepEqual(client.enqueue.firstCall.args, ['capture', apiMessage, noop])
// })

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

// it('capture - require event and either distinctId or alias', () => {
//   const client = createClient()
//   stub(client, 'enqueue')

//   t.throws(() => client.capture(), { message: 'You must pass a message object.' })
//   t.throws(() => client.capture({}), { message: 'You must pass a "distinctId".' })
//   t.throws(() => client.capture({ distinctId: 'id' }), { message: 'You must pass an "event".' })
//   t.notThrows(() => {
//     client.capture({
//       distinctId: 'id',
//       event: 'event',
//     })
//   })
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

// it('groupIdentify - enqueue a message', () => {
//   const client = createClient()
//   stub(client, 'enqueue')

//   const message = {
//     groupType: 'company',
//     groupKey: 'id:5',
//     properties: { foo: 'bar' },
//   }
//   const apiMessage = {
//     properties: {
//       $group_type: 'company',
//       $group_key: 'id:5',
//       $group_set: { foo: 'bar' },
//       $lib: 'posthog-node',
//       $lib_version: version,
//     },
//     event: '$groupidentify',
//     distinctId: '$company_id:5',
//   }

//   client.groupIdentify(message, noop)

//   t.true(client.enqueue.calledOnce)
//   t.deepEqual(client.enqueue.firstCall.args, ['capture', apiMessage, noop])
// })

// it('groupIdentify - require groupType and groupKey', () => {
//   const client = createClient()
//   stub(client, 'enqueue')

//   t.throws(() => client.groupIdentify(), { message: 'You must pass a message object.' })
//   t.throws(() => client.groupIdentify({}), { message: 'You must pass a "groupType".' })
//   t.throws(() => client.groupIdentify({ groupType: 'company' }), { message: 'You must pass a "groupKey".' })
//   t.notThrows(() => {
//     client.groupIdentify({
//       groupType: 'company',
//       groupKey: 'id:5',
//     })
//   })
// })

// it('isErrorRetryable', () => {
//   const client = createClient()

//   t.false(client._isErrorRetryable({}))

//   // ETIMEDOUT is retryable as per `is-retry-allowed` (used by axios-retry in `isNetworkError`).
//   t.true(client._isErrorRetryable({ code: 'ETIMEDOUT' }))

//   // ECONNABORTED is not retryable as per `is-retry-allowed` (used by axios-retry in `isNetworkError`).
//   t.false(client._isErrorRetryable({ code: 'ECONNABORTED' }))

//   t.true(client._isErrorRetryable({ response: { status: 500 } }))
//   t.true(client._isErrorRetryable({ response: { status: 429 } }))

//   t.false(client._isErrorRetryable({ response: { status: 200 } }))
// })

// it('allows messages > 32 kB', () => {
//   const client = createClient()

//   const event = {
//     distinctId: 1,
//     event: 'event',
//     properties: {},
//   }
//   for (var i = 0; i < 10000; i++) {
//     event.properties[i] = 'a'
//   }

//   t.notThrows(() => {
//     client.capture(event, noop)
//   })
// })

// it('feature flags - require personalApiKey', async () => {
//   const client = createClient()

//   await t.throwsAsync(() => client.isFeatureEnabled('simpleFlag', 'some id'), {
//     message: 'You have to specify the option personalApiKey to use feature flags.',
//   })

//   client.shutdown()
// })

// it('feature flags - require key, distinctId, defaultValue', async () => {
//   const client = createClient({ personalApiKey: 'my very secret key' })

//   await t.throwsAsync(() => client.isFeatureEnabled(), { message: 'You must pass a "key".' })
//   await t.throwsAsync(() => client.isFeatureEnabled(null), { message: 'You must pass a "key".' })
//   await t.throwsAsync(() => client.isFeatureEnabled('my-flag'), { message: 'You must pass a "distinctId".' })
//   await t.throwsAsync(() => client.isFeatureEnabled('my-flag', 'some-id', 'default-value'), {
//     message: '"defaultResult" must be a boolean.',
//   })
//   await t.throwsAsync(() => client.isFeatureEnabled('my-flag', 'some-id', false, 'foobar'), {
//     message: 'You must pass an object for "groups".',
//   })

//   client.shutdown()
// })

// test.serial('feature flags - isSimpleFlag', async () => {
//   const client = createClient({ personalApiKey: 'my very secret key' })

//   const isEnabled = await client.isFeatureEnabled('simpleFlag', 'some id')

//   t.is(isEnabled, true)
//   t.is(callsDecide({ groups: {}, distinct_id: 'some id', token: 'key' }), false)

//   client.shutdown()
// })

// test.serial('feature flags - complex flags', async () => {
//   const client = createClient({ personalApiKey: 'my very secret key' })

//   const expectedEnabledFlag = await client.isFeatureEnabled('enabled-flag', 'some id')
//   const expectedDisabledFlag = await client.isFeatureEnabled('disabled-flag', 'some id')

//   t.is(expectedEnabledFlag, true)
//   t.is(expectedDisabledFlag, false)
//   t.is(callsDecide({ groups: {}, distinct_id: 'some id', token: 'key' }), true)

//   client.shutdown()
// })

// test.serial('feature flags - group analytics', async () => {
//   const client = createClient({ personalApiKey: 'my very secret key' })

//   const expectedEnabledFlag = await client.isFeatureEnabled('enabled-flag', 'some id', false, { company: 'id:5' })

//   t.is(expectedEnabledFlag, true)
//   t.is(callsDecide({ groups: { company: 'id:5' }, distinct_id: 'some id', token: 'key' }), true)

//   client.shutdown()
// })

// test.serial('feature flags - default override', async () => {
//   const client = createClient({ personalApiKey: 'my very secret key' })

//   let flagEnabled = await client.isFeatureEnabled('i-dont-exist', 'some id')
//   t.is(flagEnabled, false)

//   flagEnabled = await client.isFeatureEnabled('i-dont-exist', 'some id', true)
//   t.is(flagEnabled, true)

//   client.shutdown()
// })

// it('feature flags - simple flag calculation', async () => {
//   const client = createClient({ personalApiKey: 'my very secret key' })

//   // This tests that the hashing + mathematical operations across libs are consistent
//   let flagEnabled = client.featureFlagsPoller._isSimpleFlagEnabled({
//     key: 'a',
//     distinctId: 'b',
//     rolloutPercentage: 42,
//   })
//   t.is(flagEnabled, true)

//   flagEnabled = client.featureFlagsPoller._isSimpleFlagEnabled({ key: 'a', distinctId: 'b', rolloutPercentage: 40 })
//   t.is(flagEnabled, false)

//   client.shutdown()
// })

// it('feature flags - handles errrors when flag reloads', async () => {
//   const client = createClient({ personalApiKey: 'my very secret key for error' })

//   t.notThrows(() => client.featureFlagsPoller.loadFeatureFlags(true))

//   client.shutdown()
// })

// it('feature flags - ignores logging errors when posthog:node is not set', async () => {
//   t.is(process.env.DEBUG, undefined)

//   const logger = spy(console, 'log')

//   const client = createClient({ personalApiKey: 'my very secret key for error' })

//   t.notThrows(() => client.featureFlagsPoller.loadFeatureFlags(true))

//   t.is(logger.called, false)

//   client.shutdown()
//   logger.restore()
// })
