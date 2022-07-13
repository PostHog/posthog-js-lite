import { PostHog } from 'posthog-react-native'

const posthog = new PostHog('phc_FzKQvNvps9ZUTxF5KJR9jIKdGb4bq4HNBa9SRyAHi0C', {
  host: 'http://localhost:8000',
  flushAt: 1
})

export default posthog
