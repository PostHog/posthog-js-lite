# 2.4.0 - 2023-01-27

- Adds support for https://github.com/wix/react-native-navigation
- Allows passing of promise based `PostHog.initAsync` to `<PostHogProvider client={...} />`
- Captures text content in autocapture (configurable via autocapture option `propsToCapture`)

# 2.3.0 - 2022-1-26

1. uses v3 decide endpoint
2. JSON payloads will be returned with feature flags
3. Feature flags will gracefully fail and optimistically save evaluated flags if server is down

# 2.2.3 - 2023-01-25

- Ensures the distinctId used in `.groupIdentify` is the same as the currently identified user

# 2.2.2 - 2023-01-05

- Fixes an issue with PostHogProvider where autocapture={false} would still capture lifecycle and navigation events.

# 2.2.1 - 2022-11-21

- Fixes an issue with async storage selection while installing PostHog React Native
- Fixes an issue where React Hooks for feature flags were conditionally loaded

# 2.2.0 - 2022-11-11

- Expo modules are no longer required. Expo apps work as before and standalone React Native apps can use the more common native dependencies or roll their own implementation of the necessary functions. See the [official docs](https://posthog.com/docs/integrate/client/react-native) for more information.
- PostHog should now be initialised via the async helper `PostHog.initAsync` to ensure persisted data is loaded before any tracking takes place

# 2.1.4 - 2022-10-28

Also include the fix in the compiled `lib` folder.

# 2.1.3 - 2022-10-27

Actually include the fix.

# 2.1.2 - 2022-10-27

Fix bug where all values set while stored data was being loaded would get overwritten once the data was done loading.

# 2.1.1 - 2022-09-09

Support for bootstrapping feature flags and distinctIDs. This allows you to initialise the library with a set of feature flags and distinctID that are immediately available.

# 2.1.0 - 2022-09-02

PosthogProvider `autocapture` can be configured with `captureLifecycleEvents: false` and `captureScreens: false` if you want do disable these autocapture elements. Both of these default to `true`
