import { Platform } from 'react-native'
import { OptionalAsyncStorage } from './optional/OptionalAsyncStorage'
import { OptionalExpoApplication } from './optional/OptionalExpoApplication'
import { OptionalExpoDevice } from './optional/OptionalExpoDevice'
import { OptionalExpoFileSystem } from './optional/OptionalExpoFileSystem'
import { OptionalExpoLocalization } from './optional/OptionalExpoLocalization'
import { OptionalReactNativeDeviceInfo } from './optional/OptionalReactNativeDeviceInfo'
import { PostHogCustomAppProperties, PostHogCustomStorage } from './types'

export const getAppProperties = (): PostHogCustomAppProperties => {
  let deviceType = 'Mobile'

  if (Platform.OS === 'macos' || Platform.OS === 'windows') {
    deviceType = 'Desktop'
  } else if (Platform.OS === 'web') {
    deviceType = 'Web'
  }

  const properties: PostHogCustomAppProperties = {
    $device_type: deviceType,
  }

  if (OptionalExpoApplication) {
    properties.$app_build = OptionalExpoApplication.nativeBuildVersion
    properties.$app_name = OptionalExpoApplication.applicationName
    properties.$app_namespace = OptionalExpoApplication.applicationId
    properties.$app_version = OptionalExpoApplication.nativeApplicationVersion
  } else if (OptionalReactNativeDeviceInfo) {
    properties.$app_build = returnPropertyIfNotUnknown(OptionalReactNativeDeviceInfo.getBuildNumber())
    properties.$app_name = returnPropertyIfNotUnknown(OptionalReactNativeDeviceInfo.getApplicationName())
    properties.$app_namespace = returnPropertyIfNotUnknown(OptionalReactNativeDeviceInfo.getBundleId())
    properties.$app_version = returnPropertyIfNotUnknown(OptionalReactNativeDeviceInfo.getVersion())
  }

  if (OptionalExpoDevice) {
    properties.$device_manufacturer = OptionalExpoDevice.manufacturer
    // expo-device already maps the device model identifier to a human readable name
    properties.$device_name = OptionalExpoDevice.modelName
    properties.$os_name = OptionalExpoDevice.osName
    properties.$os_version = OptionalExpoDevice.osVersion
  } else if (OptionalReactNativeDeviceInfo) {
    properties.$device_manufacturer = returnPropertyIfNotUnknown(OptionalReactNativeDeviceInfo.getManufacturerSync())
    // react-native-device-info already maps the device model identifier to a human readable name
    properties.$device_name = returnPropertyIfNotUnknown(OptionalReactNativeDeviceInfo.getModel())
    properties.$os_name = returnPropertyIfNotUnknown(OptionalReactNativeDeviceInfo.getSystemName())
    properties.$os_version = returnPropertyIfNotUnknown(OptionalReactNativeDeviceInfo.getSystemVersion())
  }

  if (OptionalExpoLocalization) {
    properties.$locale = OptionalExpoLocalization.locale
    properties.$timezone = OptionalExpoLocalization.timezone
  }

  return properties
}

// react-native-device-info returns 'unknown' if the property is not available (Web target)
const returnPropertyIfNotUnknown = (value: string | null): string | null => {
  if (value !== 'unknown') {
    return value
  }
  return null
}

export const buildOptimisiticAsyncStorage = (): PostHogCustomStorage => {
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
