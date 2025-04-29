/**
 * A lazy value that is only computed when needed. Inspired by C#'s Lazy<T> class.
 */
export declare class Lazy<T> {
    private value;
    private factory;
    private initializationPromise;
    constructor(factory: () => Promise<T>);
    /**
     * Gets the value, initializing it if necessary.
     * Multiple concurrent calls will share the same initialization promise.
     */
    getValue(): Promise<T>;
    /**
     * Returns true if the value has been initialized.
     */
    isInitialized(): boolean;
    /**
     * Returns a promise that resolves when the value is initialized.
     * If already initialized, resolves immediately.
     */
    waitForInitialization(): Promise<void>;
}
