import { PostHog } from '../posthog-rn'
import React from 'react'
import { PostHogContext } from '../PostHogContext__'

export const usePostHog = (): PostHog => {
  const { client } = React.useContext(PostHogContext)
  return client
}
