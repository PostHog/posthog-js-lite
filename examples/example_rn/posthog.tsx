import PostHog, {PostHogProvider} from 'posthog-react-native';
import React from 'react';

export const $posthog = PostHog.initAsync(
    'phc_pQ70jJhZKHRvDIL5ruOErnPy6xiAiWCqlL4ayELj4X8',
    {
      host: 'https://app.posthog.com',
      // persistence: 'memory',
    },
);

export const SharedPostHogProvider = (props: any) => {
  return (
    <PostHogProvider
      client={$posthog}
      autocapture={{
        captureLifecycleEvents: false,
        captureScreens: false,
        captureTouches: true,
      }}
      debug>
      {props.children}
    </PostHogProvider>
  );
};
