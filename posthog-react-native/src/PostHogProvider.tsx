import React, { useCallback, useEffect, useMemo } from 'react'
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
  debug?: boolean
  style?: StyleProp<ViewStyle>
}

function PostHogNavigationHook({
  options,
  client,
}: {
  options?: PostHogAutocaptureOptions
  client?: PostHog
}): JSX.Element | null {
  useNavigationTracker(options?.navigation, client)
  return null
}

function PostHogLifecycleHook({ client }: { client?: PostHog }): JSX.Element | null {
  useLifecycleTracker(client)
  return null
}

export const PostHogProvider = ({
  children,
  client,
  options,
  apiKey,
  autocapture,
  style,
  debug = false,
}: PostHogProviderProps): JSX.Element | null => {
  if (!client || !apiKey) {
    throw new Error(
      'Either a PostHog client or an apiKey is required. If want to use the PostHogProvider without a client, please provide an apiKey and the options={ disabled: true }.'
    )
  }

  const posthog = useMemo(() => {
    if (client && apiKey) {
      console.warn(
        'You have provided both a client and an apiKey to PostHogProvider. The apiKey will be ignored in favour of the client.'
      )
    }

    return client ?? new PostHog(apiKey, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, apiKey])

  const autocaptureOptions = useMemo(
    () => (autocapture && typeof autocapture !== 'boolean' ? autocapture : {}),
    [autocapture]
  )
  const captureAll = autocapture === true
  const captureNone = autocapture === false

  const captureTouches = !captureNone && posthog && (captureAll || autocaptureOptions?.captureTouches)
  const captureScreens = !captureNone && posthog && (captureAll || (autocaptureOptions?.captureScreens ?? true)) // Default to true if not set
  const captureLifecycle =
    !captureNone && posthog && (captureAll || (autocaptureOptions?.captureLifecycleEvents ?? true)) // Default to true if not set

  useEffect(() => {
    posthog.debug(debug)
  }, [debug, posthog])

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
    [captureTouches, posthog, autocaptureOptions]
  )

  return (
    <View
      ph-label="PostHogProvider"
      style={style || { flex: 1 }}
      onTouchEndCapture={captureTouches ? (e) => onTouch('end', e) : undefined}
    >
      <PostHogContext.Provider value={{ client: posthog }}>
        <>
          {captureScreens ? <PostHogNavigationHook options={autocaptureOptions} client={posthog} /> : null}
          {captureLifecycle ? <PostHogLifecycleHook client={posthog} /> : null}
        </>
        {children}
      </PostHogContext.Provider>
    </View>
  )
}
