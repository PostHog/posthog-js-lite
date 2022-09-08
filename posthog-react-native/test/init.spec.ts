import { PostHog } from '../src/posthog-rn'

let posthog: PostHog

describe('PostHog React Native', () => {

    it('should initialize properly with bootstrap', () => {
        posthog = new PostHog('test-token', { bootstrap: { distinctId: 'bar' }, persistence: 'memory' })
        expect(posthog.getAnonymousId()).toEqual('bar')
        expect(posthog.getDistinctId()).toEqual('bar')
    })
})
  