import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

import PostHog from 'posthog-react-native'

export const $posthog = PostHog.initAsync('phc_pQ70jJhZKHRvDIL5ruOErnPy6xiAiWCqlL4ayELj4X8', {
  host: 'https://app.posthog.com',
  flushAt: 1,
  captureNativeAppLifecycleEvents: false,
  sendFeatureFlagEvent: false,
  preloadFeatureFlags: false,
  // captureMode: 'form',
  // persistence: 'memory',
}).then((client) => {
  client.debug(true)
  // console.log('PostHog client initialized');
  client.capture('test')
  // console.log(`test: ${client.getFeatureFlag('test')}`);
  // client.on('error', err => {
  //   console.error('PostHog error', err);
  // });
  // client.on('capture', ev => {
  //   console.error('PostHog ev', ev);
  // });
})

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
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
