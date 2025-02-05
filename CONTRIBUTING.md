# Contributing

## Development

This repository is broken into different packages

- **/posthog-core** > All common code goes here.
- **/posthog-node** > Node.js specific code
- **/posthog-react-native** > React Native specific code
- **/posthog-web** > Web (DOM) specific code
- **/posthog-ai** > Node.js SDK for LLM Observability

For Session Replay, See [posthog-react-native-session-replay](https://github.com/PostHog/posthog-react-native-session-replay/CHANGELOG.md)

## Running tests

```sh
yarn test
# Run the RN tests - these are separate due to specific babel configs
yarn test:rn
```
