import { type EffectiveEndpoint, type MagpieSearchMode } from './settings.ts';
/**
 * Magpie 网页搜索提供方（WebSearchProvider）。
 *
 * 通过 DSH 的 `ctx.web.registerSearchProvider` 注册为独立搜索提供方，
 * 复用 `dsh-magpie-connect` 已保存的网关地址与 API Key，不覆盖内置
 * `web-search-deepseek` 配置。支持两种搜索模式：
 *
 * - `mcp`：调用 Magpie 原生 MCP 端点 `POST {gatewayBase}/mcp/magpie/web-search`，
 *   直接使用 Magpie 自身的搜索 API 或代搜模型配置，无需额外消耗对话模型轮次。
 * - `model`：调用 `POST {baseUrl}/messages` 并附带 Anthropic 原生
 *   `web_search_20250305` 服务器工具，可在设置页自由切换任意 Magpie 模型。
 */
/** Magpie 原生网页搜索 MCP 路径（与 yetone/magpie `gateway.SearchMCPPath` 一致）。 */
export declare const MAGPIE_SEARCH_MCP_PATH = "/mcp/magpie/web-search";
/** Anthropic Messages 搜索默认 `anthropic-version` 请求头。 */
export declare const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
/** Anthropic Messages 搜索默认最大生成 token 上限。 */
export declare const DEFAULT_SEARCH_MAX_TOKENS = 4096;
/** Anthropic Messages 搜索默认每次请求最大 `web_search` 使用次数。 */
export declare const DEFAULT_SEARCH_MAX_USES = 5;
/** 单次网页搜索请求默认超时（毫秒，与 Magpie 侧 `searchTimeout` 2 分钟一致）。 */
export declare const DEFAULT_SEARCH_TIMEOUT_MS = 120000;
/** 与 `@deepseek-ai/dsh-web/types` 结构兼容的搜索请求形状。 */
export interface WebSearchRequest {
    readonly query: string;
    readonly maxResults?: number;
    readonly llmProvider?: string;
}
/** 与 `@deepseek-ai/dsh-web/types` 结构兼容的单条搜索来源。 */
export interface WebSearchSource {
    readonly url: string;
    readonly title?: string;
    readonly snippet?: string;
    readonly summary?: string;
    readonly publishedAt?: string;
}
/** 与 `@deepseek-ai/dsh-web/types` 结构兼容的搜索结果。 */
export interface WebSearchResult {
    readonly content?: string;
    readonly sources: readonly WebSearchSource[];
    readonly truncated: boolean;
}
/** 与 `@deepseek-ai/dsh-web/types` 结构兼容的搜索提供方接口。 */
export interface WebSearchProvider {
    readonly id: string;
    readonly title?: string;
    readonly description?: Record<string, string> & {
        readonly en: string;
    };
    available(): boolean;
    ready?(llmProvider: string | undefined): Promise<boolean>;
    search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
/** 单次搜索生效的运行时配置快照。 */
export interface EffectiveSearchConfig {
    readonly mode: MagpieSearchMode;
    readonly model: string;
    readonly maxUses: number;
    readonly timeoutMs: number;
}
/** 结合连接信息与搜索配置的完整运行时快照。 */
export interface SearchRuntimeSnapshot {
    readonly endpoint: EffectiveEndpoint;
    readonly search: EffectiveSearchConfig;
}
/** 与 DSH `WebError` 结构兼容的错误类型（携带可机读的 `code` 字段）。 */
export type MagpieSearchErrorCode = 'WEB_ABORTED' | 'WEB_PROVIDER_CREDENTIAL_MISSING' | 'WEB_PROVIDER_ERROR';
export declare class MagpieSearchError extends Error {
    readonly code: MagpieSearchErrorCode;
    constructor(message: string, code: MagpieSearchErrorCode, options?: {
        cause?: unknown;
    });
}
/**
 * 将 Anthropic Messages API 搜索响应归一化为 DSH `WebSearchResult`。
 *
 * 与 DSH 官方 `web-search-deepseek` 保持同一解析约定：只消费结构化
 * `web_search_tool_result` 块中的 `web_search_result` 条目，缺失 `snippet`
 * 时回退到同 URL 的 `cited_text`，按 URL 去重；缺少结果块时抛错而不降级抓取正文。
 */
export declare function mapAnthropicSearchResponse(payload: unknown): WebSearchResult;
/**
 * 将 Magpie `/mcp/magpie/web-search` 返回的文本解析为结构化 `WebSearchResult`。
 *
 * 兼容 Magpie `webSearch()` 的两类标准输出：
 * 1. Search API / 计划自带搜索（`pagesSaid`）：编号列表 `1. 标题 — URL` + 摘要行；
 * 2. 代搜模型（`searchWith`）：回答正文 + `\n\nSources:\n- 标题 — URL`；
 * 3. 其他纯文本回答：保留正文为 `content`，并尽力提取链接作为 `sources`。
 */
export declare function parseMagpieMcpSearchText(raw: string): WebSearchResult;
/** 执行一次 MCP 模式的 Magpie 网页搜索。 */
export declare function searchViaMagpieMcp(options: {
    baseUrl: string;
    apiKey: string;
    query: string;
    maxResults?: number;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}, signal?: AbortSignal): Promise<WebSearchResult>;
/** 执行一次 Anthropic Messages 模式的 Magpie 指定模型搜索。 */
export declare function searchViaMagpieModel(options: {
    baseUrl: string;
    apiKey: string;
    model: string;
    query: string;
    maxUses?: number;
    maxTokens?: number;
    apiVersion?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}, signal?: AbortSignal): Promise<WebSearchResult>;
/**
 * 注册到 DSH `ctx.web` 的 Magpie 搜索提供方。
 *
 * 每次操作均从 `resolveSnapshot()` 捕获一份原子快照，保证设置页修改后立即生效
 * 且不会在单次请求中混用新旧配置。
 */
export declare class MagpieSearchProvider implements WebSearchProvider {
    #private;
    readonly id: string;
    readonly title: string;
    readonly description: {
        readonly en: "Search the web through the Magpie gateway (follows Magpie’s own search settings by default, or a selected Magpie model). Configure on the Magpie settings page.";
        readonly zh: "通过 Magpie 网关执行网页搜索（默认沿用 Magpie 自身的代搜模型或 Search API 配置，也可指定 Magpie 模型）。在「Magpie 网关」设置页中配置。";
    };
    constructor(options: {
        id: string;
        title?: string;
        resolveSnapshot: () => SearchRuntimeSnapshot;
        fetchImpl?: typeof fetch;
    });
    /**
     * 同步结构可用性检查：仅校验地址和数值参数是否合法，不检查凭据是否已填。
     * 凭据与模型完备性交由 `ready()` 决定，以便未配置完成时 `dsh-tool-web`
     * 优雅撤下 `web_search` 而不是报 `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`。
     */
    available(): boolean;
    /** 异步就绪检查：必须具备网关地址、API Key，且 model 模式下必须已指定模型。 */
    ready(): Promise<boolean>;
    search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
