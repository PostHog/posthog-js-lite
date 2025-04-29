import { PostHogFetchOptions, PostHogFetchResponse, PostHogAutocaptureElement, PostHogDecideResponse, PostHogCoreOptions, PostHogEventProperties, PostHogPersistedProperty, PostHogCaptureOptions, JsonType, PostHogRemoteConfig, FeatureFlagValue, PostHogFeatureFlagDetails, FeatureFlagDetail, SurveyResponse } from './types';
import { RetriableOptions } from './utils';
import { LZString } from './lz-string';
import { SimpleEventEmitter } from './eventemitter';
export * as utils from './utils';
export declare abstract class PostHogCoreStateless {
    readonly apiKey: string;
    readonly host: string;
    readonly flushAt: number;
    readonly preloadFeatureFlags: boolean;
    readonly disableSurveys: boolean;
    private maxBatchSize;
    private maxQueueSize;
    private flushInterval;
    private flushPromise;
    private requestTimeout;
    private featureFlagsRequestTimeoutMs;
    private remoteConfigRequestTimeoutMs;
    private captureMode;
    private removeDebugCallback?;
    private disableGeoip;
    private historicalMigration;
    protected disabled: boolean;
    private defaultOptIn;
    private pendingPromises;
    protected _events: SimpleEventEmitter;
    protected _flushTimer?: any;
    protected _retryOptions: RetriableOptions;
    protected _initPromise: Promise<void>;
    protected _isInitialized: boolean;
    protected _remoteConfigResponsePromise?: Promise<PostHogRemoteConfig | undefined>;
    abstract fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>;
    abstract getLibraryId(): string;
    abstract getLibraryVersion(): string;
    abstract getCustomUserAgent(): string | void;
    abstract getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined;
    abstract setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void;
    constructor(apiKey: string, options?: PostHogCoreOptions);
    protected logMsgIfDebug(fn: () => void): void;
    protected wrap(fn: () => void): void;
    protected getCommonEventProperties(): any;
    get optedOut(): boolean;
    optIn(): Promise<void>;
    optOut(): Promise<void>;
    on(event: string, cb: (...args: any[]) => void): () => void;
    debug(enabled?: boolean): void;
    get isDebug(): boolean;
    get isDisabled(): boolean;
    private buildPayload;
    protected addPendingPromise<T>(promise: Promise<T>): Promise<T>;
    /***
     *** TRACKING
     ***/
    protected identifyStateless(distinctId: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    protected captureStateless(distinctId: string, event: string, properties?: {
        [key: string]: any;
    }, options?: PostHogCaptureOptions): void;
    protected aliasStateless(alias: string, distinctId: string, properties?: {
        [key: string]: any;
    }, options?: PostHogCaptureOptions): void;
    /***
     *** GROUPS
     ***/
    protected groupIdentifyStateless(groupType: string, groupKey: string | number, groupProperties?: PostHogEventProperties, options?: PostHogCaptureOptions, distinctId?: string, eventProperties?: PostHogEventProperties): void;
    protected getRemoteConfig(): Promise<PostHogRemoteConfig | undefined>;
    /***
     *** FEATURE FLAGS
     ***/
    protected getDecide(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, extraPayload?: Record<string, any>): Promise<PostHogDecideResponse | undefined>;
    protected getFeatureFlagStateless(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean): Promise<{
        response: FeatureFlagValue | undefined;
        requestId: string | undefined;
    }>;
    protected getFeatureFlagDetailStateless(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean): Promise<{
        response: FeatureFlagDetail | undefined;
        requestId: string | undefined;
    } | undefined>;
    protected getFeatureFlagPayloadStateless(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean): Promise<JsonType | undefined>;
    protected getFeatureFlagPayloadsStateless(distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<PostHogDecideResponse['featureFlagPayloads'] | undefined>;
    protected getFeatureFlagsStateless(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<{
        flags: PostHogDecideResponse['featureFlags'] | undefined;
        payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined;
        requestId: PostHogDecideResponse['requestId'] | undefined;
    }>;
    protected getFeatureFlagsAndPayloadsStateless(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<{
        flags: PostHogDecideResponse['featureFlags'] | undefined;
        payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined;
        requestId: PostHogDecideResponse['requestId'] | undefined;
    }>;
    protected getFeatureFlagDetailsStateless(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<PostHogFeatureFlagDetails | undefined>;
    /***
     *** SURVEYS
     ***/
    getSurveysStateless(): Promise<SurveyResponse['surveys']>;
    /***
     *** SUPER PROPERTIES
     ***/
    private _props;
    protected get props(): PostHogEventProperties;
    protected set props(val: PostHogEventProperties | undefined);
    register(properties: {
        [key: string]: any;
    }): Promise<void>;
    unregister(property: string): Promise<void>;
    /***
     *** QUEUEING AND FLUSHING
     ***/
    protected enqueue(type: string, _message: any, options?: PostHogCaptureOptions): void;
    private clearFlushTimer;
    /**
     * Helper for flushing the queue in the background
     * Avoids unnecessary promise errors
     */
    private flushBackground;
    flush(): Promise<any[]>;
    protected getCustomHeaders(): {
        [key: string]: string;
    };
    private _flush;
    private fetchWithRetry;
    shutdown(shutdownTimeoutMs?: number): Promise<void>;
}
export declare abstract class PostHogCore extends PostHogCoreStateless {
    private sendFeatureFlagEvent;
    private flagCallReported;
    protected _decideResponsePromise?: Promise<PostHogDecideResponse | undefined>;
    protected _sessionExpirationTimeSeconds: number;
    protected sessionProps: PostHogEventProperties;
    constructor(apiKey: string, options?: PostHogCoreOptions);
    protected setupBootstrap(options?: Partial<PostHogCoreOptions>): void;
    private clearProps;
    on(event: string, cb: (...args: any[]) => void): () => void;
    reset(propertiesToKeep?: PostHogPersistedProperty[]): void;
    protected getCommonEventProperties(): any;
    private enrichProperties;
    /**
     * * @returns {string} The stored session ID for the current session. This may be an empty string if the client is not yet fully initialized.
     */
    getSessionId(): string;
    resetSessionId(): void;
    /**
     * * @returns {string} The stored anonymous ID. This may be an empty string if the client is not yet fully initialized.
     */
    getAnonymousId(): string;
    /**
     * * @returns {string} The stored distinct ID. This may be an empty string if the client is not yet fully initialized.
     */
    getDistinctId(): string;
    registerForSession(properties: {
        [key: string]: any;
    }): void;
    unregisterForSession(property: string): void;
    /***
     *** TRACKING
     ***/
    identify(distinctId?: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    capture(event: string, properties?: {
        [key: string]: any;
    }, options?: PostHogCaptureOptions): void;
    alias(alias: string): void;
    autocapture(eventType: string, elements: PostHogAutocaptureElement[], properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    /***
     *** GROUPS
     ***/
    groups(groups: {
        [type: string]: string | number;
    }): void;
    group(groupType: string, groupKey: string | number, groupProperties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    groupIdentify(groupType: string, groupKey: string | number, groupProperties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    /***
     * PROPERTIES
     ***/
    setPersonPropertiesForFlags(properties: {
        [type: string]: string;
    }): void;
    resetPersonPropertiesForFlags(): void;
    /** @deprecated - Renamed to setPersonPropertiesForFlags */
    personProperties(properties: {
        [type: string]: string;
    }): void;
    setGroupPropertiesForFlags(properties: {
        [type: string]: Record<string, string>;
    }): void;
    resetGroupPropertiesForFlags(): void;
    /** @deprecated - Renamed to setGroupPropertiesForFlags */
    groupProperties(properties: {
        [type: string]: Record<string, string>;
    }): void;
    private remoteConfigAsync;
    /***
     *** FEATURE FLAGS
     ***/
    private decideAsync;
    private cacheSessionReplay;
    private _remoteConfigAsync;
    private _decideAsync;
    private setKnownFeatureFlagDetails;
    private getKnownFeatureFlagDetails;
    private getKnownFeatureFlags;
    private getKnownFeatureFlagPayloads;
    private getBootstrappedFeatureFlagDetails;
    private setBootstrappedFeatureFlagDetails;
    private getBootstrappedFeatureFlags;
    private getBootstrappedFeatureFlagPayloads;
    getFeatureFlag(key: string): FeatureFlagValue | undefined;
    getFeatureFlagPayload(key: string): JsonType | undefined;
    getFeatureFlagPayloads(): PostHogDecideResponse['featureFlagPayloads'] | undefined;
    getFeatureFlags(): PostHogDecideResponse['featureFlags'] | undefined;
    getFeatureFlagDetails(): PostHogFeatureFlagDetails | undefined;
    getFeatureFlagsAndPayloads(): {
        flags: PostHogDecideResponse['featureFlags'] | undefined;
        payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined;
    };
    isFeatureEnabled(key: string): boolean | undefined;
    reloadFeatureFlags(cb?: (err?: Error, flags?: PostHogDecideResponse['featureFlags']) => void): void;
    reloadRemoteConfigAsync(): Promise<PostHogRemoteConfig | undefined>;
    reloadFeatureFlagsAsync(sendAnonDistinctId?: boolean): Promise<PostHogDecideResponse['featureFlags'] | undefined>;
    onFeatureFlags(cb: (flags: PostHogDecideResponse['featureFlags']) => void): () => void;
    onFeatureFlag(key: string, cb: (value: FeatureFlagValue) => void): () => void;
    overrideFeatureFlag(flags: PostHogDecideResponse['featureFlags'] | null): Promise<void>;
    /***
     *** ERROR TRACKING
     ***/
    captureException(error: unknown, additionalProperties?: {
        [key: string]: any;
    }): void;
    /**
     * Capture written user feedback for a LLM trace. Numeric values are converted to strings.
     * @param traceId The trace ID to capture feedback for.
     * @param userFeedback The feedback to capture.
     */
    captureTraceFeedback(traceId: string | number, userFeedback: string): void;
    /**
     * Capture a metric for a LLM trace. Numeric values are converted to strings.
     * @param traceId The trace ID to capture the metric for.
     * @param metricName The name of the metric to capture.
     * @param metricValue The value of the metric to capture.
     */
    captureTraceMetric(traceId: string | number, metricName: string, metricValue: string | number | boolean): void;
}
export * from './types';
export { LZString };
