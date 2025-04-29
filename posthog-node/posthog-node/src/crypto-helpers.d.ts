/// <reference lib="dom" />
export declare function getNodeCrypto(): Promise<typeof import('crypto') | undefined>;
export declare function getWebCrypto(): Promise<SubtleCrypto | undefined>;
