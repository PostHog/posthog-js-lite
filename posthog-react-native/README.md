# PostHog React Native

Please see the main [PostHog docs](https://www.posthog.com/docs).

Specifically, the [React Native integration](https://www.posthog.com/docs/integrations/react-native-integration) details.

## Questions?

### [Join our Slack community.](https://join.slack.com/t/posthogusers/shared_invite/enQtOTY0MzU5NjAwMDY3LTc2MWQ0OTZlNjhkODk3ZDI3NDVjMDE1YjgxY2I4ZjI4MzJhZmVmNjJkN2NmMGJmMzc2N2U3Yjc3ZjI5NGFlZDQ)

# Development

## Building and deploying

React Native uses Metro as it's bundling system which has some unique behaviors. As such we have to bundle this part of the project differently with special babel config and keeping the original file structure rather than rolling up to a single file. This is due to the way that [Metro handles optional imports](https://github.com/facebook/metro/issues/836) leading us to need multiple files rather than one bundle file.
