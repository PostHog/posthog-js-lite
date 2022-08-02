export type PostHogAutocaptureNavigationTrackerOptions = {
  routeToName?: (name: string, params: any) => string
  routeToProperties?: (name: string, params: any) => string
}

export type PostHogAutocaptureOptions = {
  // Touches
  captureTouches?: boolean
  customLabelProp?: string
  noCaptureProp?: string
  maxElementsCaptured?: number
  ignoreLabels?: string[]
  propsToCapture?: string[]

  // Navigation
  navigation?: PostHogAutocaptureNavigationTrackerOptions
}
