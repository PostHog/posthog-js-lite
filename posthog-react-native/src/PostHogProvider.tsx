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
  client?: PostHog | Promise<PostHog>
  autocapture?: boolean | PostHogAutocaptureOptions
  debug?: boolean
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
  debug = false,
}: PostHogProviderProps): JSX.Element | null => {
  // Check if the client is a promise and resolve it if so
  const [posthog, setPosthog] = useState<PostHog | undefined>(client instanceof Promise ? undefined : client)

  const autocaptureOptions = autocapture && typeof autocapture !== 'boolean' ? autocapture : {}
  const captureAll = autocapture === true
  const captureNone = autocapture === false

  const captureTouches = !captureNone && posthog && (captureAll || autocaptureOptions?.captureTouches)
  const captureScreens = !captureNone && posthog && (captureAll || (autocaptureOptions?.captureScreens ?? true)) // Default to true if not set
  const captureLifecycle =
    !captureNone && posthog && (captureAll || (autocaptureOptions?.captureLifecycleEvents ?? true)) // Default to true if not set

  // Resolve async client to concrete client
  useEffect(() => {
    if (client && apiKey) {
      console.warn(
        'You have provided both a client and an apiKey to PostHogProvider. The apiKey will be ignored in favour of the client.'
      )
    }

    if (!posthog && client) {
      if (client instanceof Promise) {
        client.then(setPosthog)
      } else {
        setPosthog(client)
      }
    } else if (!posthog && apiKey) {
      PostHog.initAsync(apiKey, options).then(setPosthog)
    }
  }, [client, apiKey])

  useEffect(() => {
    if (!posthog) {
      return
    }

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
