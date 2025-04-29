export { MINIMUM_POLLING_INTERVAL, THIRTY_SECONDS } from './src/constants';
export * from './src/extensions/sentry-integration';
export * from './src/extensions/express';
import { StackFrameModifierFn } from './src/extensions/error-tracking/types';
import { PostHogBackendClient } from './src/posthog-node';
export declare class PostHog extends PostHogBackendClient {
    getLibraryId(): string;
    getStackFrameModifiers(): StackFrameModifierFn[];
}
