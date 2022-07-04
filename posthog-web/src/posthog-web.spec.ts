import { LZString } from 'posthog-core/src/lz-string'
import { PostHogWeb } from './posthog-web'

const waitForPromises = async () => {
  await new Promise(((globalThis as any).process as any).nextTick)
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
})
