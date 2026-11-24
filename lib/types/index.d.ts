import { ModelCatalog } from './adapter/catalog.ts';
import { type DshMagpieConnectConfig } from './config.ts';
import { SettingsStore, type EffectiveSearchSettings, type McpServerStatusView } from './settings.ts';
/**
 * dsh-magpie-connect DSH cordis plugin entry.
 *
 * Registers a DSH LlmAdapter streaming directly from the Magpie gateway
 * (marketplace shape: no child process, no binary, no proxy). The model
 * catalog warms up in the background (live gateway list with disk cache +
 * static snapshot fallback).
 *
 * The Settings sidebar page (client half) talks to the REST routes below:
 * connection endpoint (baseUrl/apiKey) applies live without restart, and the
 * hidden-model list filters the picker immediately.
 *
 * dispose(): stop the catalog refresh loop. The cordis fiber disposal
 * guarantees this runs on plugin reload/unload and on DSH shutdown.
 */
export interface PluginContext {
    logger: {
        info(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        error(...args: unknown[]): void;
    };
    llm?: {
        registerAdapter(providers: string[], adapter: unknown): unknown;
    };
    get?(key: string): unknown;
    inject?(deps: string[], fn: (ctx: Record<string, unknown>) => unknown): unknown;
    effect?(fn: () => () => void): unknown;
    on?(event: string, listener: (...args: never[]) => unknown): () => void;
    /**
     * Cordis `ctx.emit` (mixed in from the events service). Used to publish
     * `llm/adapters-updated` when this plugin's own catalog moves, without
     * touching the adapter registry.
     */
    emit?(event: string, ...args: unknown[]): unknown;
}
export declare const name = "dsh-magpie-connect";
export declare const inject: readonly ["llm"];
/** Browser-facing REST root for the settings page (served under the shared /api channel). */
export declare const SETTINGS_API = "/api/magpie-settings";
export declare const MODELS_API = "/api/magpie-models";
export declare const TEST_API = "/api/magpie-test";
/**
 * Candidate discovery: asks the endpoint the form currently shows (including a
 * key typed but not yet saved) what it serves. The reply is candidates the
 * user picks from — never configuration written behind them.
 */
export declare const DISCOVER_API = "/api/magpie-discover";
/**
 * Routing-trace read for the composer button's popover (`/api/magpie-trace`).
 * The host reads the gateway's quotas (`/v1/magpie/quotas`) with the stored
 * key and serves the compressed view — the browser never sees the key nor
 * talks to the gateway cross-origin.
 */
export declare const TRACE_API = "/api/magpie-trace";
/** Same-origin proxy for Magpie Web provider icons; the Web Key stays on the Host. */
export declare const ICON_API = "/api/magpie-icon";
/** 设置页网页搜索测试路由（在 Host 侧使用当前表单或已保存凭据执行一次试探搜索）。 */
export declare const SEARCH_TEST_API = "/api/magpie-search-test";
/**
 * 设置页 MCP Hub 测试路由：在 Host 侧用当前表单或已保存凭据直接对
 * `/mcp/magpie/hub` 做一次 initialize + tools/list 探测，不注册任何实例。
 */
export declare const MCP_TEST_API = "/api/magpie-mcp-test";
/** DSH `web` 服务与本插件搜索提供方的绑定状态。 */
export interface WebSearchBindingState {
    registered: boolean;
    switchable: boolean;
    active: boolean;
    activeProvider?: string;
}
/** Backend generation behind the shared settings routes (newest wins). */
export interface SettingsBackend {
    store: SettingsStore;
    catalog: ModelCatalog;
    patchEndpoint: {
        baseUrl: string;
        apiKey: string;
    };
    patchSearch: EffectiveSearchSettings;
    searchTimeoutMs: number;
    providerId: string;
    /** Hub agent segment for the MCP test route ('' = all-apps). */
    mcpAgent: string;
    effective: () => {
        baseUrl: string;
        apiKey: string;
    };
    effectiveSearch: () => EffectiveSearchSettings;
    applyPageSettings: () => void;
    readWebSearchState: () => WebSearchBindingState;
    setWebSearchActive: (active: boolean) => Promise<void>;
    restoreWebSearchProvider: (provider: string | undefined) => Promise<void>;
    readMcpState: () => McpBindingState;
    /** Re-align the MCP tool set now (awaits the tools/list). */
    reconcileMcp: () => Promise<void>;
}
/** Magpie MCP 工具集在 DSH 中的绑定状态。 */
export interface McpBindingState {
    /** 当前环境是否加载了 `ctx.tools`（可注册工具）。 */
    available: boolean;
    /** 是否已注册至少一个 Magpie 工具（已勾选、已配置且已拉到工具清单）。 */
    registered: boolean;
    /** 当前暴露方式：直连、插件按需，或透传 Magpie 自己的按需对。 */
    mode?: 'direct' | 'on-demand' | 'passthrough';
    /** 实际使用的 Hub 地址：`agent`（本地，Magpie 按需）或 `all`（全应用）。 */
    address?: 'agent' | 'all';
    /** Hub 当前列出的工具数（决定是否进入按需模式）。 */
    hubToolCount?: number;
    /** 已注册到 DSH 的工具数（按需模式下为 2）。 */
    registeredCount?: number;
    /** 当前连接状态（未注册时省略）。 */
    status?: McpServerStatusView;
}
interface ModelRow {
    /** Route id, used by the allowlist, requests and session history. */
    id: string;
    /** `<group>/<display_name>` label the settings list and picker show. */
    displayName: string;
    contextWindow?: number;
    maxTokens?: number;
    image: boolean;
    responsesOnly: boolean;
    reasoning: boolean;
    efforts: string[];
    /** Whether the allowlist currently offers this model in the picker. */
    enabled: boolean;
    /**
     * What lists this id right now: `'gateway'` (the live directory), `'static'`
     * (only the built-in snapshot) or `'none'` (nothing does — a hidden id the
     * gateway has dropped). The page labels the last two so a stale row cannot be
     * mistaken for a model the gateway still serves. Candidates from the discover
     * route leave it unset: they come from the gateway by construction.
     */
    source?: 'gateway' | 'static' | 'none';
}
/** One discovered candidate: a {@link ModelRow} without this plugin's own allowlist flag. */
export type CandidateRow = Omit<ModelRow, 'enabled'>;
/** @internal 测试辅助钩子：重置搜索提供方占位记录与等待接管队列。 */
export declare function __resetSearchProviders(): void;
/** @internal Test hook: forget installed routes so the next apply reinstalls. */
export declare function __resetSettingsRoutes(): void;
export declare function apply(ctx: PluginContext, config?: DshMagpieConnectConfig): {
    ready: Promise<{
        version: string;
    }>;
};
export { MagpieAdapter } from './adapter/magpie-adapter.ts';
export { ModelCatalog } from './adapter/catalog.ts';
export { MagpieSearchProvider, MagpieSearchError, mapAnthropicSearchResponse, parseMagpieMcpSearchText, searchViaMagpieMcp, searchViaMagpieModel, } from './search.ts';
export { SettingsStore, isConfigured, resolveEffectiveEndpoint, resolveEffectiveSearchSettings, type MagpieSearchMode, } from './settings.ts';
export { resolveConfig, type DshMagpieConnectConfig, } from './config.ts';
