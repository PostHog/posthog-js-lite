import PostHog from '../'

describe('PostHog Core', () => {
  let posthog: PostHog

  jest.useFakeTimers()

  beforeEach(() => {
    posthog = new PostHog('TEST_API_KEY')
  })

  describe('legacy methods', () => {
    it('should capture an event', async () => {
      posthog.user('user-id').capture('what')
    })
  })
})
