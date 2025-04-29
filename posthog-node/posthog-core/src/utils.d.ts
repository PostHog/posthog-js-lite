import { FetchLike } from './types';
export declare const NEW_FLAGS_ROLLOUT_PERCENTAGE = 1;
export declare const NEW_FLAGS_EXCLUDED_HASHES: Set<string>;
export declare function assert(truthyValue: any, message: string): void;
export declare function removeTrailingSlash(url: string): string;
export interface RetriableOptions {
    retryCount: number;
    retryDelay: number;
    retryCheck: (err: any) => boolean;
}
export declare function retriable<T>(fn: () => Promise<T>, props: RetriableOptions): Promise<T>;
export declare function currentTimestamp(): number;
export declare function currentISOTime(): string;
export declare function safeSetTimeout(fn: () => void, timeout: number): any;
export declare const isPromise: (obj: any) => obj is Promise<any>;
export declare const isError: (x: unknown) => x is Error;
export declare function getFetch(): FetchLike | undefined;
export declare const isFunction: (f: any) => f is (...args: any[]) => any;
export declare function isTokenInRollout(token: string, percentage?: number, excludedHashes?: Set<string>): boolean;
