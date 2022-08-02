import { LZString } from '../../src/lz-string'

export const wait = async (t: number): Promise<void> => {
  await new Promise((r) => setTimeout(r, t))
}

export const waitForPromises = async (): Promise<void> => {
  jest.useRealTimers()
  await new Promise((resolve) => setTimeout(resolve, 100) as any)
  jest.useFakeTimers()
}

export const parseBody = (mockCall: any): any => {
  const options = mockCall[1]
  expect(options.method).toBe('POST')
  const bodyText = decodeURIComponent(options.body.split('&')[0].split('=')[1])
  return JSON.parse(LZString.decompressFromBase64(bodyText) || '')
}
