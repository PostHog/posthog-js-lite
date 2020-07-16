WIP! Reimplementation of posthog-js to be as light and modular as possible.

Goals:
- simple api
- can do autocapture, but enabled via a plugin (not yet)
- runs in the oldest browsers (not yet)
- might break some APIs (if not now, then when?)

Supports already:
- very simple api
- capture & identify calls
- $context from window
- only send events after optin if needed
- payload compression
- 10kb (includes 5kb compression code)
