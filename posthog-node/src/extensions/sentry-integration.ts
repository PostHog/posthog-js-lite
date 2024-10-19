/**
 * @file Adapted from [posthog-js](https://github.com/PostHog/posthog-js/blob/8157df935a4d0e71d2fefef7127aa85ee51c82d1/src/extensions/sentry-integration.ts) with modifications for the Node SDK.
 */
import { type PostHog } from '../posthog-node'

import * as SentryTypesV7 from '@sentry/types-v7'
import * as SentryTypesV8 from '@sentry/types'

interface PostHogSentryExceptionProperties {
  $sentry_event_id?: string
  $sentry_exception?: { values?: SentryTypesV7.Exception[] }
  $sentry_exception_message?: string
  $sentry_exception_type?: string
  $sentry_tags: { [key: string]: SentryTypesV7.Primitive }
  $sentry_url?: string
  $exception_type?: string
  $exception_message?: string
  $exception_personURL?: string
}

const NAME = 'posthog-node'

/**
 * This is for Sentry v8 only.
 *
 * Integrate Sentry with PostHog. This will add a direct link to the person in Sentry, and an $exception event in PostHog.
 *
 * ### Usage
 *
 *     Sentry.init({
 *          dsn: 'https://example',
 *          integrations: [
 *              posthogSentryIntegration(posthog)
 *          ]
 *     })
 *
 *     Sentry.setTag(PostHogSentryIntegration.POSTHOG_ID_TAG, 'some distinct id');
 *
 * @param {Object} [posthog] The posthog object
 * @param {string} [posthogHost] Optional: The PostHog host (default: `posthog.com`)
 * @param {string} [organization] Optional: The Sentry organization, used to send a direct link from PostHog to Sentry
 * @param {string} [prefix] Optional: Url of a self-hosted sentry instance (default: https://sentry.io/organizations/)
 */
export function posthogSentryIntegration(
  posthog: PostHog,
  posthogHost?: string,
  organization?: string,
  prefix?: string
): SentryTypesV8.Integration {
  return {
    name: NAME,
    setup(client) {
      const projectId = client?.getDsn()?.projectId
      client.addEventProcessor(
        // @ts-expect-error - EventProcessor in v7 and v8 actually share the same type
        createEventProcessor(posthog, {
          projectId,
          posthogHost,
          organization,
          prefix,
        })
      )
    },
  }
}

/**
 * This is for Sentry v7 only.
 *
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
export class PostHogSentryIntegration implements SentryTypesV7.Integration {
  public readonly name = 'posthog-node'

  public static readonly POSTHOG_ID_TAG = 'posthog_distinct_id'

  public constructor(
    private readonly posthog: PostHog,
    private readonly posthogHost?: string,
    private readonly organization?: string,
    private readonly prefix?: string
  ) {}

  public setupOnce(
    addGlobalEventProcessor: (callback: SentryTypesV7.EventProcessor) => void,
    getCurrentHub: () => SentryTypesV7.Hub
  ): void {
    const projectId = getCurrentHub().getClient()?.getDsn()?.projectId
    addGlobalEventProcessor(
      createEventProcessor(this.posthog, {
        projectId,
        posthogHost: this.posthogHost,
        organization: this.organization,
        prefix: this.prefix,
      })
    )
  }
}

function createEventProcessor(
  posthog: PostHog,
  {
    projectId,
    posthogHost,
    organization,
    prefix,
  }: {
    projectId?: string
    posthogHost?: string
    organization?: string
    prefix?: string
  }
): SentryTypesV7.EventProcessor {
  posthogHost = posthogHost ?? posthog.options.host ?? 'https://us.i.posthog.com'
  return (event) => {
    if (event.exception?.values === undefined || event.exception.values.length === 0) {
      return event
    }

    if (!event.tags) {
      event.tags = {}
    }

    // Get the PostHog user ID from a specific tag, which users can set on their Sentry scope as they need.
    const userId = event.tags[PostHogSentryIntegration.POSTHOG_ID_TAG]?.toString()
    if (userId === undefined) {
      // If we can't find a user ID, don't bother linking the event. We won't be able to send anything meaningful to PostHog without it.
      return event
    }

    event.tags['PostHog Person URL'] = new URL(`/person/${userId}`, posthogHost).toString()

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

    if (organization !== undefined && projectId !== undefined && event.event_id !== undefined) {
      properties.$sentry_url = `${
        prefix ?? 'https://sentry.io/organizations'
      }/${organization}/issues/?project=${projectId}&query=${event.event_id}`
    }

    posthog.capture({ event: '$exception', distinctId: userId, properties })

    return event
  }
}
