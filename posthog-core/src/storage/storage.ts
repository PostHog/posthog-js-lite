import { PostHogPersistedProperty } from '../types'

export interface PostHogStorage {
  getProperty(key: PostHogPersistedProperty): any | undefined

  setProperty(key: PostHogPersistedProperty, value: any | null): void
}