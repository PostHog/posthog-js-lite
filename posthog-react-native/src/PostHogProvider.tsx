import React, { useRef } from 'react'
import { GestureResponderEvent, View } from 'react-native'
import { PostHogReactNative, PostHogReactNativeOptions } from './posthog'

export interface PostHogProviderProps {
  children: React.ReactNode
  options?: PostHogReactNativeOptions
  apiKey?: string
  client?: PostHogReactNative
  autocapture?: boolean
}

const DEFAULT_MAX_COMPONENT_TREE_SIZE = 20
const PROP_KEY = 'posthog-label'
const _isNameIgnored = (_: string) => {
  return false
}

export const PostHogContext = React.createContext<{ client?: PostHogReactNative }>({ client: undefined })

interface Element {
  elementType?: {
    displayName?: string
    name?: string
  }
  memoizedProps?: Record<string, unknown>
  return?: Element
}

interface AutocaptureElement {
  text?: string
  tag_name: string
  attr_class: string[]
  href?: string
  attr_id?: string
  nth_child: number
  nth_of_type: number
  attributes: {
    [key: string]: any
  }
  order: number
}

const doAutocapture = (e: any, posthog: PostHogReactNative) => {
  if (!e._targetInst) {
    return
  }
  const elements: AutocaptureElement[] = []

  let currentInst: Element | undefined = e._targetInst
  let activeLabel: string | undefined
  let activeDisplayName: string | undefined
  const componentTreeNames: string[] = []

  while (
    currentInst &&
    // maxComponentTreeSize will always be defined as we have a defaultProps. But ts needs a check so this is here.
    componentTreeNames.length < DEFAULT_MAX_COMPONENT_TREE_SIZE
  ) {
    const el: AutocaptureElement = {
      tag_name: '',
      attr_class: [],
      nth_child: 0,
      nth_of_type: 0,
      attributes: {},
      order: 0,
    }

    console.log(currentInst)

    const props = currentInst.memoizedProps
    const label = typeof props?.[PROP_KEY] !== 'undefined' ? `${props[PROP_KEY]}` : undefined

    if (props) {
      Object.keys(props).forEach((key) => {
        if (['string', 'number', 'boolean'].includes(typeof props[key])) {
          el.attributes[key] = props[key]
        }
      })
    }

    // Check the label first
    if (label && !_isNameIgnored(label)) {
      if (!activeLabel) {
        activeLabel = label
      }
      el.tag_name = label
      elements.push(el)
    } else if (typeof props?.accessibilityLabel === 'string' && !_isNameIgnored(props.accessibilityLabel)) {
      if (!activeLabel) {
        activeLabel = props.accessibilityLabel
      }
      el.tag_name = props.accessibilityLabel
      elements.push(el)
    } else if (currentInst.elementType) {
      const { elementType } = currentInst

      if (elementType.displayName && !_isNameIgnored(elementType.displayName)) {
        // Check display name
        if (!activeDisplayName) {
          activeDisplayName = elementType.displayName
        }
        el.tag_name = elementType.displayName
        elements.push(el)
      }
    }

    currentInst = currentInst.return
  }

  const finalLabel = activeLabel ?? activeDisplayName

  if (elements.length) {
    console.log(finalLabel, elements)
    posthog.capture('$autocapture', {
      $event_type: 'touch',
      $elements: elements,
      $touch_x: e.nativeEvent.pageX,
      $touch_y: e.nativeEvent.pageY,
    })
  }
}

export const PostHogProvider = ({ children, client, options, apiKey, autocapture }: PostHogProviderProps) => {
  const posthogRef = useRef<PostHogReactNative>()

  if (!posthogRef.current) {
    posthogRef.current = client ? client : apiKey ? new PostHogReactNative(apiKey, options) : undefined
  }

  const posthog = posthogRef.current

  const onTouch = (type: 'start' | 'move' | 'end', e: GestureResponderEvent) => {
    if (!autocapture || !posthogRef.current) {
      return
    }

    const targetInst = (e as any)._targetInst

    console.log(targetInst)

    if (type === 'end') {
      doAutocapture(e, posthogRef.current)
    }

    // PosthogRecorderShared.trackSessionEvent({
    //   type: `touch-${type}`,
    //   content: {
    //     x: e.nativeEvent.pageX,
    //     y: e.nativeEvent.pageY,
    //   },
    // })
  }

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={(e) => onTouch('start', e)}
      onTouchMove={(e) => onTouch('move', e)}
      onTouchEndCapture={(e) => onTouch('end', e)}
    >
      <PostHogContext.Provider value={{ client: posthogRef.current }}>{children}</PostHogContext.Provider>
    </View>
  )
}

export const usePostHog = (): PostHogReactNative | undefined => {
  const { client } = React.useContext(PostHogContext)
  return client
}
