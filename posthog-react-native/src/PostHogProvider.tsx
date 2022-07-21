import React, { useCallback, useRef } from 'react'
import { GestureResponderEvent, StyleProp, View, ViewStyle } from 'react-native'
import { PostHog, PostHogOptions } from './posthog-rn'
import { autocaptureFromTouchEvent, PostHogAutocaptureOptions } from './autocapture'
import { useNavigationTracker } from './hooks/useNavigationTracker'
import { useLifecycleTracker } from './hooks/useLifecycleTracker'
import { PostHogContext } from './PosthogContext'

export interface PostHogProviderProps {
  children: React.ReactNode
  options?: PostHogOptions
  apiKey?: string
  client?: PostHog
  autocapture?: boolean
  autocaptureOptions?: PostHogAutocaptureOptions
  style?: StyleProp<ViewStyle>
}

function PostHogHooks(): JSX.Element | null {
  useNavigationTracker()
  useLifecycleTracker()
  return null
}

export const PostHogProvider = ({
  children,
  client,
  options,
  apiKey,
  autocapture,
  autocaptureOptions,
  style,
}: PostHogProviderProps) => {
  const posthogRef = useRef<PostHog>()

  if (!posthogRef.current) {
    posthogRef.current = client ? client : apiKey ? new PostHog(apiKey, options) : undefined
  }

  const posthog = posthogRef.current

  const onTouch = useCallback(
    (type: 'start' | 'move' | 'end', e: GestureResponderEvent) => {
      // TODO: Improve this to ensure we only capture presses and not just ends of a drag for example
      if (!autocapture || !posthog) {
        return
      }

      if (type === 'end') {
        autocaptureFromTouchEvent(e, posthog, autocaptureOptions)
      }
    },
    [posthog, autocapture]
  )

  return (
    <View ph-label="PostHogProvider" style={style || { flex: 1 }} onTouchEndCapture={(e) => onTouch('end', e)}>
      <PostHogContext.Provider value={{ client: posthogRef.current }}>
        {autocapture ? <PostHogHooks /> : null}
        {children}
      </PostHogContext.Provider>
    </View>
  )
}
