**This library is still a work in progress!**

# posthog-js-next

The next generation of PostHog client libraries within the JS/TS ecosystem (maybe...)

The lofty goals of this codebase is to solve the core client logic of our various JS based libraries in one place (web, node, React Native).

The short-term goal is to have a dedicated React Native library free from any platform-specific installations (the previous client library is a wrapper for the `posthog-ios` and `posthog-android` libraries). This enables a few things:

1. Installation to Expo managed projects without any separate compilation / ejecting
2. Tighter integration to RN enabling hooks, context, autocapture etc.

# Developing

## posthog-react-native

#### Running tests

```
cd posthog-react-native
yarn test
```

#### Running E2E tests with Detox

See [Example Expo Readme](./examples/example-expo/README.md)
