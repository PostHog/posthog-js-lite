# PostHog Next.js Config

This package handles sourcemap configuration and upload for the PostHog Error Tracking product.

Please see the main [PostHog Error Tracking docs](https://posthog.com/docs/error-tracking).

## Usage

```typescript
// next.config.ts
import { withPostHogConfig } from "@posthog/nextjs-config";

const nextConfig = {
  // Your Next.js configuration here
};

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!, // Personal API key used for sourcemap uploads, see https://app.posthog.com/settings/user-api-keys
  envId: process.env.POSTHOG_ENV_ID!, // Environment ID, see https://app.posthog.com/settings/environment#variables
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST!, // (optional) Host URL, defaults to https://us.posthog.com
  sourcemaps: { // (optional)
    enabled: true, // (optional) Enable sourcemaps generation and upload, default to true on production builds
    project: "my-application", // (optional) Project name, defaults to repository name
    version: "1.0.0", // (optional) Release version, defaults to current git commit
    deleteAfterUpload: true, // (optional) Delete sourcemaps after upload, defaults to true
  },
});
```

## Questions?

### [Check out our community page.](https://posthog.com/posts)
