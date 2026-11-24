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
/** Magpie 网页搜索模式：`'mcp'` 走网关原生 MCP 搜索，`'model'` 通过 Messages API 指定模型搜索。 */
export type MagpieSearchMode = 'mcp' | 'model';
export interface MagpiePageSettings {
    baseUrl?: string;
    apiKey?: string;
    /** Magpie Web Key; never returned to the browser, only its presence is. */
    webKey?: string;
    /**
     * Allowlist of model ids the picker offers. `undefined` = inherit every model
     * the gateway serves; `[]` = offer none; otherwise exactly these ids.
     */
    enabledModels?: string[] | undefined;
    /**
     * Whether the composer's routing-trace icon shows in the input box's right
     * tool row. Absent reads as shown (the pre-toggle behavior); `false` hides
     * it. The settings page's switch writes `true`/`false` explicitly.
     */
    showComposerIcon?: boolean;
    /**
     * Whether the Magpie MCP hub is wired into DSH (`ctx.mcpManager`). Absent
     * reads as `false`: an MCP server is a live connection to the gateway and must
     * never start on its own — the settings page only starts it after the user
     * ticks the box and saves. Only meaningful together with a saved endpoint.
     */
    mcpEnabled?: boolean;
    /** 网页搜索模式（缺省回退到 patch 配置或默认 `'mcp'`）。 */
    searchMode?: MagpieSearchMode;
    /** `'model'` 搜索模式下选定的 Magpie 模型 ID。 */
    searchModel?: string;
    /** `'model'` 搜索模式下单次请求最大搜索次数（正整数）。 */
    searchMaxUses?: number;
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
/** 网页搜索配置解析结果（页面保存值优先于 patch 配置）。 */
export interface EffectiveSearchSettings {
    mode: MagpieSearchMode;
    model: string;
    maxUses: number;
}
/**
 * One MCP server's live status, flattened from `ctx.mcpManager.list()` and the
 * mcp-client connection states into the few cases the settings page renders.
 * `unknown` covers a composition whose manager reports a shape this plugin does
 * not know — the page then shows a neutral line instead of a wrong "connected".
 */
export interface McpServerStatusView {
    state: 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'disabled' | 'unknown';
    /** Registered tool count while connected. */
    toolCount?: number;
    /** Diagnostic text for a reconnecting/failed instance. */
    lastError?: string;
}
/**
 * What the settings page is allowed to see. The credential never travels to
 * the browser: the page only learns whether one is stored, so a page that
 * loads (or reloads) cannot leak it through the DOM, devtools, or an XSS in
 * the host UI.
 */
export interface MagpieSettingsView {
    baseUrl: string;
    hasApiKey: boolean;
    hasWebKey: boolean;
    enabledModels?: string[];
    inheritedModels: boolean;
    /** Whether the composer's routing icon shows (absent reads as true). */
    showComposerIcon: boolean;
    /** 是否已将 Magpie MCP 工具接入 DSH（`ctx.tools`）。 */
    mcpEnabled: boolean;
    /** 当前 DSH 环境是否加载了 `ctx.tools`（可注册工具）。 */
    mcpAvailable: boolean;
    /** 是否已注册至少一个 Magpie 工具（已勾选、已配置且已拉到工具清单）。 */
    mcpRegistered: boolean;
    /** 当前暴露方式：直连、插件按需，或透传 Magpie 自己的按需对。 */
    mcpMode?: 'direct' | 'on-demand' | 'passthrough';
    /** 实际使用的 Hub 地址：`agent`（本地，Magpie 按需）或 `all`（全应用）。 */
    mcpAddress?: 'agent' | 'all';
    /** Hub 当前列出的工具数（决定是否进入按需模式）。 */
    mcpHubToolCount?: number;
    /** 已注册到 DSH 的工具数（按需模式下为 2）。 */
    mcpRegisteredCount?: number;
    /** Magpie MCP 工具集当前状态（未注册时省略）。 */
    mcpStatus?: McpServerStatusView;
    /** 启用但工具清单拉取失败时的错误文本（供设置页显示）。 */
    mcpError?: string;
    /** 当前生效的网页搜索模式。 */
    searchMode: MagpieSearchMode;
    /** 当前生效的搜索模型 ID（`model` 模式下使用）。 */
    searchModel: string;
    /** 当前生效的单次最大搜索次数。 */
    searchMaxUses: number;
    /** DSH 的 `web.searchProvider` 当前是否已切换为本插件。 */
    searchActive: boolean;
    /** 本插件注册到 DSH `ctx.web` 的 provider id。 */
    searchProviderId: string;
    /** 当前 DSH 环境是否加载了 `ctx.web` 并成功注册了搜索提供方。 */
    searchRegistered: boolean;
    /** 当前 DSH 环境是否支持通过设置页一键修改 `web.searchProvider`。 */
    searchSwitchable: boolean;
    /** DSH 当前生效的 `web.searchProvider`（未设置即自动选择时省略）。 */
    activeSearchProvider?: string;
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
/** 规范化网页搜索模式，仅接受 `'mcp'` 或 `'model'`。 */
export declare function normalizeSearchMode(raw: unknown): MagpieSearchMode;
/** 规范化单次搜索最大工具调用次数（正整数，限制在 1..20）。 */
export declare function normalizeSearchMaxUses(raw: unknown): number;
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
/** 按字段合并搜索配置：设置页保存值优先于 patch 配置与默认值。 */
export declare function resolveEffectiveSearchSettings(patch: EffectiveSearchSettings, page: MagpiePageSettings): EffectiveSearchSettings;
/** Fully configured only when both URL and key are present. Either missing gates everything. */
export declare function isConfigured(endpoint: EffectiveEndpoint): boolean;
/** In-memory settings with file persistence. Synchronous reads for the hot path. */
export declare class SettingsStore {
    #private;
    constructor(options?: {
        path?: string;
        legacyPath?: string;
        privateDir?: boolean;
    });
    /**
     * Read and normalize the persisted document without touching memory or disk.
     *
     * New location first; when it is absent, fall back **read-only** to the
     * pre-0.5 file so an upgrade shows the user's saved endpoint immediately.
     *
     * A file that is *present but unreadable* is NOT treated as "no
     * configuration": it sets {@link #loadFailed} (blocking a later partial save
     * from overwriting it with the blank state) and still returns `{}` so callers
     * have something to render.
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
