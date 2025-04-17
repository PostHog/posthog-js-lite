import { EventHint, StackFrameModifierFn, StackParser } from './types'
import { addUncaughtExceptionListener, addUnhandledRejectionListener } from './autocapture'
import { uuidv7 } from 'posthog-core/src/vendor/uuidv7'
import { propertiesFromUnknownInput } from './error-conversion'
import { EventMessage, PostHogBackendClient, PostHogBackendOptions } from 'posthog-core/src'

const SHUTDOWN_TIMEOUT = 2000

export default class ErrorTracking {
  private client: PostHogBackendClient
  private _exceptionAutocaptureEnabled: boolean
  private stackParser: StackParser | undefined
  private stackFrameModifiers: StackFrameModifierFn[]

  static async captureException(
    client: PostHogBackendClient,
    error: unknown,
    hint: EventHint,
    frameModifiers: StackFrameModifierFn[],
    stackParser?: StackParser,
    distinctId?: string,
    additionalProperties?: Record<string | number, any>
  ): Promise<void> {
    const properties: EventMessage['properties'] = { ...additionalProperties }

    // Given stateless nature of Node SDK we capture exceptions using personless processing when no
    // user can be determined because a distinct_id is not provided e.g. exception autocapture
    if (!distinctId) {
      properties.$process_person_profile = false
    }

    const exceptionProperties = await propertiesFromUnknownInput(stackParser, frameModifiers, error, hint)

    client.capture({
      event: '$exception',
      distinctId: distinctId || uuidv7(),
      properties: {
        ...exceptionProperties,
        ...properties,
      },
    })
  }

  constructor(
    client: PostHogBackendClient,
    options: PostHogBackendOptions,
    stackParser: StackParser | undefined,
    stackFrameModifiers: StackFrameModifierFn[]
  ) {
    this.client = client
    this._exceptionAutocaptureEnabled = options.enableExceptionAutocapture || false
    this.stackParser = stackParser
    this.stackFrameModifiers = stackFrameModifiers

    this.startAutocaptureIfEnabled()
  }

  private startAutocaptureIfEnabled(): void {
    if (this.isEnabled()) {
      addUncaughtExceptionListener(this.onException.bind(this), this.onFatalError.bind(this))
      addUnhandledRejectionListener(this.onException.bind(this))
    }
  }

  private onException(exception: unknown, hint: EventHint): void {
    ErrorTracking.captureException(this.client, exception, hint, this.stackFrameModifiers, this.stackParser)
  }

  private async onFatalError(): Promise<void> {
    await this.client.shutdown(SHUTDOWN_TIMEOUT)
  }

  isEnabled(): boolean {
    return !this.client.isDisabled && this._exceptionAutocaptureEnabled
  }
}
