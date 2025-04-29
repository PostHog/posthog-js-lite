import { PostHogBackendClient } from './src/posthog-node';
import { StackFrameModifierFn } from './src/extensions/error-tracking/types';
export declare class PostHog extends PostHogBackendClient {
    getLibraryId(): string;
    getStackFrameModifiers(): StackFrameModifierFn[];
}
