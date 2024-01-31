import { PostHogPersistedProperty } from './types'

export class PostHogMemoryStorage {
  private _memoryStorage: { [key: string]: any | undefined } = {}

  getItem(key: PostHogPersistedProperty): any | undefined {
    return this._memoryStorage[key]
  }

  setItem(key: PostHogPersistedProperty, value: any | null): void {
    this._memoryStorage[key] = value !== null ? value : undefined
  }
}
