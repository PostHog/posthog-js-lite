**This library is still a work in progress!**

# posthog-js-lite

The next generation of PostHog client libraries within the JS/TS ecosystem.

The lofty goals of this codebase is to solve the core client logic of our various JS based libraries in one place (web, node, React Native).

The short-term goal is to have a dedicated React Native library free from any platform-specific installations (the previous client library is a wrapper for the `posthog-ios` and `posthog-android` libraries). This enables a few things:

1. Installation to Expo managed projects without any separate compilation / ejecting
2. Tighter integration to RN enabling hooks, context, autocapture etc.

## Development

This repository is broken into different packages

- **/posthog-core** > All common code goes here.
- **/posthog-node** > Node.js specific code
- **/posthog-react-native** > React Native specific code
- **/posthog-web** > Web (DOM) specific code

## Running tests

```sh
yarn test
# Run the RN tests - these are separate due to specific babel configs
yarn test:rn
```

### Running E2E tests with Detox

See [Example Expo Readme](./examples/example-expo/README.md)

### Examples

#### React Native

```sh
cd examples/example-expo
yarn && yarn start
```

#### Node.js

```sh
cd examples/example-node
yarn && yarn start
# example-expo has some buttons that will talk to this server
```
