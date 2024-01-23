import { assert, removeTrailingSlash, currentISOTime, currentTimestamp } from '../src/utils/utils'
import { uuidv7 } from '../src/utils/uuidv7'

describe('utils', () => {
  describe('assert', () => {
    it('should throw on falsey values', () => {
      ;[false, '', null, undefined, 0].forEach((x) => {
        expect(() => assert(x, 'error')).toThrow('error')
      })
    })
    it('should not throw on truthy values', () => {
      ;[true, 'string', 1, {}].forEach((x) => {
        expect(() => assert(x, 'error')).not.toThrow('error')
      })
    })
  })
  describe('removeTrailingSlash', () => {
    it('should removeSlashes', () => {
      expect(removeTrailingSlash('me////')).toEqual('me')
      expect(removeTrailingSlash('me/wat///')).toEqual('me/wat')
      expect(removeTrailingSlash('me/')).toEqual('me')
      expect(removeTrailingSlash('/me')).toEqual('/me')
    })
  })
  describe.skip('retriable', () => {
    it('should do something', () => {})
  })
  describe('uuidv7', () => {
    it('should generate something that looks like a UUID', () => {
      const REGEX = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/

      for (let i = 0; i < 1000; i++) {
        expect(uuidv7()).toMatch(REGEX)
      }
    })
  })
  describe('currentTimestamp', () => {
    it('should get the timestamp', () => {
      expect(currentTimestamp()).toEqual(Date.now())
    })
  })
  describe('currentISOTime', () => {
    it('should get the iso time', () => {
      jest.setSystemTime(new Date('2022-01-01'))
      expect(currentISOTime()).toEqual('2022-01-01T00:00:00.000Z')
    })
  })
})
