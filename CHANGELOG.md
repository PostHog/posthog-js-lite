# 2.0.1

Breaking changes:

1. Feature flag defaults are no more.
2. Minimum PostHog version 1.38
3. Default polling interval for feature flags is now set at 30 seconds. If you don't want local evaluation, don't set a personal API key in the library.

What's new:

1. You can now evaluate feature flags locally (i.e. without sending a request to your PostHog servers) by setting a personal API key, and passing in groups and person properties to `isFeatureEnabled` and `getFeatureFlag` calls.
2. Introduces a `getAllFlags` method that returns all feature flags. This is useful for when you want to seed your frontend with some initial flags, given a user ID.