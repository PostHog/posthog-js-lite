import {
  OptionalExpoApplication,
  OptionalExpoDevice,
  OptionalExpoLocalization,
  OptionalExpoFileSystem,
  OptionalAsyncStorage,
} from './optional-imports'
import { PostHogCustomAppProperties, PostHogCustomAsyncStorage } from './types'

export const buildAppProperties = (): PostHogCustomAppProperties => {
  const properties: PostHogCustomAppProperties = {}

  if (OptionalExpoApplication) {
    properties.$app_build = OptionalExpoApplication.nativeBuildVersion
    properties.$app_name = OptionalExpoApplication.applicationName
    properties.$app_namespace = OptionalExpoApplication.applicationId
    properties.$app_version = OptionalExpoApplication.nativeApplicationVersion
  }

  if (OptionalExpoDevice) {
    properties.$device_manufacturer = OptionalExpoDevice.manufacturer
    properties.$device_name = OptionalExpoDevice.modelName
    properties.$os_name = OptionalExpoDevice.osName
    properties.$os_version = OptionalExpoDevice.osVersion
  }

  if (OptionalExpoLocalization) {
    properties.$locale = OptionalExpoLocalization.locale
    properties.$timezone = OptionalExpoLocalization.timezone
  }

  return properties
}

export const buildOptimisiticAsyncStorage = (): PostHogCustomAsyncStorage => {
  if (OptionalExpoFileSystem) {
    const filesystem = OptionalExpoFileSystem
    return {
      async getItem(key: string) {
        const uri = (filesystem.documentDirectory || '') + key
        try {
          const stringContent = await filesystem.readAsStringAsync(uri)
          return stringContent
        } catch (e) {
          return null
        }
      },

      async setItem(key: string, value: string) {
        const uri = (filesystem.documentDirectory || '') + key
        await filesystem.writeAsStringAsync(uri, value)
      },
    }
  }

  if (OptionalAsyncStorage) {
    return OptionalAsyncStorage
  }

  throw new Error(
    'PostHog: No storage available. Please install expo-filesystem or react-native-async-storage OR implemnet a custom storage provider.'
  )
}
