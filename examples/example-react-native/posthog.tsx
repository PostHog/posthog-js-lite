import PostHog, {PostHogProvider} from 'posthog-react-native';
import React from 'react';

export const $posthog = PostHog.initAsync(
  'phc_CUyITkD7ktJ1op4hYE9WfmWbs0BavAqs02Ss9xbqY1T',
  {
    host: 'http://localhost:8000',
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
