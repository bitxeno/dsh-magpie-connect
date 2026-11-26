import { type RawMcpTool } from './mcp.ts';
import type { EffectiveEndpoint } from './settings.ts';
/** Public tool-name prefix every Magpie hub tool carries. */
export declare const MCP_TOOL_PREFIX = "mcp__magpie__";
/**
 * Turn a hub tool name (`<server>__<tool>`) into a safe model-facing name.
 * Non-word characters become `-`; an over-long name is truncated and given a
 * short content hash so two long names never collapse onto one. The hub name
 * itself is kept separately for the actual call.
 */
export declare function publicToolName(hubName: string): string;
/** The slice of DSH's `ctx.tools` this module drives. */
export interface DshToolService {
    register(definition: DshToolDefinition): () => void;
}
/** A content block DSH's tool output renders. */
type TextBlock = {
    type: 'text';
    text: string;
};
/**
 * The structural shape of a DSH ToolDefinition this module builds. Kept local
 * (no `@deepseek-ai/*` import) so the plugin stays independent of the exact
 * host version; the fields mirror `@deepseek-ai/dsh-tools`'s contract.
 */
export interface DshToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    timeoutMs?: number;
    output: {
        schema: Record<string, unknown>;
        render(args: unknown, value: unknown): TextBlock[];
    };
    execute(args: unknown, exec: {
        signal?: AbortSignal;
    }): Promise<unknown>;
}
/** Options shared by every definition: live endpoint, timeout, agent. */
export interface HubToolOptions {
    /** Resolved on each call so a rotated key/origin applies without re-registering. */
    getEndpoint: () => EffectiveEndpoint;
    toolCallTimeoutMs: number;
    agent: string;
}
/** Direct definition for one hub tool: `mcp__magpie__<server>__<tool>`. */
export declare function directToolDefinition(tool: RawMcpTool, options: HubToolOptions): DshToolDefinition;
/** How many characters of the server/tool catalog `find_tools`' description carries. */
export declare const FIND_CATALOG_MAX = 1200;
/** One hub server and its tool names, in first-seen order. */
interface ServerGroup {
    server: string;
    tools: string[];
}
/** Group `<server>__<tool>` names into their servers, keeping discovery order. */
export declare function groupHubTools(tools: readonly RawMcpTool[]): ServerGroup[];
/**
 * The catalog `find_tools`' description carries: which servers exist and what
 * tools each one offers.
 *
 * This is load-bearing, not decoration. Told only "search for a tool", a model
 * has no way to know the hub contains, say, a **bookmark** server — so a user
 * asking "find my bt bookmarks" reaches for a browser or the filesystem instead
 * of the hub. Magpie's gateway hit exactly this (a model asked for a picture
 * searched three times and gave up), and its fix is the same: name every server
 * and its tools in `find_tools`' own description, because that is the only text
 * the model sees on every request in on-demand mode.
 *
 * The budget is shared fairly: servers are given room shortest-first (so a
 * three-tool server is never crowded out by a seventy-seven-tool one), and a
 * server that still overflows is cut with a "+N more" marker.
 * @param tools - the hub's tools.
 * @param maxChars - description budget for the catalog.
 */
export declare function buildToolCatalog(tools: readonly RawMcpTool[], maxChars?: number): string;
/**
 * The on-demand `find_tools` proxy: search the hub's tools, get their schemas.
 *
 * The description carries the server/tool catalog (see {@link buildToolCatalog}):
 * in on-demand mode this text is the model's only evidence of what the hub can
 * do, so it must name the servers rather than merely explain how to search.
 * @param options - live endpoint and budgets.
 * @param tools - the hub's current tools, catalogued into the description.
 */
export declare function findToolsDefinition(options: HubToolOptions, tools?: readonly RawMcpTool[]): DshToolDefinition;
/** The on-demand `call_tool` proxy: run one hub tool by its `<server>__<tool>` name. */
export declare function callToolDefinition(options: HubToolOptions): DshToolDefinition;
/** Which tools the current hub set exposes. */
export type McpToolMode = 'direct' | 'on-demand' | 'passthrough';
/**
 * Whether a `tools/list` result is Magpie's *own* on-demand set.
 *
 * When a named agent has more than 10 tools and Magpie's "Tools on demand" is
 * on, the gateway answers `tools/list` with a small proxy set — `find_tools`
 * and `call_tool`, and on newer Magpies also `run_code` — instead of every
 * schema. It is the same idea this plugin implements, so such a result is
 * passed through as-is: registering Magpie's definitions keeps its own
 * descriptions, including the server catalog it puts in `find_tools`.
 *
 * Recognised by shape, not by an exact count, so a gateway that adds another
 * proxy tool still matches: it must carry `find_tools` and `call_tool`, and
 * nothing outside that known proxy family.
 */
export declare function isHubOnDemandPair(tools: readonly RawMcpTool[]): boolean;
/**
 * Decide how to expose one `tools/list` result.
 *
 * - `passthrough` — the gateway already answered with its on-demand proxy set
 *   (an agent address past 10 tools): register its definitions as they are, so
 *   Magpie's catalog reaches the model unchanged.
 * - `on-demand` — the gateway listed everything and there are more than
 *   `MCP_ON_DEMAND_OVER` tools: build the pair here, keeping every schema out
 *   of the request. This is what a remote gateway needs, since its agent
 *   address never lists DSH.
 * - `direct` — small enough that registering each tool costs less than a
 *   search before every call.
 * @param tools - the hub's `tools/list` result.
 */
export declare function toolModeFor(tools: readonly RawMcpTool[]): McpToolMode;
/**
 * Registers a tool set on `ctx.tools` and swaps it atomically: `apply` unregisters
 * the previous generation before registering the next, so the model never sees a
 * half-swapped set. Every disposer is tracked so disposal unwinds them all.
 */
export declare class MagpieToolRegistrar {
    #private;
    constructor(tools: DshToolService, options: HubToolOptions);
    /** Current exposure: how many hub tools exist, the mode, and how many DSH tools are registered. */
    state(): {
        mode: McpToolMode;
        hubToolCount: number;
        registeredCount: number;
    };
    /** Register the hub's tools in the mode its count selects. Replaces any previous set. */
    apply(tools: RawMcpTool[]): void;
    /** Unregister every tool this registrar registered. Idempotent. */
    unregister(): void;
    /** Release everything and refuse further registration. */
    dispose(): void;
}
export {};
