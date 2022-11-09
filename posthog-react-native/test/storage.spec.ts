import * as FileSystem from 'expo-file-system'
import { SemiAsyncStorage } from '../src/storage'
import { buildOptimisiticAsyncStorage } from '../src/native-deps'

jest.mock('expo-file-system')
const mockedFileSystem = jest.mocked(FileSystem, true)

describe('PostHog React Native', () => {
  jest.useRealTimers()

  const storage = new SemiAsyncStorage(buildOptimisiticAsyncStorage())

  describe('storage', () => {
    beforeEach(() => {
      mockedFileSystem.readAsStringAsync.mockImplementation(() => {
        const res = Promise.resolve(
          JSON.stringify({
            version: 'v1',
            content: {
              foo: 'bar',
            },
          })
        )
        return res
      })
    })

    it('should load storage from the file system', async () => {
      expect(storage.getItem('foo')).toEqual(undefined)
      storage.preloadAsync()
      storage.preloadAsync()
      storage.preloadAsync()
      await storage.preloadAsync()
      expect(mockedFileSystem.readAsStringAsync).toHaveBeenCalledTimes(1)
      expect(storage.getItem('foo')).toEqual('bar')
    })

    it('should save storage to the file system', async () => {
      storage.setItem('foo', 'bar2')
      expect(storage.getItem('foo')).toEqual('bar2')
      expect(mockedFileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        '.posthog-rn.json',
        JSON.stringify({
          version: 'v1',
          content: {
            foo: 'bar2',
          },
        })
      )
    })
  })
})
