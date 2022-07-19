import { PostHogNodejsGlobal } from '../'

describe('PostHog Core', () => {
  let posthog: PostHogNodejsGlobal

  jest.useFakeTimers()

  beforeEach(() => {
    posthog = new PostHogNodejsGlobal('TEST_API_KEY')
  })

  describe('legacy methods', () => {
    it('should capture an event', async () => {
      posthog.user('user-id').capture('what')
    })  
  })
})
