export const wait = async (t: number): Promise<void> => {
  await new Promise((r) => setTimeout(r, t))
}

export const waitForPromises = async (): Promise<void> => {
  await new Promise((resolve) => {
    // IMPORTANT: Only enable real timers for this promise - allows us to pass a short amount of ticks
    // whilst keeping any timers made during other promises as fake timers
    jest.useRealTimers()
    setTimeout(resolve, 10)
    jest.useFakeTimers()
  })
}

export const parseBody = (mockCall: any): any => {
  const options = mockCall[1]
  expect(options.method).toBe('POST')
  return JSON.parse(options.body || '')
}
