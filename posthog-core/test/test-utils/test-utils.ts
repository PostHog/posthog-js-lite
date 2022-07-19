import { LZString } from 'posthog-core'

export const wait = async (t: number) => {
  await new Promise((r) => setTimeout(r, t))
}

export const waitForPromises = async () => {
  jest.useRealTimers()
  await new Promise((resolve) => (setInterval(resolve, 1) as any)?.unref())
  jest.useFakeTimers()
}

export const parseBody = (mockCall: any) => {
  const [url, options] = mockCall
  expect(options.method).toBe('POST')
  const bodyText = decodeURIComponent(options.body.split('&')[0].split('=')[1])
  return JSON.parse(LZString.decompressFromBase64(bodyText) || '')
}
