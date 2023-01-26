# 2.1.0 - 2022-1-26

1. uses v3 decide endpoint 
2. JSON payloads will be returned with feature flags
3. Feature flags will gracefully fail and optimistically save evaluated flags if server is down
# 2.0.1 - 2023-01-25

- Ensures the distinctId used in `.groupIdentify` is the same as the currently identified user
