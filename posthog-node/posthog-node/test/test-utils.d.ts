import { PostHogV4DecideResponse } from 'posthog-core/src/types';
type ErrorResponse = {
    status: number;
    json: () => Promise<any>;
};
export declare const apiImplementationV4: (decideResponse: PostHogV4DecideResponse | ErrorResponse) => (url: any) => Promise<any>;
export declare const apiImplementation: ({ localFlags, decideFlags, decideFlagPayloads, decideStatus, localFlagsStatus, errorsWhileComputingFlags, }: {
    localFlags?: any;
    decideFlags?: any;
    decideFlagPayloads?: any;
    decideStatus?: number | undefined;
    localFlagsStatus?: number | undefined;
    errorsWhileComputingFlags?: boolean | undefined;
}) => (url: any) => Promise<any>;
export declare const anyLocalEvalCall: any[];
export declare const anyDecideCall: any[];
export {};
