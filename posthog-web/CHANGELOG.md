# 2.3.0 - 2023-04-19

1. Some small fixes to incorrect types
2. Improved error handling logic to ensure that API errors are handled the same regardless of underlying fetch mechanism.

# 2.2.1 - 2023-02-13

1. Fixes an issue where background network errors would trigger unhandled promise warnings

# 2.2.0 - 2023-02-02

1. Adds support for overriding timestamp of capture events

# 2.1.0 - 2022-1-26

1. uses v3 decide endpoint
2. JSON payloads will be returned with feature flags
3. Feature flags will gracefully fail and optimistically save evaluated flags if server is down

# 2.0.1 - 2023-01-25

- Ensures the distinctId used in `.groupIdentify` is the same as the currently identified user
