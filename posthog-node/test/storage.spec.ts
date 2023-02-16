import { jest, describe, expect, it } from '@jest/globals'
import fs from 'fs'
import { PostHogFsStorage } from '../../posthog-core/src/storage/storage-fs'
import { PostHogPersistedProperty } from '../../posthog-core/src/types'

describe('PostHog Node.js', () => {
  // jest.useRealTimers()

  describe('storage', () => {
    it('should load storage from the file system', async () => {
      jest.mock('fs')
      const mockedFs = jest.mocked(fs)
      const storage = new PostHogFsStorage('')
      mockedFs.existsSync.mockReturnValue(true)
      mockedFs.readFileSync.mockReturnValue(
        JSON.stringify({
          [PostHogPersistedProperty.AnonymousId]: 'test',
        })
      )

      const res = storage.getProperty(PostHogPersistedProperty.AnonymousId)
      expect(mockedFs.existsSync).toBeCalledTimes(1)
      expect(mockedFs.readFileSync).toBeCalledTimes(1)
      expect(res).toEqual(
        JSON.stringify({
          [PostHogPersistedProperty.AnonymousId]: 'test',
        })
      )
    })

    it('should save storage to the file system', async () => {
      jest.mock('fs')
      const mockedFs = jest.mocked(fs)
      const storage = new PostHogFsStorage('/config.json')
      storage.setProperty(PostHogPersistedProperty.AnonymousId, 'test')

      expect(mockedFs.writeFileSync).toBeCalledTimes(1)
      expect(mockedFs.writeFileSync).toBeCalledWith(
        '/config.json',
        JSON.stringify({
          [PostHogPersistedProperty.AnonymousId]: 'test',
        })
      )
    })
  })
})
