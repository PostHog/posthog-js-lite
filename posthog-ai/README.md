# PostHog Node AI

Initial Typescript SDK for LLM Observability

// before

```typescript
import { OpenAI } from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello, world!' }],
})
```

// after

```typescript
import { OpenAI } from 'posthog-node-ai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  posthog: phClient,
})

client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello, world!' }],
  posthog_distinct_id: 'test-user-id',
  posthog_properties: {
    test_property: 'test_value',
  },
})
```

Please see the main [PostHog docs](https://www.posthog.com/docs).

Specifically, the [Node.js docs](https://posthog.com/docs/libraries/node-ai) details.

## Questions?

### [Check out our community page.](https://posthog.com/posts)
