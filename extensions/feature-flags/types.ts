export type PropertyGroup = {
  type: 'AND' | 'OR'
  values: PropertyGroup[] | FlagProperty[]
}

export type FlagProperty = {
  key: string
  type?: string
  value: string | number | (string | number)[]
  operator?: string
  negation?: boolean
}

export type FeatureFlagCondition = {
  properties: FlagProperty[]
  rollout_percentage?: number
  variant?: string
}

export type PostHogFeatureFlag = {
  id: number
  name: string
  key: string
  filters?: {
    aggregation_group_type_index?: number
    groups?: FeatureFlagCondition[]
    multivariate?: {
      variants: {
        key: string
        rollout_percentage: number
      }[]
    }
    payloads?: Record<string, string>
  }
  deleted: boolean
  active: boolean
  /** @deprecated This field will be removed in a future version. **/
  is_simple_flag: boolean
  rollout_percentage: null | number
  ensure_experience_continuity: boolean
  experiment_set: number[]
}
