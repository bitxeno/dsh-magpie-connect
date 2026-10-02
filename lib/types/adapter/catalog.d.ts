/**
 * Model directory for the Magpie LAN gateway.
 *
 * Single source: `GET {baseUrl}/models` already curates the servable set
 * with full per-model metadata (modalities, native endpoints, reasoning
 * ladders, context limits). There is no paid/free filter — everything listed
 * is exposed. A disk cache plus a compile-time static snapshot covers gateway
 * outages (the plugin still registers, the picker still lists).
 *
 * `baseUrl` is the versioned API root (`http://api.lan/v1`), never an origin:
 * the gateway may move to `/v2`, and the plugin must not know that version.
 */
/** Conventional LAN API root (example value, not a default — empty means unconfigured). */
export declare const MAGPIE_DEFAULT_BASE_URL = "http://api.lan";
export interface MagpieModelEntry {
    id: string;
    displayName: string;
    contextWindow?: number;
    maxTokens?: number;
    /** Whether the gateway accepts image input for this model. */
    image: boolean;
    /** Raw gateway `native_endpoints` (may be empty when undisclosed). */
    nativeEndpoints: string[];
    /** Whether the gateway reports thinking support. */
    reasoning: boolean;
    /** Effort allowlist from `supported_reasoning_levels` (canonical order). */
    efforts?: string[];
}
/**
 * Thinking levels the gateway uses. pi-ai natively understands the minimal→max
 * ladder; `none` (thinking disabled) and `ultra` (beyond max, e.g. Terra) are
 * gateway extensions the adapter forwards verbatim on the Responses /
 * completions wire instead of clamping.
 */
export declare const KNOWN_EFFORTS: readonly ["minimal", "low", "medium", "high", "xhigh", "max"];
export declare const EXTENDED_EFFORTS: readonly ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
export type KnownEffort = (typeof KNOWN_EFFORTS)[number];
export type ExtendedEffort = (typeof EXTENDED_EFFORTS)[number];
export interface ReasoningEffortChoice {
    id: string;
    name: string;
    description?: string;
}
/** Normalize one gateway effort spelling; unknown spellings are dropped. */
export declare function normalizeEffort(raw: unknown): string | undefined;
/** Canonicalize an effort list: keep known spellings, dedupe, order canonically. */
export declare function canonicalEfforts(values: readonly unknown[] | undefined): string[] | undefined;
/** Build picker efforts for an allowlist (display order = none→minimal→…→ultra). */
export declare function effortsFor(efforts: readonly string[] | undefined): ReasoningEffortChoice[];
/**
 * pi-ai `thinkingLevelMap` for an effort allowlist. `off: null` is
 * load-bearing: without it pi-ai falls back to `reasoning.effort: 'none'`
 * on the Responses lane, which the gateway rejects with 400. Every
 * non-listed known level maps to null so `getSupportedThinkingLevels` hides
 * it and `clampThinkingLevel` folds stale values to the nearest listed one.
 * Gateway extensions (`none`/`ultra`) never enter the map — the adapter
 * forwards them via `provider.stream` instead of `streamSimple`.
 */
export declare function thinkingLevelMapFor(efforts: readonly string[] | undefined): Record<string, string | null>;
/**
 * True when the model must go through `/v1/responses` instead of chat
 * completions: the gateway lists responses as the only native endpoint
 * (Muse Spark, Codex/Grok lanes). Anything advertising
 * `/v1/chat/completions` — including multi-endpoint models — rides the
 * completions lane for better tool support.
 */
export declare function requiresResponsesApiEntry(nativeEndpoints: readonly string[]): boolean;
/** pi-ai `model.api` value for the given native endpoints. */
export declare function modelApiForEntry(nativeEndpoints: readonly string[]): 'openai-completions' | 'openai-responses';
/** Decode one gateway model object into a catalog entry. */
export declare function decodeModel(raw: unknown): MagpieModelEntry | undefined;
/** Decode the full gateway `/v1/models` payload into entries keyed by id. */
export declare function decodeMagpieModels(data: unknown): Map<string, MagpieModelEntry>;
/**
 * Compile-time static snapshot (observed 2026-10-02, 22 models): last-resort
 * bootstrap while the gateway is unreachable. Refreshed by hand when the
 * gateway catalog changes shape; live data always wins when reachable.
 */
export declare const staticMagpieModels: MagpieModelEntry[];
export interface CatalogSnapshot {
    status: 'pending' | 'ready' | 'stale' | 'error';
    total: number;
    exposed: number;
    lastRefresh?: string;
}
export interface CatalogOptions {
    /** Refresh cadence (seconds). */
    refreshSeconds?: number;
    /** Where the gateway snapshot cache lives (plugin data dir). */
    cachePath?: string;
    /** Versioned API root override for tests. */
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    now?: () => number;
    /** Observability hook: fired after every refresh round. */
    onRefresh?: (status: CatalogSnapshot, lastError: string) => void;
    /**
     * Fired when the exposed model set actually changes. DSH's picker caches
     * one `modelCatalog()` read per Host generation and only re-reads it on
     * `llm/adapters-updated`, so a pure in-memory change (hidden models, a
     * refresh that added or dropped models) is invisible without this.
     */
    onInvalidate?: () => void;
    /** Delay between startup retries while the live catalog is empty (default 15s). */
    startupRetryMs?: number;
}
/** Live model directory with refresh loop. All state in-memory; only the gateway snapshot persists. */
export declare class ModelCatalog {
    #private;
    constructor(options?: CatalogOptions);
    /**
     * Start the refresh loop: immediate fetch, fast retries while the live
     * catalog is still empty (the first fetch often races the machine's
     * network coming up), then the normal cadence.
     */
    start(): Promise<void>;
    stop(): void;
    refreshOnce(): Promise<void>;
    /** Whether a gateway API root is configured (empty baseUrl = not configured). */
    get configured(): boolean;
    refreshModels(): Promise<void>;
    getEntry(model: string): MagpieModelEntry | undefined;
    /**
     * Replace the settings-page hidden set (models excluded from the picker).
     * Announces: hiding/showing models changes the exposed list, and DSH's
     * picker only re-reads it on `llm/adapters-updated`.
     */
    setHidden(ids: readonly string[]): void;
    /** Currently hidden model ids. */
    hidden(): string[];
    /**
     * Drop hidden ids the gateway no longer serves.
     *
     * The hidden set is only meaningful against a live directory: keeping an id
     * that has since left `GET /models` would make the settings page carry rows
     * nobody can act on, and a model that later returns would come back
     * invisibly hidden for no reason the user can see. Called on save, when the
     * directory is the freshest the session has.
     * @param ids - the hidden set as submitted.
     * @returns the subset still worth storing.
     */
    pruneHidden(ids: readonly string[]): string[];
    isHidden(model: string): boolean;
    /** Point the refresh loop at another API root (settings page change). */
    setBaseUrl(baseUrl: string): void;
    get baseUrl(): string;
    decision(model: string): {
        allowed: boolean;
        source: string;
        known: boolean;
    };
    /**
     * Reasoning capability for one model id (DSH `resolveModel().reasoning`
     * + pi-ai `thinkingLevelMap` source of truth). Ladder-less thinking models
     * (reasoning without an effort list) think with upstream defaults — see
     * `thinks()` — and expose no picker.
     */
    reasoningFor(model: string): {
        efforts: ReasoningEffortChoice[];
        defaultEffort: string;
    } | undefined;
    /** Whether the wire model may think (pi-ai `reasoning: true`). */
    thinks(model: string): boolean;
    /** Whether the model accepts image input. */
    supportsImage(model: string): boolean;
    /** Whether one effort id is selectable for the model. */
    supportsEffort(model: string, effort: string): boolean;
    requiresResponsesApi(model: string): boolean;
    contextWindowFor(model: string): number;
    maxTokensFor(model: string): number;
    /** ids exposed to DSH: live gateway list minus hidden (empty while unconfigured). */
    list(): string[];
    /** Catalog health snapshot (pending/ready/stale + counts). */
    snapshot(): CatalogSnapshot;
    get lastError(): string;
}
/**
 * Fetch the live gateway model list.
 *
 * `baseUrl` is the versioned API root (`http://api.lan/v1`) exactly as the user
 * configured it; only the resource is appended. Never synthesize a version
 * here — a gateway on `/v2` would otherwise be asked for `/v2/v1/models`.
 */
export declare function fetchMagpieModels(baseUrl: string, fetchImpl: typeof fetch, options?: {
    timeoutMs?: number;
    headers?: Record<string, string>;
}): Promise<Map<string, MagpieModelEntry>>;
/** Default cache location next to the plugin data dir (index.ts convention). */
export declare function defaultCachePath(dataDir: string): string;
