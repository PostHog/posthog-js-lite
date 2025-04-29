import { JsonType, PostHogCoreOptions, PostHogCoreStateless, PostHogFetchOptions, PostHogFetchResponse, PostHogFlagsAndPayloadsResponse, PostHogPersistedProperty } from '../../posthog-core/src';
import { EventMessage, GroupIdentifyMessage, IdentifyMessage, PostHogNodeV1 } from './types';
import { FeatureFlagValue } from '../../posthog-core/src/types';
import ErrorTracking from './error-tracking';
export type PostHogOptions = PostHogCoreOptions & {
    persistence?: 'memory';
    personalApiKey?: string;
    privacyMode?: boolean;
    enableExceptionAutocapture?: boolean;
    featureFlagsPollingInterval?: number;
    maxCacheSize?: number;
    fetch?: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>;
};
export declare abstract class PostHogBackendClient extends PostHogCoreStateless implements PostHogNodeV1 {
    private _memoryStorage;
    private featureFlagsPoller?;
    protected errorTracking: ErrorTracking;
    private maxCacheSize;
    readonly options: PostHogOptions;
    distinctIdHasSentFlagCalls: Record<string, string[]>;
    constructor(apiKey: string, options?: PostHogOptions);
    getPersistedProperty(key: PostHogPersistedProperty): any | undefined;
    setPersistedProperty(key: PostHogPersistedProperty, value: any | null): void;
    fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>;
    getLibraryId(): string;
    getLibraryVersion(): string;
    getCustomUserAgent(): string;
    enable(): Promise<void>;
    disable(): Promise<void>;
    debug(enabled?: boolean): void;
    capture(props: EventMessage): void;
    identify({ distinctId, properties, disableGeoip }: IdentifyMessage): void;
    alias(data: {
        distinctId: string;
        alias: string;
        disableGeoip?: boolean;
    }): void;
    isLocalEvaluationReady(): boolean;
    waitForLocalEvaluationReady(timeoutMs?: number): Promise<boolean>;
    getFeatureFlag(key: string, distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
        disableGeoip?: boolean;
    }): Promise<FeatureFlagValue | undefined>;
    getFeatureFlagPayload(key: string, distinctId: string, matchValue?: FeatureFlagValue, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
        disableGeoip?: boolean;
    }): Promise<JsonType | undefined>;
    getRemoteConfigPayload(flagKey: string): Promise<JsonType | undefined>;
    isFeatureEnabled(key: string, distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
        disableGeoip?: boolean;
    }): Promise<boolean | undefined>;
    getAllFlags(distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        disableGeoip?: boolean;
    }): Promise<Record<string, FeatureFlagValue>>;
    getAllFlagsAndPayloads(distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        disableGeoip?: boolean;
    }): Promise<PostHogFlagsAndPayloadsResponse>;
    groupIdentify({ groupType, groupKey, properties, distinctId, disableGeoip }: GroupIdentifyMessage): void;
    /**
     * Reloads the feature flag definitions from the server for local evaluation.
     * This is useful to call if you want to ensure that the feature flags are up to date before calling getFeatureFlag.
     */
    reloadFeatureFlags(): Promise<void>;
    shutdown(shutdownTimeoutMs?: number): Promise<void>;
    private addLocalPersonAndGroupProperties;
    captureException(error: unknown, distinctId?: string, additionalProperties?: Record<string | number, any>): void;
}
