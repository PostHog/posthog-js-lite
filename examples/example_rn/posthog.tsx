import PostHog, {PostHogProvider} from 'posthog-react-native';
import React from 'react';

export const posthog = new PostHog(
  'phc_QFbR1y41s5sxnNTZoyKG2NJo2RlsCIWkUfdpawgb40D',
  {
    // host: 'https://us.i.posthog.com',
    // persistence: 'memory',
    enableSessionReplay: true,
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
