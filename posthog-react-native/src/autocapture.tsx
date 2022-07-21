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

const sanitiseLabel = (label: string) => {
  return label.replace(/[^a-z0-9]+/gi, '-')
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

  while (
    currentInst &&
    // maxComponentTreeSize will always be defined as we have a defaultProps. But ts needs a check so this is here.
    elements.length < maxElementsCaptured
  ) {
    const el: PostHogAutocaptureElement = {
      tag_name: '',
    }

    const props = currentInst.memoizedProps

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

    // Try and find a sensible label
    let label =
      typeof props?.[customLabelProp] !== 'undefined'
        ? `${props[customLabelProp]}`
        : currentInst.elementType?.displayName || currentInst.elementType?.name

    if (label && !ignoredLabels.includes(label)) {
      el.tag_name = sanitiseLabel(label)
      elements.push(el)
    }

    currentInst = currentInst.return
  }

  if (elements.length) {
    posthog.autocapture('touch', elements, {
      $touch_x: e.nativeEvent.pageX,
      $touch_y: e.nativeEvent.pageY,
    })
  }
}
