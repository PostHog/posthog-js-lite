import { by, element, waitFor } from 'detox'
import jestExpect from 'expect'
import { createMockServer, MockRequest } from './mock-server'
const { reloadApp } = require('detox-expo-helpers')
const { objectContaining, arrayContaining } = jestExpect
const wait = (t: number) => new Promise((r) => setTimeout(r, t))

// Weird typescript issue
const toMatchSnapshot = (e: any) => (jestExpect(e) as any).toMatchSnapshot()

describe('Example', () => {
  let server: any
  let httpMock: jest.Mock<MockRequest, any>

  beforeAll(async () => {
    ;[server, httpMock] = createMockServer()
  })

  beforeEach(async () => {
    await reloadApp()

    httpMock.mockReset()
  })

  afterAll(async () => {
    await server.close()
  })

  it('should track $screen', async () => {
    await waitFor(element(by.id('title-TabOne')))
      .toBeVisible()
      .withTimeout(5000)

    await wait(500)

    jestExpect(httpMock).toHaveBeenCalledWith(
      objectContaining({
        method: 'POST',
        path: '/e/',
        body: objectContaining({
          api_key: jestExpect.any(String),
          batch: [
            {
              distinct_id: jestExpect.any(String),
              event: '$screen',
              library: 'posthog-react-native',
              library_version: jestExpect.any(String),
              properties: {
                $app_build: '1',
                $app_name: 'Expo Go',
                $app_namespace: 'host.exp.Exponent',
                $app_version: '2.24.3',
                $lib: 'posthog-react-native',
                $lib_version: jestExpect.any(String),
                $screen_height: 844,
                $screen_name: 'TabOne',
                $screen_width: 390,
              },
              timestamp: jestExpect.any(String),
              type: 'capture',
            },
          ],
          sent_at: jestExpect.any(String),
        }),
      })
    )
  })

  it('should automatically track $screen on navigation', async () => {
    await waitFor(element(by.id('title-TabOne')))
      .toBeVisible()
      .withTimeout(5000)

    httpMock.mockReset()

    await element(by.id('modal-button')).tap()
    await waitFor(element(by.id('title-Modal')))
      .toHaveLabel('Modal')
      .withTimeout(5000)

    jestExpect(httpMock).toHaveBeenCalledWith(
      objectContaining({
        path: '/e/',
        body: objectContaining({
          batch: arrayContaining([
            objectContaining({
              event: '$screen',
              properties: objectContaining({
                $screen_name: 'Modal',
              }),
            }),
          ]),
        }),
      })
    )
  })

  it('should autocapture taps', async () => {
    await waitFor(element(by.id('title-TabOne')))
      .toBeVisible()
      .withTimeout(5000)

    httpMock.mockReset()

    await element(by.id('example-ph-label')).tap()

    await wait(5000)

    const lastCall = httpMock.mock.lastCall
    jestExpect(lastCall[0]).toMatchObject({
      path: '/e/',
      body: objectContaining({
        batch: arrayContaining([
          objectContaining({
            event: 'Application Opened',
            properties: objectContaining({
              $lib: 'posthog-react-native',
            }),
          }),
          objectContaining({
            event: '$autocapture',
            properties: objectContaining({
              $event_type: 'touch',
              $lib: 'posthog-react-native',
              $screen_height: 844,
              $screen_width: 390,
              $touch_x: 195,
              $touch_y: 479.5,
            }),
          }),
        ]),
      }),
    })
    toMatchSnapshot(lastCall[0].body.batch[0].properties.$elements)
  })

  it('should ignore autocapture for ph-no-capture', async () => {
    await waitFor(element(by.id('title-TabOne')))
      .toBeVisible()
      .withTimeout(5000)

    httpMock.mockReset()

    await element(by.id('example-ph-no-capture')).tap()
    await wait(1000)

    jestExpect(httpMock).toHaveBeenCalledTimes(0)
  })
})
