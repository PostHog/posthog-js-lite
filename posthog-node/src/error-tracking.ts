import { EventHint } from 'posthog-node/src/extensions/error-tracking/types'
import { addUncaughtExceptionListener, addUnhandledRejectionListener } from './extensions/error-tracking/autocapture'
import { PostHog, PostHogOptions } from './posthog-node'
import { uuidv7 } from 'posthog-core/src/vendor/uuidv7'
import { errorToEvent } from 'posthog-node/src/extensions/error-tracking/error-conversion'

const SHUTDOWN_TIMEOUT = 2000

export default class ExceptionObserver {
  private client: PostHog
  private _exceptionAutocaptureEnabled: boolean

  constructor(client: PostHog, options: PostHogOptions) {
    this.client = client
    this._exceptionAutocaptureEnabled = options.enableExceptionAutocapture || false

    this.startIfEnabled()
  }

  isEnabled(): boolean {
    return !this.client.isDisabled && this._exceptionAutocaptureEnabled
  }

  private startIfEnabled(): void {
    if (this.isEnabled()) {
      addUncaughtExceptionListener(this.captureException.bind(this), this.onFatalError.bind(this))
      addUnhandledRejectionListener(this.captureException.bind(this))
    }
  }

  private captureException(exception: unknown, hint: EventHint): void {
    // Given stateless nature of Node SDK we capture exceptions using personless processing
    // when no user can be determined e.g. in the case of exception autocapture
    this.client.capture(errorToEvent(exception, uuidv7(), hint, { $process_person_profile: false }))
  }

  private async onFatalError(): Promise<void> {
    await this.client.shutdown(SHUTDOWN_TIMEOUT)
    global.process.exit(1)
  }
}
