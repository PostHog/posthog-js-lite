import PostHog from '..'

describe('PostHog React Native', () => {
  let posthog: PostHog

  jest.useFakeTimers()

  beforeEach(() => {
    posthog = new PostHog('TEST_API_KEY')
  })

  describe('legacy methods', () => {
    it('should capture an event', () => {
      posthog.capture('what')
      expect(1).toEqual(2)
    })
  })
})
