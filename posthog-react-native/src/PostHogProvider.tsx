import React, { useCallback, useRef } from 'react'
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
}: PostHogProviderProps): JSX.Element => {
  const posthogRef = useRef<PostHog>()

  if (!posthogRef.current) {
    posthogRef.current = client ? client : apiKey ? new PostHog(apiKey, options) : undefined
  }

  const autocaptureOptions = autocapture && typeof autocapture !== 'boolean' ? autocapture : {}

  const posthog = posthogRef.current
  const captureTouches = posthog && (autocapture === true || autocaptureOptions?.captureTouches)
  const captureScreens = posthog && (autocapture === true || (autocaptureOptions?.captureScreens ?? true)) // Default to true if not set
  const captureLifecycle = posthog && (autocapture === true || (autocaptureOptions?.captureLifecycleEvents ?? true)) // Default to true if not set

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
      <PostHogContext.Provider value={{ client: posthogRef.current }}>
        <>
          {captureScreens ? <PostHogNavigationHook options={autocaptureOptions} /> : null}
          {captureLifecycle ? <PostHogLifecycleHook /> : null}
        </>
        {children}
      </PostHogContext.Provider>
    </View>
  )
}
