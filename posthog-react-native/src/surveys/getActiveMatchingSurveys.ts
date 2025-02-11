import { canActivateRepeatedly, hasActions, hasEvents } from './surveys-utils'
import { Survey } from '../../../posthog-core/src/posthog-surveys-types'

export function getActiveMatchingSurveys(
  surveys: Survey[],
  flags: Record<string, string | boolean>,
  seenSurveys: string[],
  activatedSurveys: ReadonlySet<string>,
  lastSeenSurveyDate: Date | undefined
): Survey[] {
  return surveys.filter((survey) => {
    // Is Active
    if (!survey.start_date || survey.end_date) {
      return false
    }

    if (seenSurveys.includes(survey.id) && !canActivateRepeatedly(survey)) {
      return false
    }

    const surveyWaitPeriodInDays = survey.conditions?.seenSurveyWaitPeriodInDays
    if (surveyWaitPeriodInDays && lastSeenSurveyDate) {
      const today = new Date()
      const diff = Math.abs(today.getTime() - lastSeenSurveyDate.getTime())
      const diffDaysFromToday = Math.ceil(diff / (1000 * 3600 * 24))
      if (diffDaysFromToday < surveyWaitPeriodInDays) {
        return false
      }
    }

    // URL and CSS selector conditions are currently ignored

    if (
      !survey.linked_flag_key &&
      !survey.targeting_flag_key &&
      !survey.internal_targeting_flag_key &&
      !survey.feature_flag_keys?.length
    ) {
      // Survey is targeting All Users with no conditions
      return true
    }

    const linkedFlagCheck = survey.linked_flag_key ? flags[survey.linked_flag_key] === true : true
    const targetingFlagCheck = survey.targeting_flag_key ? flags[survey.targeting_flag_key] === true : true

    const eventBasedTargetingFlagCheck =
      hasEvents(survey) || hasActions(survey) ? activatedSurveys.has(survey.id) : true

    const internalTargetingFlagCheck =
      survey.internal_targeting_flag_key && !canActivateRepeatedly(survey)
        ? flags[survey.internal_targeting_flag_key] === true
        : true
    const flagsCheck = survey.feature_flag_keys?.length
      ? survey.feature_flag_keys.every(({ key, value }) => {
          return !key || !value || flags[value] === true
        })
      : true

    return (
      linkedFlagCheck && targetingFlagCheck && internalTargetingFlagCheck && eventBasedTargetingFlagCheck && flagsCheck
    )
  })
}
