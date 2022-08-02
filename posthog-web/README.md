# PostHog Web

> 🚧 This is a WIP. Currently the only officially supported way of using PostHog on the web is [posthog-js](https://github.com/PostHog/posthog-js)

This package is currently published to npm as [posthog-js-lite](https://www.npmjs.com/package/posthog-js-lite) and is a simplified version of the recommended and offically supported `posthog-js`.

## Installation

```bash
npm i -s posthog-js-lite
# or
yarn add posthog-js-lite
```

It is entirely written in Typescript and has a minimal API as follows:

```ts
import PostHog from 'posthog-js-lite'

const posthog = new PostHog('my-api-key', {
  /* options, e.g. for self-hosted users */
  // host: "https://my-posthog.app.com"
})

// Capture generic events
posthog.capture('my-event', { myProperty: 'foo' })

// Identify a user (e.g. on login)
posthog.identify('my-unique-user-id', { email: 'exampke@posthog.com', name: 'Jane Doe' })

// Reset a user (e.g. on logout)
posthog.reset()

// Register properties to be sent with all subsequent events
posthog.register({ itemsInBasket: 3 })
// ...or get rid of them if you don't want them anymore
posthog.unregister('itemsInBasket')

// Add the user to a group
posthog.group('organisations', 'org-1')
// ...or multiple groups at once
posthog.group({ organisations: 'org-1', project: 'project-1' })

// Simple feature flags
if (posthog.isFeatureEnabled('my-feature-flag')) {
  renderFlaggedFunctionality()
} else {
  renderDefaultFunctionality()
}

// Multivariate feature flags
if (posthog.getFeatureFlag('my-feature-flag-with-variants') === 'variant1') {
  renderVariant1()
} else if (posthog.getFeatureFlag('my-feature-flag-with-variants') === 'variant2') {
  renderVariant1()
} else if (posthog.getFeatureFlag('my-feature-flag-with-variants') === 'control') {
  renderControl()
}

// Override a feature flag for a specific user (e.g. for testing or user preference)
posthog.overrideFeatureFlag('my-feature-flag', true)

// Listen reactively to feature flag changes
posthog.onFeatureFlag('my-feature-flag', (value) => {
  respondToFeatureFlagChange(value)
})

// Opt users in or out, persisting across sessions (default is they are opted in)
posthog.optOut() // Will stop tracking
posthog.optIn() // Will stop tracking
```
