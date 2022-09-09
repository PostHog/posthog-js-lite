import * as FileSystem from 'expo-file-system'
import { SemiAsyncStorage, preloadSemiAsyncStorage } from '../src/storage'

jest.mock('expo-file-system')
const mockedFileSystem = jest.mocked(FileSystem, true)

describe('PostHog React Native', () => {
  jest.useRealTimers()
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
      expect(SemiAsyncStorage.getItem('foo')).toEqual(undefined)
      preloadSemiAsyncStorage()
      preloadSemiAsyncStorage()
      preloadSemiAsyncStorage()
      await preloadSemiAsyncStorage()
      expect(mockedFileSystem.readAsStringAsync).toHaveBeenCalledTimes(1)
      expect(SemiAsyncStorage.getItem('foo')).toEqual('bar')
    })

    it('should save storage to the file system', async () => {
      SemiAsyncStorage.setItem('foo', 'bar2')
      expect(SemiAsyncStorage.getItem('foo')).toEqual('bar2')
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
