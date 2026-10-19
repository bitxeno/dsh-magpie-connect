/**
 * Page-owned runtime settings, persisted to a local JSON file.
 *
 * Precedence for the effective endpoint: settings page (this file, only the
 * fields the user actually saved) > cordis patch config > built-in defaults.
 *
 * `enabledModels` is an **allowlist**, matching DSH's own Models settings: the
 * picker offers the intersection of the gateway directory and this list. `null`
 * (absent) means "inherit the whole directory", `[]` means "offer nothing", and
 * a populated array means exactly those ids. The old blacklist
 * (`hiddenModels`) could not express "the gateway added a model I don't want
 * yet"; an allowlist can, and it is why a model the gateway re-lists never
 * comes back on its own.
 */
export interface MagpiePageSettings {
    baseUrl?: string;
    apiKey?: string;
    /**
     * Allowlist of model ids the picker offers. `undefined` = inherit every model
     * the gateway serves; `[]` = offer none; otherwise exactly these ids.
     */
    enabledModels?: string[];
    /**
     * Set once the `hiddenModels` (blacklist) document has been converted to
     * `enabledModels`. Its presence stops the migration from running twice — a
     * second run would read an already-allowlisted document as if it were a
     * blacklist and invert it into nonsense.
     */
    migratedFromHiddenModels?: true;
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
/** Normalize an enabled-model allowlist: strings only, deduped, order kept. */
export declare function normalizeEnabledModels(raw: unknown): string[];
/** Validate + normalize a page payload (full or partial). Unknown keys are dropped. */
export declare function normalizePageSettings(raw: unknown): MagpiePageSettings;
/**
 * One-time conversion from the old blacklist document to the allowlist.
 *
 * The legacy file stored `hiddenModels` (ids to *exclude*). The new shape stores
 * `enabledModels` (ids to *include*), so the two are not interchangeable: an
 * unconverted file would be read as "offer exactly the models I had hidden",
 * which is the precise inverse of what the user asked for.
 *
 * `known` is the ids the picker would have offered under the old rules — the
 * gateway directory (live, else cached, else the built-in snapshot) minus the
 * hidden set. The conversion can only be computed from it, so the caller passes
 * whatever directory it has; when nothing is known yet (unconfigured, cold
 * cache), `enabledModels` is left absent, which means "inherit everything" —
 * the only reading that cannot silently drop models the user can still use.
 *
 * The marker `migratedFromHiddenModels` is written even when the list could not
 * be computed: the blacklist is gone either way, and re-running the conversion
 * later would invert an already-converted document.
 * @param raw - the parsed settings document.
 * @param known - ids the old rules would have offered, or `undefined` when unknown.
 * @returns the converted document and whether anything changed.
 */
export declare function migrateLegacySettings(raw: unknown, known?: readonly string[]): {
    settings: MagpiePageSettings;
    migrated: boolean;
};
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
    /**
     * Read and normalize the persisted document (missing/corrupt reads as empty,
     * never throws). Does not touch memory or disk.
     *
     * Separate from {@link load} because the legacy conversion needs the gateway
     * directory, and that can only be read once the persisted endpoint is known:
     * the process starts with the patch/default endpoint, not the user's.
     */
    read(): Promise<MagpiePageSettings>;
    /**
     * Load persisted settings, running the one-time `hiddenModels` ->
     * `enabledModels` conversion.
     *
     * The rewrite is attempted at startup rather than lazily so the file on disk
     * matches what the running process believes; a failed write is not fatal
     * (the in-memory result is still correct), and the migration marker makes a
     * retry idempotent.
     * @param known - ids the old blacklist rules would have offered, used to
     *   compute the allowlist; omitted when the directory is not known yet.
     */
    load(known?: readonly string[]): Promise<MagpiePageSettings>;
    /**
     * Adopt a document already read and normalized by {@link read}, then run the
     * legacy conversion against the directory that is now warm.
     *
     * This is the startup path: `read` -> `applyPageSettings` (so the catalog
     * knows the user's endpoint) -> `catalog.start` (so the directory is real) ->
     * `hydrate` (so a legacy file converts against the live gateway).
     * @param raw - the normalized document from {@link read}.
     * @param known - ids the old blacklist rules would have offered.
     */
    hydrate(raw: MagpiePageSettings, known?: readonly string[]): Promise<MagpiePageSettings>;
    get(): MagpiePageSettings;
    /** Merge a partial payload, persist, and notify listeners. */
    save(partial: unknown): Promise<MagpiePageSettings>;
    /** Replace the whole document (used at startup after load). */
    replace(next: MagpiePageSettings): void;
    onChange(listener: () => void): () => void;
    persist(): Promise<void>;
}
