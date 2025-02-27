import React, { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'
import PostHog, { PostHogProvider } from 'posthog-react-native'
// import { WebView } from 'react-native-webview';

export const posthog = new PostHog('phc_QFbR1y41s5sxnNTZoyKG2NJo2RlsCIWkUfdpawgb40D', {
  host: 'https://us.i.posthog.com',
  flushAt: 1,
  enableSessionReplay: true,
  // if using WebView, you have to disable masking for text inputs and images
  // sessionReplayConfig: {
  //   maskAllTextInputs: false,
  //   maskAllImages: false,
  // },
})
posthog.debug(true)

export const SharedPostHogProvider = (props: any) => {
  return (
    <PostHogProvider
      client={posthog}
      autocapture={{
        captureLifecycleEvents: false,
        captureScreens: false,
        captureTouches: false,
        customLabelProp: 'ph-my-label',
      }}
      debug
    >
      {props.children}
    </PostHogProvider>
  )
}

// you can use accessibilityLabel='ph-no-capture' to prevent capturing the WebView
// const MyWebComponent = () => {
//   return <WebView source={{ uri: 'https://reactnative.dev/' }} style={{ flex: 1 }} />;
// }

export default function App() {
  const [buttonText, setButtonText] = useState('Open up App.js to start working on your app!')

  const handleClick = () => {
    // posthog.capture('button_clicked', { name: 'example' })
    // setButtonText('button_clicked' + new Date().toISOString())
    const userId = String(93929292112)
    const user = {
      id: userId,
      invite_token: 'e8d605f6a8e58e64552675331ce98680',
      location: 'San Francisco, California',
      state: 'active',
      stats: {
        bookmark_count: 61,
        review_count: 70,
      },
      created_at: '2013-06-10T18:35:57+00:00',
      updated_at: '2025-02-22T03:27:26+00:00',
      user_type: ['User'],
    }
    posthog.alias(userId)
    posthog.identify(userId, user)
  }

  return (
    <SharedPostHogProvider>
      <View style={styles.container}>
        <Text ph-my-label="special-text-changed" onPress={handleClick}>
          {buttonText}
        </Text>
        <StatusBar style="auto" />
      </View>
    </SharedPostHogProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
