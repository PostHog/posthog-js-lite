export declare interface SurveyAppearance {
  // keep in sync with frontend/src/types.ts -> SurveyAppearance
  backgroundColor?: string
  submitButtonColor?: string
  // deprecate submit button text eventually
  submitButtonText?: string
  submitButtonTextColor?: string
  ratingButtonColor?: string
  ratingButtonActiveColor?: string
  autoDisappear?: boolean
  displayThankYouMessage?: boolean
  thankYouMessageHeader?: string
  thankYouMessageDescription?: string
  thankYouMessageDescriptionContentType?: SurveyQuestionDescriptionContentType
  thankYouMessageCloseButtonText?: string
  borderColor?: string
  position?: SurveyPosition
  placeholder?: string
  shuffleQuestions?: boolean
  surveyPopupDelaySeconds?: number
  // widget options
  widgetType?: SurveyWidgetType
  widgetSelector?: string
  widgetLabel?: string
  widgetColor?: string
}

export declare enum SurveyPosition {
  Left = 'left',
  Right = 'right',
  Center = 'center',
}

declare enum SurveyWidgetType {
  Button = 'button',
  Tab = 'tab',
  Selector = 'selector',
}

declare enum SurveyType {
  Popover = 'popover',
  API = 'api',
  Widget = 'widget',
}

export declare type SurveyQuestion =
  | BasicSurveyQuestion
  | LinkSurveyQuestion
  | RatingSurveyQuestion
  | MultipleSurveyQuestion

export declare enum SurveyQuestionDescriptionContentType {
  Html = 'html',
  Text = 'text',
}

declare interface SurveyQuestionBase {
  question: string
  id?: string // TODO: use this for the question id
  description?: string
  descriptionContentType?: SurveyQuestionDescriptionContentType
  optional?: boolean
  buttonText?: string
  originalQuestionIndex: number
  branching?: NextQuestionBranching | EndBranching | ResponseBasedBranching | SpecificQuestionBranching
}

export declare interface BasicSurveyQuestion extends SurveyQuestionBase {
  type: SurveyQuestionType.Open
}

export declare interface LinkSurveyQuestion extends SurveyQuestionBase {
  type: SurveyQuestionType.Link
  link?: string
}

export declare interface RatingSurveyQuestion extends SurveyQuestionBase {
  type: SurveyQuestionType.Rating
  display: SurveyRatingDisplay
  scale: 3 | 5 | 7 | 10
  lowerBoundLabel: string
  upperBoundLabel: string
}

declare enum SurveyRatingDisplay {
  Number = 'number',
  Emoji = 'emoji',
}

export declare interface MultipleSurveyQuestion extends SurveyQuestionBase {
  type: SurveyQuestionType.SingleChoice | SurveyQuestionType.MultipleChoice
  choices: string[]
  hasOpenChoice?: boolean
  shuffleOptions?: boolean
}

declare enum SurveyQuestionType {
  Open = 'open',
  MultipleChoice = 'multiple_choice',
  SingleChoice = 'single_choice',
  Rating = 'rating',
  Link = 'link',
}

declare enum SurveyQuestionBranchingType {
  NextQuestion = 'next_question',
  End = 'end',
  ResponseBased = 'response_based',
  SpecificQuestion = 'specific_question',
}

declare interface NextQuestionBranching {
  type: SurveyQuestionBranchingType.NextQuestion
}

declare interface EndBranching {
  type: SurveyQuestionBranchingType.End
}

declare interface ResponseBasedBranching {
  type: SurveyQuestionBranchingType.ResponseBased
  responseValues: Record<string, any>
}

declare interface SpecificQuestionBranching {
  type: SurveyQuestionBranchingType.SpecificQuestion
  index: number
}

export declare interface SurveyResponse {
  surveys: Survey[]
}

export declare type SurveyCallback = (surveys: Survey[]) => void

declare enum SurveyMatchType {
  Regex = 'regex',
  NotRegex = 'not_regex',
  Exact = 'exact',
  IsNot = 'is_not',
  Icontains = 'icontains',
  NotIcontains = 'not_icontains',
}

export declare interface SurveyElement {
  text?: string
  $el_text?: string
  tag_name?: string
  href?: string
  attr_id?: string
  attr_class?: string[]
  nth_child?: number
  nth_of_type?: number
  attributes?: Record<string, any>
  event_id?: number
  order?: number
  group_id?: number
}
export declare interface SurveyRenderReason {
  visible: boolean
  disabledReason?: string
}

export declare interface Survey {
  // Sync this with the backend's SurveyAPISerializer!
  id: string
  name: string
  description?: string
  type: SurveyType
  feature_flag_keys?:
    | {
        key: string
        value?: string
      }[]
  linked_flag_key?: string
  targeting_flag_key?: string
  internal_targeting_flag_key?: string
  questions: SurveyQuestion[]
  appearance?: SurveyAppearance
  conditions?: {
    url?: string
    selector?: string
    seenSurveyWaitPeriodInDays?: number
    urlMatchType?: SurveyMatchType
    events?: {
      repeatedActivation?: boolean
      values?: {
        name: string
      }[]
    }
    actions?: {
      values: SurveyActionType[]
    }
    deviceTypes?: string[]
    deviceTypesMatchType?: SurveyMatchType
  }
  start_date?: string
  end_date?: string
  current_iteration?: number
  current_iteration_start_date?: string
}

declare interface SurveyActionType {
  id: number
  name?: string
  steps?: ActionStepType[]
}

/** Sync with plugin-server/src/types.ts */
declare enum ActionStepStringMatching {
  Contains = 'contains',
  Exact = 'exact',
  Regex = 'regex',
}

declare interface ActionStepType {
  event?: string
  selector?: string
  /** @deprecated Only `selector` should be used now. */
  tag_name?: string
  text?: string
  /** @default StringMatching.Exact */
  text_matching?: ActionStepStringMatching
  href?: string
  /** @default ActionStepStringMatching.Exact */
  href_matching?: ActionStepStringMatching
  url?: string
  /** @default StringMatching.Contains */
  url_matching?: ActionStepStringMatching
}
