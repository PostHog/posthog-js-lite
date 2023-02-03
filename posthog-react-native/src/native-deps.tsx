import { Platform } from 'react-native'
import { OptionalAsyncStorage } from './optional/OptionalAsyncStorage'
import { OptionalExpoApplication } from './optional/OptionalExpoApplication'
import { OptionalExpoDevice } from './optional/OptionalExpoDevice'
import { OptionalExpoFileSystem } from './optional/OptionalExpoFileSystem'
import { OptionalExpoLocalization } from './optional/OptionalExpoLocalization'
import { OptionalReactNativeDeviceInfo } from './optional/OptionalReactNativeDeviceInfo'
import { PostHogCustomAppProperties, PostHogCustomAsyncStorage } from './types'

export const getAppProperties = (): PostHogCustomAppProperties => {
  const properties: PostHogCustomAppProperties = {
    $device_type: Platform.OS,
  }

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

  if (OptionalReactNativeDeviceInfo) {
    properties.$app_build = OptionalReactNativeDeviceInfo.getBuildIdSync()
    properties.$app_name = OptionalReactNativeDeviceInfo.getApplicationName()
    properties.$app_namespace = OptionalReactNativeDeviceInfo.getBundleId()
    properties.$app_version = OptionalReactNativeDeviceInfo.getVersion()
    properties.$device_manufacturer = OptionalReactNativeDeviceInfo.getManufacturerSync()
    properties.$device_name = OptionalReactNativeDeviceInfo.getDeviceNameSync()
    properties.$os_name = OptionalReactNativeDeviceInfo.getSystemName()
    properties.$os_version = OptionalReactNativeDeviceInfo.getSystemVersion()
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
    'PostHog: No storage available. Please install expo-filesystem or react-native-async-storage OR implement a custom storage provider.'
  )
}
