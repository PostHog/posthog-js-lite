import { EventHint, StackFrameModifierFn, StackParser } from './extensions/error-tracking/types';
import { PostHogBackendClient, PostHogOptions } from './posthog-node';
export default class ErrorTracking {
    private client;
    private _exceptionAutocaptureEnabled;
    static stackParser: StackParser;
    static frameModifiers: StackFrameModifierFn[];
    static captureException(client: PostHogBackendClient, error: unknown, hint: EventHint, distinctId?: string, additionalProperties?: Record<string | number, any>): Promise<void>;
    constructor(client: PostHogBackendClient, options: PostHogOptions);
    private startAutocaptureIfEnabled;
    private onException;
    private onFatalError;
    isEnabled(): boolean;
}
