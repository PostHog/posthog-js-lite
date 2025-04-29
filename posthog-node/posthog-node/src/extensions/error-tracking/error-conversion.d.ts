import { ErrorProperties, EventHint, StackFrameModifierFn, StackParser } from './types';
export declare function propertiesFromUnknownInput(stackParser: StackParser, frameModifiers: StackFrameModifierFn[], input: unknown, hint?: EventHint): Promise<ErrorProperties>;
