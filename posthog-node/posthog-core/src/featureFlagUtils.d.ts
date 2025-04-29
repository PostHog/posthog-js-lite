import { FeatureFlagDetail, FeatureFlagValue, PostHogDecideResponse, PostHogV3DecideResponse, PostHogV4DecideResponse, PartialWithRequired, PostHogFeatureFlagsResponse } from './types';
export declare const normalizeDecideResponse: (decideResponse: PartialWithRequired<PostHogV4DecideResponse, 'flags'> | PartialWithRequired<PostHogV3DecideResponse, 'featureFlags' | 'featureFlagPayloads'>) => PostHogFeatureFlagsResponse;
/**
 * Get the flag values from the flags v4 response.
 * @param flags - The flags
 * @returns The flag values
 */
export declare const getFlagValuesFromFlags: (flags: PostHogDecideResponse['flags']) => PostHogDecideResponse['featureFlags'];
/**
 * Get the payloads from the flags v4 response.
 * @param flags - The flags
 * @returns The payloads
 */
export declare const getPayloadsFromFlags: (flags: PostHogDecideResponse['flags']) => PostHogDecideResponse['featureFlagPayloads'];
/**
 * Get the flag details from the legacy v3 flags and payloads. As such, it will lack the reason, id, version, and description.
 * @param decideResponse - The decide response
 * @returns The flag details
 */
export declare const getFlagDetailsFromFlagsAndPayloads: (decideResponse: PostHogFeatureFlagsResponse) => PostHogDecideResponse['flags'];
export declare const getFeatureFlagValue: (detail: FeatureFlagDetail | undefined) => FeatureFlagValue | undefined;
export declare const parsePayload: (response: any) => any;
/**
 * Get the normalized flag details from the flags and payloads.
 * This is used to convert things like boostrap and stored feature flags and payloads to the v4 format.
 * This helps us ensure backwards compatibility.
 * If a key exists in the featureFlagPayloads that is not in the featureFlags, we treat it as a true feature flag.
 *
 * @param featureFlags - The feature flags
 * @param featureFlagPayloads - The feature flag payloads
 * @returns The normalized flag details
 */
export declare const createDecideResponseFromFlagsAndPayloads: (featureFlags: PostHogV3DecideResponse['featureFlags'], featureFlagPayloads: PostHogV3DecideResponse['featureFlagPayloads']) => PostHogFeatureFlagsResponse;
export declare const updateFlagValue: (flag: FeatureFlagDetail, value: FeatureFlagValue) => FeatureFlagDetail;
