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
  autocapture?: boolean
  autocaptureOptions?: PostHogAutocaptureOptions
  style?: StyleProp<ViewStyle>
}

function PostHogHooks({ options }: { options?: PostHogAutocaptureOptions }): JSX.Element | null {
  useNavigationTracker(options?.navigation)
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
  const captureTouches = autocapture && posthog && autocaptureOptions?.captureTouches

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

  // TODO: Improve this to ensure we only capture presses and not just ends of a drag for example
  return (
    <View
      ph-label="PostHogProvider"
      style={style || { flex: 1 }}
      onTouchEndCapture={captureTouches ? (e) => onTouch('end', e) : undefined}
    >
      <PostHogContext.Provider value={{ client: posthogRef.current }}>
        {autocapture ? <PostHogHooks options={autocaptureOptions} /> : null}
        {children}
      </PostHogContext.Provider>
    </View>
  )
}
