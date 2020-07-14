WIP! Reimplementation of posthog-js to be as light and modular as possible.

Goals:
- can do autocapture, but enabled via a plugin
- simple api
- runs in the oldest browsers

Supports already:
- capture & identify calls
- $context from window
- only send events after optin if needed
- payload compression
- very simple api
- 10kb (includes 5kb compression code)
