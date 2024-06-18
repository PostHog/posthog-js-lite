import PostHog, {PostHogProvider} from 'posthog-react-native';
import React from 'react';

export const posthog = new PostHog(
  'phc_pQ70jJhZKHRvDIL5ruOErnPy6xiAiWCqlL4ayELj4X8',
  {
    // host: 'https://us.i.posthog.com',
    // persistence: 'memory',
  },
);

export const SharedPostHogProvider = (props: any) => {
  return (
    <PostHogProvider
      client={posthog}
      autocapture={{
        captureLifecycleEvents: true,
        captureScreens: true,
        captureTouches: true,
      }}
      debug>
      {props.children}
    </PostHogProvider>
  );
};
