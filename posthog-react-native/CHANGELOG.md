# Next

1. Added new `const [flag, payload] = useFeatureFlagWithPayload('my-flag-name')` hook that returns the flag result and it's payload if it has one.

# 2.7.1 - 2023-05-25

1. The `$screen_name` property will be registered for all events whenever `screen` is called

# 2.7.0 - 2023-04-21

1. Fixes a race condition that could occur when initialising PostHog
2. Fixes an issue where feature flags would not be reloaded after a reset
3. PostHog should always be initialized via .initAsync and will now warn if this is not the case

# 2.6.0 - 2023-04-19

1. Some small fixes to incorrect types
2. Fixed fetch compatibility by aligning error handling
3. Added two errors: PostHogFetchHttpError (non-2xx status) and PostHogFetchNetworkError (fetch network error)
4. Added .on('error', (err) => void)
5. shutdownAsync now ignores fetch errors. They should be handled with .on('error', ...) from now on.

# 2.5.2 - 2023-02-13

1. Fixes an issue where background network errors would trigger unhandled promise warnings

# 2.5.1 - 2023-02-03

1. Added support for customising the default app properties by passing a function to `options.customAppProperties`

# 2.5.0 - 2023-02-02

1. Adds support for overriding timestamp of capture events

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
