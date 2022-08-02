import * as FileSystem from 'expo-file-system'
import * as ExpoApplication from 'expo-application'
import { Platform } from 'react-native'

export const getLegacyValues = async (): Promise<{ distinctId?: string; anonymousId?: string } | undefined> => {
  // NOTE: The old react-native lib stored data in files on the filesystem.
  // This function takes care of pulling the legacy IDs to ensure we are using them if already present
  if (Platform.OS === 'ios') {
    const posthogFileDirectory = `${FileSystem.documentDirectory}../Library/Application%20Support/${ExpoApplication.applicationId}/`
    const posthogDistinctIdFile = posthogFileDirectory + 'posthog.distinctId'
    const posthogAnonymousIdFile = posthogFileDirectory + 'posthog.anonymousId'

    const res = {
      distinctId: undefined,
      anonymousId: undefined,
    }

    try {
      res.distinctId = JSON.parse(await FileSystem.readAsStringAsync(posthogDistinctIdFile))['posthog.distinctId']
    } catch (e) {}

    try {
      res.anonymousId = JSON.parse(await FileSystem.readAsStringAsync(posthogAnonymousIdFile))['posthog.anonymousId']
    } catch (e) {}

    return res
  } else {
    // NOTE: Android is not supported here as the old SDK used a very Expo-unfriendly way of storing data
  }
}
