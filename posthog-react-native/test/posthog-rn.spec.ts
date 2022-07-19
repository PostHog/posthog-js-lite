import PostHog from '..'

describe('PostHog Core', () => {
  let posthog: PostHog

  jest.useFakeTimers()

  beforeEach(() => {
    posthog = new PostHog('TEST_API_KEY')
  })

  describe('legacy methods', () => {
    it('should capture an event', () => {
      console.log('HEY')
      posthog.capture('what')
      expect(1).toEqual(2)
      console.log("HEY2")
    })  
  })
})
