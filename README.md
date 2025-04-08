# posthog-js-lite

The next generation of PostHog client libraries within the JS/TS ecosystem.

The lofty goals of this codebase is to solve the core client logic of our various JS based libraries in one place (web, node, React Native).

The short-term goal is to have a dedicated React Native library free from any platform-specific installations (the previous client library is a wrapper for the `posthog-ios` and `posthog-android` libraries). This enables a few things:

1. Installation to Expo managed projects without any separate compilation / ejecting
2. Tighter integration to RN enabling hooks, context, autocapture etc.

## Contributing

Information on how to contribute to the project and run tests can be found [here](CONTRIBUTING.md).

## Releasing

Information on how to release the individual libraries can be found [here](RELEASE.md).

## License

This project is licensed under the [MIT License](LICENSE).

