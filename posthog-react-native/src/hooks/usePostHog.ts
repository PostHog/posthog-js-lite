import { PostHog } from '../posthog-rn'
import React from 'react'
import { PostHogContext } from '../PostHogContext'

export const usePostHog = (): PostHog | undefined => {
  const { client } = React.useContext(PostHogContext)
  return client
}
