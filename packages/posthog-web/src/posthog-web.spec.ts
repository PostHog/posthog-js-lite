import { LZString } from 'posthog-core/src/lz-string'
import { PostHogWeb } from './posthog-web'

const waitForPromises = async () => {
  await new Promise(((globalThis as any).process as any).nextTick)
}

const testWindow = {
  navigator: {
    userAgent: 'not me / Mozilla',
  },
  document: {
    referrer: '',
  },
  location: {
    href: 'http://example.com/',
    host: 'example.com',
    pathname: '/',
  },
  screen: {
    width: 640,
    height: 480,
  },
}

const TEST_API_KEY = 'TEST_API_KEY'

describe('PosthogWeb', () => {
  let fetch: jest.Mock
  beforeEach(() => {
    ;(globalThis as any).fetch = fetch = jest.fn(() =>
      Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ status: 'ok' }),
      })
    )
  })

  describe('init', () => {
    it('should initialise', () => {
      const postHog = new PostHogWeb(TEST_API_KEY)

      expect(postHog.enabled).toEqual(true)
    })
  })

  describe('capture', () => {
    it('should capture an event', async () => {
      const postHog = new PostHogWeb(TEST_API_KEY)
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
