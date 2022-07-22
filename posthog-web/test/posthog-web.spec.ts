/**
 * @jest-environment jsdom
 */

import { PostHog } from '..'

describe('PosthogWeb', () => {
  let fetch: jest.Mock
  jest.useFakeTimers()

  beforeEach(() => {
    ;(global as any).window.fetch = fetch = jest.fn(() =>
      Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ status: 'ok' }),
      })
    ) as any
  })

  describe('init', () => {
    it('should initialise', () => {
      const postHog = new PostHog('TEST_API_KEY', {
        flushAt: 1,
      })
      expect(postHog.optedOut).toEqual(false)

      postHog.capture('test')

      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })
})
