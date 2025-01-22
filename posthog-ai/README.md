# PostHog Node AI

Initial Typescript SDK for LLM Observability

## Installation

```bash
npm install @posthog/ai
```

## Usage

```typescript
import { OpenAI } from '@posthog/ai'
import { PostHog } from 'posthog-node'

const phClient = new PostHog(
  'sTMFPsFhdP1Ssg',
  { host: 'https://us.i.posthog.com' }
);

const openai = new OpenAI({
  apiKey: 'your_openai_api_key',
  posthog: phClient,
});

// YOU HAVE TO HAVE THIS OR THE CLIENT MAY NOT SEND EVENTS
await phClient.shutdown()
```

LLM Observability [docs](https://posthog.com/docs/ai-engineering/observability)

Please see the main [PostHog docs](https://www.posthog.com/docs).

## Questions?

### [Check out our community page.](https://posthog.com/posts)
