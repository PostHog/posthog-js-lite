import { PostHogFeatureFlag } from './types'

export const getLocalFeatureFlag = (
  allFeatureFlags: PostHogFeatureFlag[],
  key: string,
  distinctId: string,
  groups?: Record<string, string> | undefined
) => {
  // TODO: Evaluate flags purely (no state) to ensure easy testing
  return null
}
