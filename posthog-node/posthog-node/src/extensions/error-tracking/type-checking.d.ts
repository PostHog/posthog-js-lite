import { PolymorphicEvent } from './types';
export declare function isEvent(candidate: unknown): candidate is PolymorphicEvent;
export declare function isPlainObject(candidate: unknown): candidate is Record<string, unknown>;
export declare function isError(candidate: unknown): candidate is Error;
export declare function isInstanceOf(candidate: unknown, base: any): boolean;
export declare function isErrorEvent(event: unknown): boolean;
export declare function isBuiltin(candidate: unknown, className: string): boolean;
