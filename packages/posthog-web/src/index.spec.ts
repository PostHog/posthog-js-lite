import { LZString } from 'posthog-core/src/lz-string'
import { PostHogWeb } from '.'

const waitForPromises = async () => {
  await new Promise((process as any).nextTick)
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

test('capture makes a window.fetch call', async () => {
  expect(true).toBe(true)

  const postHog = new PostHogWeb('API_KEY_WAS_HERE')

  const mockFetch = jest.fn()
  postHog.fetch = mockFetch
  postHog.capture('hi there!')
  await waitForPromises()

  expect(mockFetch).toHaveBeenCalledTimes(1)
  const [url, options] = mockFetch.mock.calls[0]
  expect(url).toMatch(/^https:\/\/app\.posthog\.com\/e\/\?ip=1&_=[0-9]+&v=[0-9\.a-z\-]+$/)
  expect(options.method).toBe('POST')
  const bodyText = decodeURIComponent(options.body.split('&')[0].split('=')[1])
  const body = JSON.parse(LZString.decompressFromBase64(bodyText) || '')

  expect(body.api_key).toBe('API_KEY_WAS_HERE')
  expect(body.batch[0].event).toBe('hi there!')
})
