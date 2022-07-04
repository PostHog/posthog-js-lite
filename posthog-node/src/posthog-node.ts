import { PostHogCore, PosthogCoreOptions, PostHogFetchOptions, PostHogFetchResponse } from 'posthog-core'
import { version } from '../package.json'

export interface PostHogNodejsOptions extends PosthogCoreOptions {}

export class PostHogNodejs extends PostHogCore {
  private _cachedDistinctId?: string

  constructor(apiKey: string, options: PostHogNodejsOptions) {
    super(apiKey, options)
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    throw Error('not implemented')
  }

  setImmediate(fn: () => void): void {
    return process.nextTick(fn)
  }

  getLibraryId(): string {
    return 'posthog-node'
  }
  getLibraryVersion(): string {
    return version
  }
  getCustomUserAgent(): string {
    return `posthog-node/${version}`
  }

  async getDistinctId(): Promise<string> {
    return ''
  }

  async onSetDistinctId(_: string): Promise<string> {
    return _
  }

  shutdown() {
    this.flush()
  }
}
