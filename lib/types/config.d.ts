import type { MagpieSearchMode } from './settings.ts';
export interface DshMagpieConnectConfig {
    /**
     * Provider route id registered into DSH (the grouping key in the model
     * picker). Changing it after sessions already reference the old id will
     * orphan those model selections — prefer `displayName` for a cosmetic
     * rename.
     */
    providerId?: string;
    /**
     * Display name shown in the model picker for this provider.
     * Defaults to the explicit `providerId` when one is given,
     * otherwise to `'Magpie'`.
     */
    displayName?: string;
    /**
     * Versioned API root, e.g. `http://127.0.0.1:3425/v1`. The version is part of
     * the value, not something this plugin adds: a gateway that later serves
     * `/v2` or `/v3` is reached by changing this one string. Trailing slashes are
     * stripped; the path is kept.
     */
    baseUrl?: string;
    /**
     * Gateway credential. Required: an empty key leaves the plugin unconfigured
     * even though `baseUrl` has a default, so the picker stays empty until it is
     * set (both are required by `isConfigured`).
     */
    apiKey?: string;
    /**
     * Plugin state directory (status snapshot, settings file, catalog cache).
     * Defaults to `$DSH_HOME/storages/magpie-connect`
     * (`~/.dsh/storages/magpie-connect`).
     */
    dataDir?: string;
    /** Model list refresh interval in seconds. */
    refreshSeconds?: number;
    /**
     * Connection-setup retries for transient upstream failures (429/5xx with
     * backoff). Turn-level retries stay owned by DSH.
     */
    maxRetries?: number;
    /** Overall upstream request cap in milliseconds. */
    timeoutMs?: number;
    /**
     * Stall watchdog: max wait for the first upstream event in milliseconds
     * (queueing happens here). Non-positive disables that phase.
     */
    firstEventTimeoutMs?: number;
    /**
     * Stall watchdog: max silence between upstream events in milliseconds.
     * Non-positive disables that phase.
     */
    idleTimeoutMs?: number;
    /** 网页搜索模式：`'mcp'` 使用 Magpie 网关原生 MCP 搜索，`'model'` 通过 `/messages` 调用指定模型搜索。 */
    searchMode?: MagpieSearchMode;
    /** `'model'` 搜索模式下使用的 Magpie 模型 ID（留空时需在设置页选择）。 */
    searchModel?: string;
    /** `'model'` 搜索模式下单次请求最多触发 `web_search` 工具的次数（正整数，默认 5）。 */
    searchMaxUses?: number;
    /** 单次网页搜索请求超时（毫秒，默认 120000）。 */
    searchTimeoutMs?: number;
    /**
     * Per-tool-call timeout (ms) for the Magpie MCP hub registered into DSH's
     * `ctx.mcpManager` when the settings page enables it. Hub tool calls can be
     * slow (a search, a browser action), so this is looser than DSH's 60s default.
     * Defaults to 120000.
     */
    mcpToolCallTimeoutMs?: number;
    /**
     * The Magpie Library agent the hub URL names — the segment after
     * `/mcp/magpie/hub/`. Defaults to `dsh` (Magpie's built-in DSH agent, shown in
     * the Library as "DeepSeek Harness"). With a named agent, Magpie gives that
     * agent's ticked servers and, past 10 tools, its on-demand
     * `find_tools`/`call_tool` pair instead of every schema. Use `''` (or `all`)
     * for the all-apps address `/mcp/magpie/hub` (every server, no on-demand).
     */
    mcpAgent?: string;
}
export declare const defaults: {
    readonly providerId: "dsh-magpie-connect";
    readonly displayName: "Magpie";
    readonly baseUrl: "http://127.0.0.1:3425/v1";
    readonly apiKey: "";
    readonly refreshSeconds: 300;
    readonly maxRetries: 2;
    readonly timeoutMs: 300000;
    readonly firstEventTimeoutMs: 90000;
    readonly idleTimeoutMs: 60000;
    readonly searchMode: MagpieSearchMode;
    readonly searchModel: "";
    readonly searchMaxUses: 5;
    readonly searchTimeoutMs: 120000;
    readonly mcpToolCallTimeoutMs: 120000;
    readonly mcpAgent: "";
};
export type ResolvedConfig = Required<Pick<DshMagpieConnectConfig, 'providerId' | 'refreshSeconds' | 'searchMode' | 'searchModel' | 'searchMaxUses' | 'searchTimeoutMs' | 'mcpToolCallTimeoutMs' | 'mcpAgent'>> & DshMagpieConnectConfig & {
    displayName: string;
    baseUrl: string;
    apiKey: string;
    dataDir: string;
};
export declare function resolveConfig(config?: DshMagpieConnectConfig): ResolvedConfig;
