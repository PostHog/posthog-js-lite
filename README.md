# posthog-js-lite

The next generation of PostHog client libraries within the JS/TS ecosystem.

The lofty goals of this codebase is to solve the core client logic of our various JS based libraries in one place (web, node, React Native).

The short-term goal is to have a dedicated React Native library free from any platform-specific installations (the previous client library is a wrapper for the `posthog-ios` and `posthog-android` libraries). This enables a few things:

1. Installation to Expo managed projects without any separate compilation / ejecting
2. Tighter integration to RN enabling hooks, context, autocapture etc.

## Changelog

Find the changelogs for the respective libraries in their folders:

1. [posthog-node](https://github.com/PostHog/posthog-js-lite/blob/main/posthog-node/CHANGELOG.md)
2. [posthog-react-native](https://github.com/PostHog/posthog-js-lite/blob/main/posthog-react-native/CHANGELOG.md)
3. [posthog-web](https://github.com/PostHog/posthog-js-lite/blob/main/posthog-web/CHANGELOG.md)

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

First install yalc:

```sh
yarn global add yalc
```

Then run:

```sh
cd examples/example-node
yarn && yarn start
# example-expo has some buttons that will talk to this server
```

## Publishing a new version

1. Go to the appropriate `package.json` file. For example, for `posthog-node`, this is `posthog-node/package.json`.
2. Bump the version number in the file.
3. Add to `CHANGELOG.md` the relevant changes.
4. On merge, a new version is published automatically thanks to the CI pipeline.
