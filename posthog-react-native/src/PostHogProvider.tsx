import React, { useCallback, useEffect, useState } from 'react'
import { GestureResponderEvent, StyleProp, View, ViewStyle } from 'react-native'
import { PostHog, PostHogOptions } from './posthog-rn'
import { autocaptureFromTouchEvent } from './autocapture'
import { useNavigationTracker } from './hooks/useNavigationTracker'
import { useLifecycleTracker } from './hooks/useLifecycleTracker'
import { PostHogContext } from './PosthogContext'
import { PostHogAutocaptureOptions } from './types'

export interface PostHogProviderProps {
  children: React.ReactNode
  options?: PostHogOptions
  apiKey?: string
  client?: PostHog
  autocapture?: boolean | PostHogAutocaptureOptions
  style?: StyleProp<ViewStyle>
}

function PostHogNavigationHook({ options }: { options?: PostHogAutocaptureOptions }): JSX.Element | null {
  useNavigationTracker(options?.navigation)
  return null
}

function PostHogLifecycleHook(): JSX.Element | null {
  useLifecycleTracker()
  return null
}

export const PostHogProvider = ({
  children,
  client,
  options,
  apiKey,
  autocapture,
  style,
}: PostHogProviderProps): JSX.Element | null => {
  const [posthog, setPosthog] = useState<PostHog | undefined>(client)

  useEffect(() => {
    if (apiKey && !posthog) {
      PostHog.initAsync(apiKey, options).then(setPosthog)
    }
  }, [apiKey])

  const autocaptureOptions = autocapture && typeof autocapture !== 'boolean' ? autocapture : {}
  const captureAll = autocapture === true
  const captureNone = autocapture === false

  const captureTouches = !captureNone && posthog && (captureAll || autocaptureOptions?.captureTouches)
  const captureScreens = !captureNone && posthog && (captureAll || (autocaptureOptions?.captureScreens ?? true)) // Default to true if not set
  const captureLifecycle =
    !captureNone && posthog && (captureAll || (autocaptureOptions?.captureLifecycleEvents ?? true)) // Default to true if not set

  const onTouch = useCallback(
    (type: 'start' | 'move' | 'end', e: GestureResponderEvent) => {
      // TODO: Improve this to ensure we only capture presses and not just ends of a drag for example
      if (!captureTouches) {
        return
      }

      if (type === 'end') {
        autocaptureFromTouchEvent(e, posthog, autocaptureOptions)
      }
    },
    [posthog, autocapture]
  )

  return (
    <View
      ph-label="PostHogProvider"
      style={style || { flex: 1 }}
      onTouchEndCapture={captureTouches ? (e) => onTouch('end', e) : undefined}
    >
      <PostHogContext.Provider value={{ client: posthog }}>
        <>
          {captureScreens ? <PostHogNavigationHook options={autocaptureOptions} /> : null}
          {captureLifecycle ? <PostHogLifecycleHook /> : null}
        </>
        {children}
      </PostHogContext.Provider>
    </View>
  )
}
