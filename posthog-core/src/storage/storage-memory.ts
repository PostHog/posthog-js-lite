import { PostHogPersistedProperty } from '../types'
import { PostHogStorage } from './storage'

export class PostHogMemoryStorage implements PostHogStorage {
  private _memoryStorage: Record<string, any | undefined> = {}

  getProperty(key: PostHogPersistedProperty): any | undefined {
    return this._memoryStorage[key]
  }

  setProperty(key: PostHogPersistedProperty, value: any | null): void {
    this._memoryStorage[key] = value !== null ? value : undefined
  }
}
