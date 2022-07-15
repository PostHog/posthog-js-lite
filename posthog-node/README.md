# Posthog Node.JS

## Usage

```js
import PostHog from 'posthog-node-next'

// Instantiate the Posthog SDK
const posthog = new PostHog(
  'sTMFPsFhdP1Ssg',
  { host: 'https://app.posthog.com' } // You can omit this line if using PostHog Cloud
)

// On program exit, call shutdown to stop pending pollers and flush any remaining events
process.on('exit', () => {
  posthog.shutdown()
})

// elsewhere in your app

const user = Database.getUser()

// When user properties change
posthog.user(user.id).identify(user.id, {
  email: user.email,
})

// When the relevant user does something
posthog.user(user.id).capture('movie played', {
  movieId: '123',
})

// Check if a feature is enabled for a user
await posthog.user(user.id).isFeatureEnabled('flag-key')
```
