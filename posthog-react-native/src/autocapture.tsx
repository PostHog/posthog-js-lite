import { PostHog } from './posthog-rn'
import { PostHogAutocaptureElement } from 'posthog-core'

export type PostHogAutocaptureOptions = {
  customLabelProp?: string
  noCaptureProp?: string
  maxElementsCaptured?: number
  ignoredLabels?: string[]
}

interface Element {
  elementType?: {
    displayName?: string
    name?: string
  }
  memoizedProps?: Record<string, unknown>
  return?: Element
}

const flattenStyles = (styles: any) => {
  const flattened: any = {}

  if (Array.isArray(styles)) {
    for (let style of styles) {
      Object.assign(flattened, flattenStyles(style))
    }
  } else {
    Object.assign(flattened, styles)
  }

  return flattened
}

const stringifyStyle = (styles: any) => {
  const flattened = flattenStyles(styles)

  const str = Object.keys(flattened)
    .map((x) => `${x}:${flattened[x]}`)
    .join(';')

  return str
}

export const autocaptureFromTouchEvent = (e: any, posthog: PostHog, options: PostHogAutocaptureOptions = {}) => {
  const {
    noCaptureProp = 'ph-no-capture',
    customLabelProp = 'ph-label',
    maxElementsCaptured = 20,
    ignoredLabels = [],
  } = options

  if (!e._targetInst) {
    return
  }
  const elements: PostHogAutocaptureElement[] = []

  let currentInst: Element | undefined = e._targetInst
  let activeLabel: string | undefined
  let activeDisplayName: string | undefined

  while (
    currentInst &&
    // maxComponentTreeSize will always be defined as we have a defaultProps. But ts needs a check so this is here.
    elements.length < maxElementsCaptured
  ) {
    const el: PostHogAutocaptureElement = {
      tag_name: '',
      attr_class: [],
      nth_child: 0,
      nth_of_type: 0,
      order: 0,
    }

    const props = currentInst.memoizedProps
    const label = typeof props?.[customLabelProp] !== 'undefined' ? `${props[customLabelProp]}` : undefined

    if (props) {
      Object.keys(props).forEach((key) => {
        const value = props[key]
        if (key === 'style') {
          el.attr__style = stringifyStyle(value)
        } else if (['string', 'number', 'boolean'].includes(typeof value)) {
          if (key === 'children') {
            el.$el_text = typeof value === 'string' ? value : JSON.stringify(value)
          } else {
            el[`attr__${key}`] = value
          }
        }
      })
    }

    if (props?.[noCaptureProp]) {
      // Immediately ignore events if a no capture is in the chain
      return
    }

    // Check the label first
    if (label && !ignoredLabels.includes(label)) {
      console.log('PH-label', label)
      if (!activeLabel) {
        activeLabel = label
      }
      el.tag_name = label
      elements.push(el)
    } else if (typeof props?.accessibilityLabel === 'string' && !ignoredLabels.includes(props.accessibilityLabel)) {
      if (!activeLabel) {
        activeLabel = props.accessibilityLabel
      }
      el.tag_name = props.accessibilityLabel
      elements.push(el)
    } else if (currentInst.elementType) {
      const { elementType } = currentInst

      if (elementType.displayName && !ignoredLabels.includes(elementType.displayName)) {
        // Check display name
        if (!activeDisplayName) {
          activeDisplayName = elementType.displayName
        }
        el.tag_name = elementType.displayName
        console.log(el)
        elements.push(el)
      }
    }

    currentInst = currentInst.return
  }

  if (elements.length) {
    console.log(activeDisplayName, activeLabel)
    posthog.autocapture('touch', elements, {
      $touch_x: e.nativeEvent.pageX,
      $touch_y: e.nativeEvent.pageY,
    })
  }
}
