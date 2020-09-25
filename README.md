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

Browser support:
- This library ES6 compatible browsers (everything except IE). If you need to support IE, 
  feel free to transpile the source to ES5 after including it in your bundle. 
