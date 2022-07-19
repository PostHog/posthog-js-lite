import { PostHog } from '..'

const TEST_API_KEY = 'TEST_API_KEY'

describe('PosthogWeb', () => {
  let fetch: jest.Mock

  beforeEach(() => {
    ;(globalThis as any).window = {}
    ;(globalThis as any).fetch = fetch = jest.fn(() =>
      Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ status: 'ok' }),
      })
    )
  })

  describe('init', () => {
    it('should initialise', () => {
      const postHog = new PostHog(TEST_API_KEY)
      expect(postHog.enabled).toEqual(true)
    })
  })
})
