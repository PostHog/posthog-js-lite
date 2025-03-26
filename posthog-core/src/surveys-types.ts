export interface SurveyAppearance {
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

export enum SurveyPosition {
  Left = 'left',
  Right = 'right',
  Center = 'center',
}

export enum SurveyWidgetType {
  Button = 'button',
  Tab = 'tab',
  Selector = 'selector',
}

export enum SurveyType {
  Popover = 'popover',
  API = 'api',
  Widget = 'widget',
}

export type SurveyQuestion = BasicSurveyQuestion | LinkSurveyQuestion | RatingSurveyQuestion | MultipleSurveyQuestion

export enum SurveyQuestionDescriptionContentType {
  Html = 'html',
  Text = 'text',
}

interface SurveyQuestionBase {
  question: string
  id?: string // TODO: use this for the question id
  description?: string
  descriptionContentType?: SurveyQuestionDescriptionContentType
  optional?: boolean
  buttonText?: string
  originalQuestionIndex: number
  branching?: NextQuestionBranching | EndBranching | ResponseBasedBranching | SpecificQuestionBranching
}

export interface BasicSurveyQuestion extends SurveyQuestionBase {
  type: SurveyQuestionType.Open
}

export interface LinkSurveyQuestion extends SurveyQuestionBase {
  type: SurveyQuestionType.Link
  link?: string
}

export interface RatingSurveyQuestion extends SurveyQuestionBase {
  type: SurveyQuestionType.Rating
  display: SurveyRatingDisplay
  scale: 3 | 5 | 7 | 10
  lowerBoundLabel: string
  upperBoundLabel: string
}

export enum SurveyRatingDisplay {
  Number = 'number',
  Emoji = 'emoji',
}

export interface MultipleSurveyQuestion extends SurveyQuestionBase {
  type: SurveyQuestionType.SingleChoice | SurveyQuestionType.MultipleChoice
  choices: string[]
  hasOpenChoice?: boolean
  shuffleOptions?: boolean
}

export enum SurveyQuestionType {
  Open = 'open',
  MultipleChoice = 'multiple_choice',
  SingleChoice = 'single_choice',
  Rating = 'rating',
  Link = 'link',
}

export enum SurveyQuestionBranchingType {
  NextQuestion = 'next_question',
  End = 'end',
  ResponseBased = 'response_based',
  SpecificQuestion = 'specific_question',
}

interface NextQuestionBranching {
  type: SurveyQuestionBranchingType.NextQuestion
}

interface EndBranching {
  type: SurveyQuestionBranchingType.End
}

interface ResponseBasedBranching {
  type: SurveyQuestionBranchingType.ResponseBased
  responseValues: Record<string, any>
}

interface SpecificQuestionBranching {
  type: SurveyQuestionBranchingType.SpecificQuestion
  index: number
}

export interface SurveyResponse {
  surveys: Survey[]
}

export type SurveyCallback = (surveys: Survey[]) => void

export enum SurveyMatchType {
  Regex = 'regex',
  NotRegex = 'not_regex',
  Exact = 'exact',
  IsNot = 'is_not',
  Icontains = 'icontains',
  NotIcontains = 'not_icontains',
}

export interface SurveyElement {
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
export interface SurveyRenderReason {
  visible: boolean
  disabledReason?: string
}

export interface Survey {
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

export interface SurveyActionType {
  id: number
  name?: string
  steps?: ActionStepType[]
}

/** Sync with plugin-server/src/types.ts */
export enum ActionStepStringMatching {
  Contains = 'contains',
  Exact = 'exact',
  Regex = 'regex',
}

export interface ActionStepType {
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
