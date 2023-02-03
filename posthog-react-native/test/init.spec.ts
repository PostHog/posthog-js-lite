import { PostHog, getAppProperties } from '../index'

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

  it('should allow customising of native app properties', () => {
    posthog = new PostHog('test-token', { customAppProperties: { $app_name: 'mock' } })

    expect(posthog.getCommonEventProperties()).toEqual({
      $active_feature_flags: undefined,
      $app_name: 'mock',
      $device_type: 'ios',
      $lib: 'posthog-react-native',
      $lib_version: expect.any(String),
      $screen_height: expect.any(Number),
      $screen_width: expect.any(Number),
    })

    const properties = getAppProperties()
    properties.$app_name = 'customised!'
    delete properties.$device_name

    posthog = new PostHog('test-token', { customAppProperties: properties })

    expect(posthog.getCommonEventProperties()).toEqual({
      $active_feature_flags: undefined,
      $device_type: 'ios',
      $lib: 'posthog-react-native',
      $lib_version: expect.any(String),
      $screen_height: expect.any(Number),
      $screen_width: expect.any(Number),
      $app_build: 'mock',
      $app_name: 'customised!', // changed
      $app_namespace: 'mock',
      $app_version: 'mock',
      $device_manufacturer: 'mock',
      // $device_name: 'mock', (deleted)
      $os_name: 'mock',
      $os_version: 'mock',
      $locale: 'mock',
      $timezone: 'mock',
    })
  })
})
