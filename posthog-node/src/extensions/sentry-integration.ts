/**
 * @file Adapted from [posthog-js](https://github.com/PostHog/posthog-js/blob/8157df935a4d0e71d2fefef7127aa85ee51c82d1/src/extensions/sentry-integration.ts) with modifications for the Node SDK.
 */
import { type PostHog } from '../posthog-node'

// NOTE - we can't import from @sentry/types because it changes frequently and causes clashes
// We only use a small subset of the types, so we can just define the integration overall and use any for the rest

// import {
//     Event as _SentryEvent,
//     EventProcessor as _SentryEventProcessor,
//     Exception as _SentryException,
//     Hub as _SentryHub,
//     Integration as _SentryIntegration,
//     Primitive as _SentryPrimitive,
// } from '@sentry/types'

// Uncomment the above and comment the below to get type checking for development

type _SentryEvent = any
type _SentryEventProcessor = any
type _SentryHub = any
type _SentryException = any
type _SentryPrimitive = any

interface _SentryIntegration {
  name: string
  setupOnce(addGlobalEventProcessor: (callback: _SentryEventProcessor) => void, getCurrentHub: () => _SentryHub): void
}

interface PostHogSentryExceptionProperties {
  $sentry_event_id?: string
  $sentry_exception?: { values?: _SentryException[] }
  $sentry_exception_message?: string
  $sentry_exception_type?: string
  $sentry_tags: { [key: string]: _SentryPrimitive }
  $sentry_url?: string
  $exception_type?: string
  $exception_message?: string
  $exception_personURL?: string
}

/**
 * Integrate Sentry with PostHog. This will add a direct link to the person in Sentry, and an $exception event in PostHog.
 *
 * ### Usage
 *
 *     Sentry.init({
 *          dsn: 'https://example',
 *          integrations: [
 *              new PostHogSentryIntegration(posthog)
 *          ]
 *     })
 *
 *     Sentry.setTag(PostHogSentryIntegration.POSTHOG_ID_TAG, 'some distinct id');
 *
 * @param {Object} [posthog] The posthog object
 * @param {string} [organization] Optional: The Sentry organization, used to send a direct link from PostHog to Sentry
 * @param {Number} [projectId] Optional: The Sentry project id, used to send a direct link from PostHog to Sentry
 * @param {string} [prefix] Optional: Url of a self-hosted sentry instance (default: https://sentry.io/organizations/)
 */
export class PostHogSentryIntegration implements _SentryIntegration {
  public readonly name = 'posthog-node'

  public static readonly POSTHOG_ID_TAG = 'posthog_distinct_id'

  public constructor(
    private readonly posthog: PostHog,
    private readonly posthogHost?: string,
    private readonly organization?: string,
    private readonly prefix?: string
  ) {
    this.posthogHost = posthog.options.host ?? 'https://app.posthog.com'
  }

  public setupOnce(
    addGlobalEventProcessor: (callback: _SentryEventProcessor) => void,
    getCurrentHub: () => _SentryHub
  ): void {
    addGlobalEventProcessor((event: _SentryEvent): _SentryEvent => {
      if (event.exception?.values === undefined || event.exception.values.length === 0) {
        return event
      }

      if (!event.tags) {
        event.tags = {}
      }

      const sentry = getCurrentHub()

      // Get the PostHog user ID from a specific tag, which users can set on their Sentry scope as they need.
      const userId = event.tags[PostHogSentryIntegration.POSTHOG_ID_TAG]
      if (userId === undefined) {
        // If we can't find a user ID, don't bother linking the event. We won't be able to send anything meaningful to PostHog without it.
        return event
      }

      event.tags['PostHog Person URL'] = new URL(`/person/${userId}`, this.posthogHost).toString()

      const properties: PostHogSentryExceptionProperties = {
        // PostHog Exception Properties
        $exception_message: event.exception.values[0]?.value,
        $exception_type: event.exception.values[0]?.type,
        $exception_personURL: event.tags['PostHog Person URL'],
        // Sentry Exception Properties
        $sentry_event_id: event.event_id,
        $sentry_exception: event.exception,
        $sentry_exception_message: event.exception.values[0]?.value,
        $sentry_exception_type: event.exception.values[0]?.type,
        $sentry_tags: event.tags,
      }

      const projectId = sentry.getClient()?.getDsn()?.projectId
      if (this.organization !== undefined && projectId !== undefined && event.event_id !== undefined) {
        properties.$sentry_url = `${this.prefix ?? 'https://sentry.io/organizations'}/${
          this.organization
        }/issues/?project=${projectId}&query=${event.event_id}`
      }

      this.posthog.capture({ event: '$exception', distinctId: userId, properties })

      return event
    })
  }
}
