import React, { useEffect, useMemo, useState } from 'react'

import { dismissedSurveyEvent, sendSurveyShownEvent } from './components/Surveys'

import { getActiveMatchingSurveys } from './getActiveMatchingSurveys'
import { useSurveyStorage } from './useSurveyStorage'
import { useActivatedSurveys } from './useActivatedSurveys'
import { SurveyModal } from './components/SurveyModal'
import { defaultSurveyAppearance, getContrastingTextColor, SurveyAppearanceTheme } from './surveys-utils'
import { Survey, SurveyAppearance } from './posthog-surveys-types'
import { usePostHog } from '../hooks/usePostHog'
import { useFeatureFlags } from '../hooks/useFeatureFlags'

type ActiveSurveyContextType = { survey: Survey; onShow: () => void; onClose: (submitted: boolean) => void } | undefined
const ActiveSurveyContext = React.createContext<ActiveSurveyContextType>(undefined)
export const useActiveSurvey = (): ActiveSurveyContextType => React.useContext(ActiveSurveyContext)

type FeedbackSurveyHook = {
  survey: Survey
  showSurveyModal: () => void
  hideSurveyModal: () => void
}
const FeedbackSurveyContext = React.createContext<
  | {
      surveys: Survey[]
      activeSurvey: Survey | undefined
      setActiveSurvey: React.Dispatch<React.SetStateAction<Survey | undefined>>
    }
  | undefined
>(undefined)
export const useFeedbackSurvey = (selector: string): FeedbackSurveyHook | undefined => {
  const context = React.useContext(FeedbackSurveyContext)
  const survey = context?.surveys.find(
    (survey) => survey.type === 'widget' && survey.appearance?.widgetSelector === selector
  )
  if (!context || !survey) {
    return undefined
  }

  return {
    survey,
    showSurveyModal: () => context.setActiveSurvey(survey),
    hideSurveyModal: () => {
      if (context.activeSurvey === survey) {
        context.setActiveSurvey(undefined)
      }
    },
  }
}

export type PostHogSurveyProviderProps = {
  /**
   * Whether to show the default survey modal when there is an active survey. (Default true)
   * If false, you can call useActiveSurvey and render survey content yourself.
   **/
  automaticSurveyModal?: boolean

  /**
   * The default appearance for surveys when not specified in PostHog.
   */
  defaultSurveyAppearance?: SurveyAppearance

  /**
   * If true, PosHog appearance will be ignored and defaultSurveyAppearance is always used.
   */
  overrideAppearanceWithDefault?: boolean

  children: React.ReactNode
}

export function PostHogSurveyProvider(props: PostHogSurveyProviderProps): JSX.Element {
  const posthog = usePostHog()
  const { seenSurveys, setSeenSurvey, lastSeenSurveyDate, setLastSeenSurveyDate } = useSurveyStorage()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [activeSurvey, setActiveSurvey] = useState<Survey | undefined>(undefined)
  const activatedSurveys = useActivatedSurveys(posthog, surveys)

  //TODO Why is this untyped?

  const flags: Record<string, string | boolean> | undefined = useFeatureFlags(posthog)

  // Load surveys once
  useEffect(() => {
    posthog
      .fetchSurveys()
      .then(setSurveys)
      .catch((error: unknown) => {
        posthog.capture('PostHogSurveyProvider failed to fetch surveys', { error })
      })
  }, [posthog])

  // Whenever state changes and there's no active survey, check if there is a new survey to show
  useEffect(() => {
    if (activeSurvey || props.automaticSurveyModal === false) {
      return
    }

    const activeSurveys = getActiveMatchingSurveys(
      surveys,
      flags ?? {},
      seenSurveys,
      activatedSurveys,
      lastSeenSurveyDate
    )
    const popoverSurveys = activeSurveys.filter((survey) => survey.type === 'popover')
    const popoverSurveyQueue = sortSurveysByAppearanceDelay(popoverSurveys)

    if (popoverSurveyQueue.length > 0) {
      setActiveSurvey(popoverSurveyQueue[0])
    }
  }, [activeSurvey, flags, surveys, seenSurveys, activatedSurveys, lastSeenSurveyDate, props.automaticSurveyModal])

  // Merge survey appearance so that components and hooks can use a consistent model
  const surveyAppearance = useMemo<SurveyAppearanceTheme>(() => {
    if (props.overrideAppearanceWithDefault || !activeSurvey) {
      return {
        ...defaultSurveyAppearance,
        ...(props.defaultSurveyAppearance ?? {}),
      }
    }
    return {
      ...defaultSurveyAppearance,
      ...(props.defaultSurveyAppearance ?? {}),
      ...(activeSurvey.appearance ?? {}),
      // If submitButtonColor is set by PostHog, ensure submitButtonTextColor is also set to contrast
      ...(activeSurvey.appearance?.submitButtonColor
        ? {
            submitButtonTextColor:
              activeSurvey.appearance.submitButtonTextColor ??
              getContrastingTextColor(activeSurvey.appearance.submitButtonColor),
          }
        : {}),
    }
  }, [activeSurvey, props.defaultSurveyAppearance, props.overrideAppearanceWithDefault])

  const activeContext = useMemo(() => {
    if (!activeSurvey) {
      return undefined
    }
    return {
      survey: activeSurvey,
      onShow: () => {
        sendSurveyShownEvent(activeSurvey, posthog)
        setLastSeenSurveyDate(new Date())
      },
      onClose: (submitted: boolean) => {
        setSeenSurvey(activeSurvey.id)
        setActiveSurvey(undefined)
        if (!submitted) {
          dismissedSurveyEvent(activeSurvey, posthog)
        }
      },
    }
  }, [activeSurvey, posthog, setLastSeenSurveyDate, setSeenSurvey])

  return (
    <ActiveSurveyContext.Provider value={activeContext}>
      <FeedbackSurveyContext.Provider value={{ surveys, activeSurvey, setActiveSurvey }}>
        {props.children}
        {activeContext && <SurveyModal appearance={surveyAppearance} {...activeContext} />}
      </FeedbackSurveyContext.Provider>
    </ActiveSurveyContext.Provider>
  )
}

function sortSurveysByAppearanceDelay(surveys: Survey[]): Survey[] {
  return surveys.sort(
    (a, b) => (a.appearance?.surveyPopupDelaySeconds ?? 0) - (b.appearance?.surveyPopupDelaySeconds ?? 0)
  )
}
