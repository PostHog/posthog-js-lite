export const apiImplementation = ({
  localFlags,
  decideFlags,
  decideFlagPayloads,
  decideStatus = 200,
}: {
  localFlags?: any
  decideFlags?: any
  decideFlagPayloads?: any
  decideStatus?: number
}) => {
  return (url: any): Promise<any> => {
    if ((url as any).includes('/decide/')) {
      return Promise.resolve({
        status: decideStatus,
        text: () => Promise.resolve('ok'),
        json: () => {
          if (decideStatus !== 200) {
            return Promise.resolve(decideFlags)
          } else {
            return Promise.resolve({
              featureFlags: decideFlags,
              featureFlagPayloads: Object.fromEntries(
                Object.entries(decideFlagPayloads || {}).map(([k, v]) => [k, JSON.stringify(v)])
              ),
            })
          }
        },
      }) as any
    }

    if ((url as any).includes('api/feature_flag/local_evaluation?token=TEST_API_KEY&send_cohorts')) {
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () => Promise.resolve(localFlags),
      }) as any
    }

    if ((url as any).includes('batch/')) {
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () =>
          Promise.resolve({
            status: 'ok',
          }),
      }) as any
    }

    return Promise.resolve({
      status: 400,
      text: () => Promise.resolve('ok'),
      json: () =>
        Promise.resolve({
          status: 'ok',
        }),
    }) as any
  }
}

export const anyLocalEvalCall = [
  'http://example.com/api/feature_flag/local_evaluation?token=TEST_API_KEY&send_cohorts',
  expect.any(Object),
]
export const anyDecideCall = ['http://example.com/decide/?v=3', expect.any(Object)]
