import {
  assert,
  removeTrailingSlash,
  currentISOTime,
  currentTimestamp,
  isTokenInRollout,
  NEW_FLAGS_EXCLUDED_HASHES,
} from '../src/utils'

describe('utils', () => {
  describe('assert', () => {
    it('should throw on falsey values', () => {
      ;[false, '', null, undefined, 0, {}, []].forEach((x) => {
        expect(() => assert(x, 'error')).toThrow('error')
      })
    })
    it('should not throw on truthy value', () => {
      expect(() => assert('string', 'error')).not.toThrow('error')
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
  describe('isTokenInRollout', () => {
    it('should return true if the rollout is 100%', () => {
      expect(isTokenInRollout('test', 1)).toEqual(true)
    })
    it('should return false if the rollout is 0%', () => {
      expect(isTokenInRollout('test', 0)).toEqual(false)
    })
    it('should return false if an API token is in the excluded hashes', () => {
      expect(isTokenInRollout('phc_TizRF4f5mpG6OMMSQo7kauYDxRd2rodHjP5Ro6RoXXb', 1, NEW_FLAGS_EXCLUDED_HASHES)).toEqual(
        false
      )
    })
    it('should return true for a token that is not in the excluded hashes', () => {
      expect(isTokenInRollout('sTMFPsFhdP1Ssg', 1, NEW_FLAGS_EXCLUDED_HASHES)).toEqual(true)
    })
  })
})
