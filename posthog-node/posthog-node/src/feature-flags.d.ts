/// <reference types="node" />
import { FeatureFlagCondition, PostHogFeatureFlag, PropertyGroup } from './types';
import { FeatureFlagValue, JsonType, PostHogFetchOptions, PostHogFetchResponse } from 'posthog-core/src';
declare class ClientError extends Error {
    constructor(message: string);
}
declare class InconclusiveMatchError extends Error {
    constructor(message: string);
}
type FeatureFlagsPollerOptions = {
    personalApiKey: string;
    projectApiKey: string;
    host: string;
    pollingInterval: number;
    timeout?: number;
    fetch?: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>;
    onError?: (error: Error) => void;
    onLoad?: (count: number) => void;
    customHeaders?: {
        [key: string]: string;
    };
};
declare class FeatureFlagsPoller {
    pollingInterval: number;
    personalApiKey: string;
    projectApiKey: string;
    featureFlags: Array<PostHogFeatureFlag>;
    featureFlagsByKey: Record<string, PostHogFeatureFlag>;
    groupTypeMapping: Record<string, string>;
    cohorts: Record<string, PropertyGroup>;
    loadedSuccessfullyOnce: boolean;
    timeout?: number;
    host: FeatureFlagsPollerOptions['host'];
    poller?: NodeJS.Timeout;
    fetch: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>;
    debugMode: boolean;
    onError?: (error: Error) => void;
    customHeaders?: {
        [key: string]: string;
    };
    shouldBeginExponentialBackoff: boolean;
    backOffCount: number;
    onLoad?: (count: number) => void;
    constructor({ pollingInterval, personalApiKey, projectApiKey, timeout, host, customHeaders, ...options }: FeatureFlagsPollerOptions);
    debug(enabled?: boolean): void;
    private logMsgIfDebug;
    getFeatureFlag(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>): Promise<FeatureFlagValue | undefined>;
    computeFeatureFlagPayloadLocally(key: string, matchValue: FeatureFlagValue): Promise<JsonType | undefined>;
    getAllFlagsAndPayloads(distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>): Promise<{
        response: Record<string, FeatureFlagValue>;
        payloads: Record<string, JsonType>;
        fallbackToDecide: boolean;
    }>;
    computeFlagLocally(flag: PostHogFeatureFlag, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>): Promise<FeatureFlagValue>;
    matchFeatureFlagProperties(flag: PostHogFeatureFlag, distinctId: string, properties: Record<string, string>): Promise<FeatureFlagValue>;
    isConditionMatch(flag: PostHogFeatureFlag, distinctId: string, condition: FeatureFlagCondition, properties: Record<string, string>): Promise<boolean>;
    getMatchingVariant(flag: PostHogFeatureFlag, distinctId: string): Promise<FeatureFlagValue | undefined>;
    variantLookupTable(flag: PostHogFeatureFlag): {
        valueMin: number;
        valueMax: number;
        key: string;
    }[];
    loadFeatureFlags(forceReload?: boolean): Promise<void>;
    /**
     * Returns true if the feature flags poller has loaded successfully at least once and has more than 0 feature flags.
     * This is useful to check if local evaluation is ready before calling getFeatureFlag.
     */
    isLocalEvaluationReady(): boolean;
    /**
     * If a client is misconfigured with an invalid or improper API key, the polling interval is doubled each time
     * until a successful request is made, up to a maximum of 60 seconds.
     *
     * @returns The polling interval to use for the next request.
     */
    private getPollingInterval;
    _loadFeatureFlags(): Promise<void>;
    private getPersonalApiKeyRequestOptions;
    _requestFeatureFlagDefinitions(): Promise<PostHogFetchResponse>;
    stopPoller(): void;
    _requestRemoteConfigPayload(flagKey: string): Promise<PostHogFetchResponse>;
}
declare function matchProperty(property: FeatureFlagCondition['properties'][number], propertyValues: Record<string, any>, warnFunction?: (msg: string) => void): boolean;
declare function relativeDateParseForFeatureFlagMatching(value: string): Date | null;
export { FeatureFlagsPoller, matchProperty, relativeDateParseForFeatureFlagMatching, InconclusiveMatchError, ClientError, };
