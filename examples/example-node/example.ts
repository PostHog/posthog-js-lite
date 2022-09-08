import { PostHog } from 'posthog-node'
// @ts-ignore
import wtf from 'wtfnode'

const posthog = new PostHog('phc_X8B6bhR1QgQKP1WdpFLN82LxLxgZ7WPXDgJyRyvIpib', {
  // host: 'http://127.0.0.1:8000',
  personalApiKey: '',
  featureFlagsPollingInterval: 10000,
  // flushAt: 1,
})

posthog.capture({
  distinctId: '123344',
  event: 'test-event',
  properties: { foo: 'bar' },
  groups: { org: 123 },
  sendFeatureFlags: true,
})
posthog.capture({
  distinctId: '123344',
  event: 'test-event-sans-ffs',
  properties: { foo: 'bar' },
  groups: { org: 123 },
})

async function testFeatureFlags() {
  console.log(await posthog.isFeatureEnabled('beta-feature', 'distinct_id'))
  console.log(await posthog.isFeatureEnabled('beta-feature', 'new_distinct_id'))
  console.log(await posthog.isFeatureEnabled('beta-feature', 'distinct_id', { groups: { company: 'id:5' } }))

  console.log(await posthog.isFeatureEnabled('android-ff-test', 'new_distinct_id'))

  // #############################################################################################
  // # Feature flag local evaluation examples
  // # requires a personal API key to work
  // #############################################################################################

  console.log(await posthog.getAllFlags('random_id_12345'))

  // # Assume test-flag has `City Name = Sydney` as a person property set, then this will evaluate locally & return true
  // console.log('#############################################################################################')
  console.log(
    await posthog.isFeatureEnabled('test-flag', 'random_id_12345', { personProperties: { $geoip_city_name: 'Sydney' } })
  )
  // console.log('#############################################################################################')

  console.log(
    await posthog.isFeatureEnabled('test-flag', 'distinct_id_random_22', {
      personProperties: { $geoip_city_name: 'Sydney' },
      onlyEvaluateLocally: true,
    })
  )

  console.log(await posthog.getAllFlags('distinct_id_random_22'))
  console.log(await posthog.getAllFlags('distinct_id_random_22', { onlyEvaluateLocally: true }))
  console.log(
    await posthog.getAllFlags('distinct_id_random_22', {
      personProperties: { $geoip_city_name: 'Sydney' },
      onlyEvaluateLocally: true,
    })
  )
}

testFeatureFlags().then(async () => {
  wtf.dump()
  await posthog.shutdownAsync()
  wtf.dump()
  console.log('shut down successfully')
})
