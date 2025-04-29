import { EventHint } from 'posthog-node/src/extensions/error-tracking/types';
export declare function addUncaughtExceptionListener(captureFn: (exception: Error, hint: EventHint) => void, onFatalFn: () => void): void;
export declare function addUnhandledRejectionListener(captureFn: (exception: unknown, hint: EventHint) => void): void;
