/**
 * Page-owned runtime settings, persisted to a local JSON file.
 *
 * Precedence for the effective endpoint: settings page (this file, only the
 * fields the user actually saved) > cordis patch config > built-in defaults.
 * Hidden models only ever come from this file — the patch config has no such
 * field, so an empty/absent list means "show everything".
 */
export interface MagpiePageSettings {
    baseUrl?: string;
    apiKey?: string;
    hiddenModels?: string[];
}
export interface EffectiveEndpoint {
    baseUrl: string;
    apiKey: string;
}
export declare const SETTINGS_FILE = "settings.json";
export declare function defaultSettingsPath(dataDir: string): string;
/**
 * Normalize an API base URL: must be http(s), no trailing slash, path kept.
 *
 * The path is load-bearing, not a mistake to be trimmed: the gateway versions
 * its API (`/v1`, and later `/v2`, `/v3`), so this value *is* the prefix every
 * request is built on. The plugin appends only the resource (`/models`,
 * `/chat/completions`), never a version of its own — an origin-only value
 * would make a future `/v2` unreachable.
 */
export declare function normalizeBaseUrl(raw: unknown): string;
/** Normalize a hidden-model list: strings only, deduped, order kept. */
export declare function normalizeHiddenModels(raw: unknown): string[];
/** Validate + normalize a page payload (full or partial). Unknown keys are dropped. */
export declare function normalizePageSettings(raw: unknown): MagpiePageSettings;
/**
 * Merge patch config with page settings: page wins per-field, but only for
 * fields it actually saved (absent page fields fall back to patch/defaults).
 */
export declare function resolveEffectiveEndpoint(patch: {
    baseUrl: string;
    apiKey: string;
}, page: MagpiePageSettings): EffectiveEndpoint;
/** Fully configured only when both URL and key are present. Either missing gates everything. */
export declare function isConfigured(endpoint: EffectiveEndpoint): boolean;
/** In-memory settings with file persistence. Synchronous reads for the hot path. */
export declare class SettingsStore {
    #private;
    constructor(options?: {
        path?: string;
    });
    /** Load persisted settings (missing/corrupt file reads as empty, never throws). */
    load(): Promise<MagpiePageSettings>;
    get(): MagpiePageSettings;
    /** Merge a partial payload, persist, and notify listeners. */
    save(partial: unknown): Promise<MagpiePageSettings>;
    /** Replace the whole document (used at startup after load). */
    replace(next: MagpiePageSettings): void;
    onChange(listener: () => void): () => void;
    persist(): Promise<void>;
}
