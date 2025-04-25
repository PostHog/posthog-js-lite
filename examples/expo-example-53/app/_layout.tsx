import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import 'react-native-reanimated'
import PostHog, { PostHogProvider } from 'posthog-react-native'

import { useColorScheme } from '@/hooks/useColorScheme'
import { navigationRef } from './lib/navigation'

export const posthog = new PostHog('phc_QFbR1y41s5sxnNTZoyKG2NJo2RlsCIWkUfdpawgb40D', {
  host: 'https://us.i.posthog.com',
  flushAt: 1,
})
posthog.debug(true)

posthog.capture('$snapshot', {
  $snapshot_data: [
    {
      data: {
        plugin: 'rrweb/console@1',
        payload: {
          level: 'error',
          payload: ['MyApp: Clicked on button Button text'],
        },
      },
      timestamp: 1744803775659,
      type: 6,
    },
  ],
  $snapshot_source: 'mobile',
})

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync()
    }
  }, [loaded])

  if (!loaded) {
    return null
  }

  return (
    <PostHogProvider
      client={posthog}
      autocapture={{
        captureScreens: true,
        captureLifecycleEvents: true,
        captureTouches: true,
        navigationRef: navigationRef,
      }}
    >
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack ref={navigationRef}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PostHogProvider>
  )
}
