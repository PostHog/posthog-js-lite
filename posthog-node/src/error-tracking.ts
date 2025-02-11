import { EventHint } from './extensions/error-tracking/types'
import { addUncaughtExceptionListener, addUnhandledRejectionListener } from './extensions/error-tracking/autocapture'
import { PostHog, PostHogOptions } from './posthog-node'
import { uuidv7 } from 'posthog-core/src/vendor/uuidv7'
import { propertiesFromUnknownInput } from './extensions/error-tracking/error-conversion'
import { EventMessage } from './types'
import { defaultStackParser } from './extensions/error-tracking/stack-trace'

const SHUTDOWN_TIMEOUT = 2000

export default class ErrorTracking {
  private client: PostHog
  private _exceptionAutocaptureEnabled: boolean

  static async captureException(
    client: PostHog,
    error: unknown,
    distinctId: string,
    hint: EventHint,
    additionalProperties?: Record<string | number, any>
  ): Promise<void> {
    const properties: EventMessage['properties'] = { ...additionalProperties }
    if (!distinctId) {
      properties.$process_person_profile = false
    }

    const exceptionProperties = await propertiesFromUnknownInput(defaultStackParser, error, hint)

    client.capture({
      event: '$exception',
      distinctId: distinctId || uuidv7(),
      properties: {
        ...exceptionProperties,
        ...properties,
      },
    })
  }

  constructor(client: PostHog, options: PostHogOptions) {
    this.client = client
    this._exceptionAutocaptureEnabled = options.enableExceptionAutocapture || false

    this.startAutocaptureIfEnabled()
  }

  private startAutocaptureIfEnabled(): void {
    if (this.isEnabled()) {
      addUncaughtExceptionListener(this.onException.bind(this), this.onFatalError.bind(this))
      addUnhandledRejectionListener(this.onException.bind(this))
    }
  }

  private onException(exception: unknown, hint: EventHint): void {
    // Given stateless nature of Node SDK we capture exceptions using personless processing
    // when no user can be determined e.g. in the case of exception autocapture
    ErrorTracking.captureException(this.client, exception, uuidv7(), hint, { $process_person_profile: false })
  }

  private async onFatalError(): Promise<void> {
    await this.client.shutdown(SHUTDOWN_TIMEOUT)
  }

  isEnabled(): boolean {
    return !this.client.isDisabled && this._exceptionAutocaptureEnabled
  }
}
