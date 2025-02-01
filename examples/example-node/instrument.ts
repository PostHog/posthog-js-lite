import { PostHogSentryIntegration } from 'posthog-node';
import * as Sentry from '@sentry/node'
Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  integrations: [new PostHogSentryIntegration(posthog)],
});