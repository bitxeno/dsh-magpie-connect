export declare const NS = "magpie-connect";
type Dict = Record<string, string>;
export declare const EN: Dict;
export declare const ZH: Dict;
export interface LocaleRuntime {
    subscribe(listener: () => void): () => void;
    getSnapshot(): {
        active?: string;
        revision?: number;
    };
}
export declare function setLocaleRuntime(runtime: LocaleRuntime | undefined): void;
export declare function text(key: string, params?: Record<string, unknown>): string;
export declare function useLocaleRevision(): void;
export {};
