import { PostHogFeatureFlag } from './types'

export const getLocalFeatureFlag = (
  allFeatureFlags: PostHogFeatureFlag[],
  key: string,
  distinctId: string,
  groups?: Record<string, string> | undefined,
  personProperties?: Record<string | number, any>,
  groupProperties?: Record<string | number, any>
) => {
  // TODO: Evaluate flags purely (no state) to ensure easy testing
  const featureFlag = allFeatureFlags.find(featureFlag => featureFlag.key === key)
  if (!featureFlag) {
    return null
  }
  if (featureFlag.ensure_experience_continuity) {
    throw new Error('Flag has experience continuity enabled')
  }
  const flagFilters = featureFlag.filters || {}
  const aggregationGroupTypeIndex = flagFilters.aggregation_group_type_index
  if (aggregationGroupTypeIndex) {
    // groupTypeMapping code
    // return matchFeatureFlagProperties(featureFlag, groups[groupName], focusedGroupProperties)
  }
  return matchFeatureFlagProperties(featureFlag, distinctId, personProperties)
}

const matchFeatureFlagProperties = (
  featureFlag: PostHogFeatureFlag,
  distinctId: string,
  properties: any): any => {
  const flagConditions = (featureFlag.filters || {}).groups || []
  let isInconclusive = false

  flagConditions.forEach(flagCon => {
    try {
      if (isConditionMatch(featureFlag, distinctId, condition, properties)) {
        return getMatchingVariant(featureFlag, distinctId)
      }
    }
      try {
      const stringContent = await FileSystem.readAsStringAsync(uri)
      return JSON.parse(stringContent).content
    } catch (e) {
      return {}
    }
  })
}

const getMatchingVariant = (featureFlag: PostHogFeatureFlag, distinctId: string) => {
  const variants = variantLookupTable(flag)
}

const variantLookupTable = (featureFlag: PostHogFeatureFlag): VariantLookupTable[] => {
  let valueMin = 0
  const lookupTable = []
  const multivariates = featureFlag.filters?.multivariate?.variants || []
  // multivariates = ((feature_flag.get("filters") or {}).get("multivariate") or {}).get("variants") or []
  multivariates.forEach(variant => {
    let valueMax = valueMin + variant.rollout_percentage / 100
    lookupTable.push({ value_min: valueMin, value_max: valueMax, key: variant.key })
    valueMin = valueMax
  })
  return lookupTable
  for variant in multivariates:
    value_max = value_min + variant["rollout_percentage"] / 100
  lookup_table.append({ "value_min": value_min, "value_max": value_max, "key": variant["key"] })
  value_min = value_max
  return lookup_table
}

type VariantLookupTable = {
  value_min: number
  value_max: number
  key: string
}

// def match_feature_flag_properties(flag, distinct_id, properties):
//     flag_conditions = (flag.get("filters") or {}).get("groups") or []
//     is_inconclusive = False

//     for condition in flag_conditions:
//         try:
//             # if any one condition resolves to True, we can shortcircuit and return
//             # the matching variant
//             if is_condition_match(flag, distinct_id, condition, properties):
//                 return get_matching_variant(flag, distinct_id) or True
//         except InconclusiveMatchError:
//             is_inconclusive = True

//     if is_inconclusive:
//         raise InconclusiveMatchError("Can't determine if feature flag is enabled or not with given properties")

//     # We can only return False when either all conditions are False, or
//     # no condition was inconclusive.
//     return False


// def is_condition_match(feature_flag, distinct_id, condition, properties):
//     rollout_percentage = condition.get("rollout_percentage")
//     if len(condition.get("properties") or []) > 0:
//         if not all(match_property(prop, properties) for prop in condition.get("properties")):
//             return False
//         elif rollout_percentage is None:
//             return True

//     if rollout_percentage is not None and _hash(feature_flag["key"], distinct_id) > (rollout_percentage / 100):
//         return False

//     return True


// def match_property(property, property_values) -> bool:
//     # only looks for matches where key exists in override_property_values
//     # doesn't support operator is_not_set
//     key = property.get("key")
//     operator = property.get("operator") or "exact"
//     value = property.get("value")

//     if key not in property_values:
//         raise InconclusiveMatchError("can't match properties without a given property value")

//     if operator == "is_not_set":
//         raise InconclusiveMatchError("can't match properties with operator is_not_set")

//     override_value = property_values[key]

//     if operator == "exact":
//         if isinstance(value, list):
//             return override_value in value
//         return value == override_value

//     if operator == "is_not":
//         if isinstance(value, list):
//             return override_value not in value
//         return value != override_value

//     if operator == "is_set":
//         return key in property_values

//     if operator == "icontains":
//         return str(value).lower() in str(override_value).lower()

//     if operator == "not_icontains":
//         return str(value).lower() not in str(override_value).lower()

//     if operator == "regex":
//         return is_valid_regex(str(value)) and re.compile(str(value)).search(str(override_value)) is not None

//     if operator == "not_regex":
//         return is_valid_regex(str(value)) and re.compile(str(value)).search(str(override_value)) is None

//     if operator == "gt":
//         return type(override_value) == type(value) and override_value > value

//     if operator == "gte":
//         return type(override_value) == type(value) and override_value >= value

//     if operator == "lt":
//         return type(override_value) == type(value) and override_value < value

//     if operator == "lte":
//         return type(override_value) == type(value) and override_value <= value

//     return False
