import { JsonType, PostHogPersistedProperty } from 'posthog-core'

export class PostHogMemoryStorage {
  private _memoryStorage: { [key: string]: JsonType | undefined } = {}

  getProperty(key: PostHogPersistedProperty): JsonType | undefined {
    return this._memoryStorage[key]
  }

  setProperty(key: PostHogPersistedProperty, value: JsonType | null): void {
    this._memoryStorage[key] = value !== null ? value : undefined
  }
}
