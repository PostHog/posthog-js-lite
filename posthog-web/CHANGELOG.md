# 2.6.1 - 2024-02-06

1. Swapped to `uuidv7` for unique ID generation

# 2.6.0 - 2024-01-18

1. Adds support for overriding the event `uuid` via capture options

# 2.5.0 - 2023-12-04

1.  Renamed `personProperties` to `setPersonPropertiesForFlags` to match `posthog-js` and more clearly indicated what it does
2.  Renamed `groupProperties` to `setGroupPropertiesForFlags` to match `posthog-js` and more clearly indicated what it does

# 2.4.0 - 2023-04-20

1. Fixes a race condition that could occur when initialising PostHog
2. Fixes an issue where feature flags would not be reloaded after a reset

# 2.3.0 - 2023-04-19

1. Some small fixes to incorrect types
2. Fixed fetch compatibility by aligning error handling
3. Added two errors: PostHogFetchHttpError (non-2xx status) and PostHogFetchNetworkError (fetch network error)
4. Added .on('error', (err) => void)
5. shutdownAsync now ignores fetch errors. They should be handled with .on('error', ...) from now on.

# 2.2.1 - 2023-02-13

1. Fixes an issue where background network errors would trigger unhandled promise warnings

# 2.2.0 - 2023-02-02

1. Adds support for overriding timestamp of capture events

# 2.1.0 - 2022-1-26

1. uses v3 decide endpoint
2. JSON payloads will be returned with feature flags
3. Feature flags will gracefully fail and optimistically save evaluated flags if server is down

# 2.0.1 - 2023-01-25

- Ensures the distinctId used in `.groupIdentify` is the same as the currently identified user
