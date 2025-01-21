# PostHog Node AI

Initial Typescript SDK for LLM Observability

## Installation

```bash
yarn add @posthog/posthog-ai
```

## Usage

### Before

```typescript
import { OpenAI } from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello, world!' }],
})
```

### After

```typescript
import { OpenAI } from 'posthog-node-ai'
import { PostHog } from 'posthog-node'

const phClient = new PostHog(
  process.env.POSTHOG_API_KEY, {
    host: process.env.POSTHOG_HOST || 'https://us.posthog.com',
  }
})

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  posthog: phClient,
})

await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello, world!' }],
  posthog_distinct_id: 'test-user-id',
  posthog_properties: {
    test_property: 'test_value',
  }
})

// YOU HAVE TO HAVE THIS OR THE CLIENT MAY NOT SEND EVENTS
await phClient.shutdown()
```

Please see the main [PostHog docs](https://www.posthog.com/docs).

## Questions?

### [Check out our community page.](https://posthog.com/posts)
