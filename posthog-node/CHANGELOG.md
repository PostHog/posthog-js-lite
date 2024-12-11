# Next

# 4.3.2 - 2024-12-11

1. REVERT: Fix bug where this SDK incorrectly sent `$feature_flag_called` events with null values when using `getFeatureFlagPayload`.

# 4.3.1 - 2024-11-26

1. Fix bug where this SDK incorrectly sent `$feature_flag_called` events with null values when using `getFeatureFlagPayload`.

# 4.3.0 - 2024-11-25

1. Add Sentry v8 support to the Sentry integration

# 4.2.3 - 2024-11-21

1. fix: identify method allows passing a $set_once object

# 4.2.2 - 2024-11-18

1. fix: Shutdown will now respect the timeout and forcefully return rather than returning after the next fetch.

# 4.2.1 - 2024-10-14

1. fix: only log messages if debug is enabled

# 4.2.0 - 2024-08-26

1. Added `historicalMigration` option for use in tools that are migrating large data to PostHog

# 4.1.1 - 2024-08-20

1. Local evaluation returns correct results on `undefined/null` values

# 4.1.0 - 2024-08-14

1. chore: change host to new address.
2. chore: bump axios to 1.7.4 (fixes [CVE-2024-39338](https://github.com/advisories/GHSA-8hc4-vh64-cxmj))

# 4.0.1 - 2024-04-25

1. Prevent double JSON parsing of feature flag payloads, which would convert the payload [1] into 1.

# 4.0.0 - 2024-03-18

## Added

1. Adds a `disabled` option and the ability to change it later via `posthog.disabled = true`. Useful for disabling PostHog tracking for example in a testing environment without having complex conditional checking
2. Adds a new `featureFlagsRequestTimeoutMs` timeout parameter for feature flags which defaults to 3 seconds, updated from the default 10s for all other API calls.
3. `shutdown` takes a `shutdownTimeoutMs` param with a default of 30000 (30s). This is the time to wait for flushing events before shutting down the client. If the timeout is reached, the client will be shut down regardless of pending events.
4. Flushes will now try to flush up to `maxBatchSize` (default 100) in one go
5. Queued events are limited up to `maxQueueSize` (default 1000) and the oldest events are dropped when the limit is reached
6. Sets `User-Agent` headers with SDK name and version for RN

## Removed

1. `flushAsync` and `shutdownAsync` are removed with `flush` and `shutdown` now being the async methods.

## Changed

1. `flush` and `shutdown` now being async methods.

## Fixed

1. Fixed an issue where `shutdown` would potentially exit early if a flush was already in progress
2. Fixes some typos in types

# 4.0.0-beta.3 - 2024-03-13

1. Sets `User-Agent` headers with SDK name and version for RN

# 4.0.0-beta.2 - 2024-03-12

1. `flushAsync` and `shutdownAsync` are removed with `flush` and `shutdown` now being the async methods.
2. Fixed an issue where `shutdown` would potentially exit early if a flush was already in progress
3. Flushes will now try to flush up to `maxBatchSize` (default 100) in one go

# 4.0.0-beta.1 - 2024-03-04

1. Adds a `disabled` option and the ability to change it later via `posthog.disabled = true`. Useful for disabling PostHog tracking for example in a testing environment without having complex conditional checking
2. Fixes some typos in types
3. `shutdown` and `shutdownAsync` takes a `shutdownTimeoutMs` param with a default of 30000 (30s). This is the time to wait for flushing events before shutting down the client. If the timeout is reached, the client will be shut down regardless of pending events.
4. Adds a new `featureFlagsRequestTimeoutMs` timeout parameter for feature flags which defaults to 3 seconds, updated from the default 10s for all other API calls.

# 3.6.3 - 2024-02-15

1. fix: using `captureMode=form` won't throw an error and retry unnecessarily

# 3.6.2 - 2024-02-06

1. Swapped to `uuidv7` for unique ID generation

# 3.6.1 - 2024-01-26

1. Remove new relative date operators, combine into regular date operators

# 3.6.0 - 2024-01-18

1. Adds support for overriding the event `uuid`

# 3.5.0 - 2024-01-09

1. When local evaluation is enabled, we automatically add flag information to all events sent to PostHog, whenever possible. This makes it easier to use these events in experiments.
2. Fixes a bug where in some rare cases we may drop events when send_feature_flags is enabled on capture.

# 3.4.0 - 2024-01-09

1. Numeric property handling for feature flags now does the expected: When passed in a number, we do a numeric comparison. When passed in a string, we do a string comparison. Previously, we always did a string comparison.
2. Add support for relative date operators for local evaluation.

# 3.3.0 - 2024-01-02

1. Adds PostHogSentryIntegration to allow automatic capturing of exceptions reported via the @sentry/node package

# 3.2.1 - 2023-12-15

1. Fixes issue where a background refresh of feature flags could throw an unhandled error. It now emits to be detected by `.on('error', ...)`

# 3.2.0 - 2023-12-05

1. Fixes issues with Axios imports for non-node environments like Cloudflare workers
2. Uses the globally defined `fetch` if available, otherwise imports and uses axios as a polyfill

# 3.1.3 - 2023-10-27

1. Updates axios dependency

# 3.1.2 - 2023-08-17

1. Returns the current flag property with $feature_flag_called events, to make it easier to use in experiments

# 3.1.1 - 2023-04-26

1. Replace crypto library with pure-js rusha library which makes posthog-node work with Cloudflare Workers in Next.js edge runtime.

# 3.1.0 - 2023-04-19

1. Some small fixes to incorrect types
2. Fixed fetch compatibility by aligning error handling
3. Added two errors: PostHogFetchHttpError (non-2xx status) and PostHogFetchNetworkError (fetch network error)
4. Added .on('error', (err) => void)
5. shutdownAsync now ignores fetch errors. They should be handled with .on('error', ...) from now on.

# 3.0.0 - 2023-04-14

Breaking change:

All events by default now send the `$geoip_disable` property to disable geoip lookup in app. This is because usually we don't
want to update person properties to take the server's location.

The same now happens for feature flag requests, where we discard the IP address of the server for matching on geoip properties like city, country, continent.

To restore previous behaviour, you can set the default to False like so:

```javascript
const posthog = new PostHog(PH_API_KEY, {
  host: PH_HOST,
  disableGeoip: false,
})
```

# 2.6.0 - 2023-03-14

1. Add support for all cohorts local evaluation in feature flags.

# 2.5.4 - 2023-02-27

1. Fix error log for local evaluation of feature flags (InconclusiveMatchError(s)) to only show during debug mode.

# 2.5.3 - 2023-02-21

1. Allow passing in a distinctId to `groupIdentify()`.
2. Fix a bug with active feature flags on capture events, where non-active flags would be added to the list as well.

# 2.5.2 - 2023-02-17

1. Fix issue where properties passed to `.identify` were not set correctly

# 2.5.1 - 2023-02-16

1. Make sure shutdown waits for pending promises to resolve. Fixes a problem with using PostHog Node in serverless environments.

# 2.5.0 - 2023-02-15

1. Removes shared client from `posthog-node`, getting rid of some race condition bugs when capturing events.
2. Sets minimum version of node.js to 15

# 2.4.0 - 2023-02-02

1. Adds support for overriding timestamp of capture events

# 2.3.0 - 2023-1-26

1. uses v3 decide endpoint
2. JSON payloads will be returned with feature flags
3. Feature flags will gracefully fail and optimistically save evaluated flags if server is down

# 2.2.3 - 2022-12-01

1. Fix issues with timeouts for local evaluation requests

# 2.2.2 - 2022-11-28

1. Fix issues with timeout

# 2.2.1 - 2022-11-24

1. Add standard 10 second timeout

# 2.2.0 - 2022-11-18

1. Add support for variant overrides for feature flag local evaluation.
2. Add support for date operators in feature flag local evaluation.

# 2.1.0 - 2022-09-08

1. Swaps `unidici` for `axios` in order to support older versions of Node
2. The `fetch` implementation can be overridden as an option for those who wish to use an alternative implementation
3. Fixes the minimum Node version to >=14.17.0

# 2.0.2 - 2022-08-23

1. Removes references to `cli.js`
2. Removes default `PostHogGlobal` export, and unifies import signature for `typescript`, `commonjs` and `esm` builds.

# 2.0.1 - 2022-08-15

Breaking changes:

1. Feature flag defaults are no more. When we fail to compute any flag, we return `undefined`. All computed flags return either `true`, `false` or `String`.
2. Minimum PostHog version requirement is 1.38
3. Default polling interval for feature flags is now set at 30 seconds. If you don't want local evaluation, don't set a personal API key in the library.
4. The `callback` parameter passed as an optional last argument to most of the methods is no longer supported
5. The CLI is no longer supported

What's new:

1. You can now evaluate feature flags locally (i.e. without sending a request to your PostHog servers) by setting a personal API key, and passing in groups and person properties to `isFeatureEnabled` and `getFeatureFlag` calls.
2. Introduces a `getAllFlags` method that returns all feature flags. This is useful for when you want to seed your frontend with some initial flags, given a user ID.
