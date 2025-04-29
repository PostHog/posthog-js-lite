import { StackFrame } from './types';
export declare const MAX_CONTEXTLINES_COLNO: number;
export declare const MAX_CONTEXTLINES_LINENO: number;
export declare function addSourceContext(frames: StackFrame[]): Promise<StackFrame[]>;
