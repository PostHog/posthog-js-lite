import { PostHog } from '../src/posthog-rn'

let posthog: PostHog

describe('PostHog React Native', () => {
  it('should initialize properly with bootstrap', () => {
    posthog = new PostHog('test-token', { bootstrap: { distinctId: 'bar' }, persistence: 'memory' })
    jest.runOnlyPendingTimers()
    expect(posthog.getAnonymousId()).toEqual('bar')
    expect(posthog.getDistinctId()).toEqual('bar')
  })

  it('should initialize properly with bootstrap using async storage', () => {
    posthog = new PostHog('test-token', { bootstrap: { distinctId: 'bar' }, persistence: 'file' })
    jest.runOnlyPendingTimers()
    expect(posthog.getAnonymousId()).toEqual('bar')
    expect(posthog.getDistinctId()).toEqual('bar')
  })
})
