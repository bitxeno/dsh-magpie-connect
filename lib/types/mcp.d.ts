import { type EffectiveEndpoint, type McpServerStatusView } from './settings.ts';
/** Namespace every hub tool takes: `mcp__magpie__<tool>`. */
export declare const MAGPIE_MCP_SERVER_NAME = "magpie";
/**
 * Magpie's MCP hub path (the gateway's `gateway.HubMCPAll`): one address with
 * every server in the Library, ticked for an agent or not.
 */
export declare const MAGPIE_HUB_MCP_PATH = "/mcp/magpie/hub";
/**
 * The agent segment used when none is configured: empty — the **all-apps**
 * address `/mcp/magpie/hub`, which lists every server in the Library (ticked
 * for any agent or none). This is the default because plugin-side on-demand
 * does not need a per-agent tick, and a router-hosted Magpie never detects DSH
 * as a local agent (so `/mcp/magpie/hub/dsh` would list nothing there). Set a
 * name to use that agent's ticked subset instead.
 */
export declare const DEFAULT_MCP_AGENT = "";
/**
 * Normalize a configured agent name into the hub URL segment. Accepts the id
 * (`dsh`) and maps the display name "DeepSeek Harness" (and a few spellings)
 * onto it, so a user who copies the Library label still lands on the id.
 * Returns `''` for the all-apps address.
 */
export declare function normalizeMcpAgent(raw: unknown): string;
/**
 * Whether the gateway at this API root runs on **this** machine.
 *
 * This decides which hub address to use. A local Magpie can see DSH as an
 * installed agent, so `/mcp/magpie/hub/<agent>` gives that agent's ticked
 * servers *and* Magpie's own on-demand pair. A Magpie on another host (a
 * router, say) never detects DSH, so its agent address lists nothing — there
 * the all-apps address plus this plugin's own on-demand is the only thing that
 * works.
 *
 * Judged from the URL alone: no DNS lookup, so the answer is instant and does
 * not change with resolver state. `127.0.0.0/8` counts as loopback.
 * @param baseUrl - the configured API root (`http://127.0.0.1:3425/v1`).
 */
export declare function isLocalGateway(baseUrl: string): boolean;
/** The agent a **local** gateway is asked for when none is configured. */
export declare const LOCAL_DEFAULT_AGENT = "dsh";
/**
 * The hub agent segment to use for this gateway.
 *
 * Local gateways get a named agent (`dsh` unless configured otherwise) so
 * Magpie itself performs the on-demand switch and keeps its server catalog in
 * `find_tools`. Remote gateways get the all-apps address, because a Magpie on
 * another host never detects DSH and its agent address would list nothing.
 * @param baseUrl - the configured API root.
 * @param configured - the user's `mcpAgent` ('' when unset).
 * @returns the segment: `''` for the all-apps address.
 */
export declare function resolveHubAgent(baseUrl: string, configured: string): string;
/**
 * The URL DSH's mcp-client dials: the gateway base (the versioned API root with
 * its `/vN` segment stripped, exactly as the trace/search endpoints derive it)
 * plus the hub path, then the agent segment.
 *
 * With an agent (`dsh`) Magpie gives that agent's ticked servers and — when it
 * has more than 10 tools and is not a self-searching client — its on-demand
 * `find_tools`/`call_tool` pair instead of every schema. With `''` it gives
 * every server whole (the all-apps address).
 * `undefined` until the endpoint is fully configured.
 */
export declare function magpieHubMcpUrl(endpoint: EffectiveEndpoint, agent?: string): string | undefined;
/**
 * Build the entry handed to `ctx.mcpManager.register`. A Streamable HTTP server
 * with the gateway key as a Bearer header. The key is passed verbatim (no
 * `${credential:…}` template) and lives only in the manager's in-memory
 * registration — `list()` reports name/status, never the entry, so it is never
 * readable from a config document.
 * @returns the registration, or `null` when the endpoint cannot be dialled.
 */
export declare function buildHubRegistration(endpoint: EffectiveEndpoint, options: {
    toolCallTimeoutMs: number;
    startupTimeoutMs?: number;
    agent?: string;
}): HubRegistration | null;
/** A registered entry DSH's `ctx.mcpManager.register` accepts (Streamable HTTP). */
export interface HubRegistration {
    transport: 'streamable-http';
    url: string;
    headers?: Record<string, string>;
    toolCallTimeoutMs: number;
    startupTimeoutMs: number;
}
/**
 * Identity of one registration, for change detection. Rebuilding on every
 * reconcile would tear down and re-dial a healthy connection; comparing this
 * keeps an unchanged endpoint/key a no-op and only rebuilds when the URL or
 * the key actually moved. `undefined` means "nothing to register".
 */
export declare function hubFingerprint(registration: HubRegistration | null): string | undefined;
/**
 * Flatten one `ctx.mcpManager.list()` row's status — a union owned by
 * mcp-client/mcp-manager — into the small view the settings page renders.
 * Unknown shapes become `unknown` rather than a misleading "connected".
 */
export declare function toStatusView(status: unknown): McpServerStatusView;
/** One probe's outcome: whether the hub answered, and what it listed. */
export interface HubProbeOutcome {
    ok: boolean;
    /** Tools the hub listed (names, capped for display). */
    toolNames: string[];
    toolCount: number;
    /**
     * True when the hub answered but reports it is switched off in Magpie
     * (its `instructions` carry the gateway's "hub is off" message) — reachable
     * but exposing no tools until the Library switch is turned on.
     */
    hubOff?: boolean;
    /** The hub's `instructions` line (names the servers behind it), when it sent one. */
    instructions?: string;
    /** Diagnostic text when the probe failed. */
    error?: string;
}
/**
 * Probe the hub over plain Streamable-HTTP JSON-RPC (initialize → tools/list).
 *
 * This is what the settings page's "Test MCP" button calls through the Host:
 * it answers "is the hub reachable and what does it expose" without registering
 * anything into `ctx.mcpManager` — so it works even before the switch is saved.
 * The gateway key stays on the Host; the browser only sees the outcome.
 *
 * The hub answers each POST with a JSON object (it only streams when the client
 * sends `Accept: text/event-stream`, which this probe does not), so a simple
 * request/response exchange is enough.
 * @param endpoint - the effective endpoint (baseUrl + key); must be configured.
 * @param options - probe budget and an optional external cancellation signal.
 */
export declare function probeMagpieHub(endpoint: EffectiveEndpoint, options: {
    timeoutMs: number;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    agent?: string;
}): Promise<HubProbeOutcome>;
/** One raw MCP tool as `tools/list` returns it. */
export interface RawMcpTool {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
}
/** A normalized tool result: text projection plus whether the server flagged an error. */
export interface McpCallResult {
    text: string;
    isError: boolean;
}
/** Build request headers: JSON, the gateway key as Bearer, no event stream. */
export declare function hubHeaders(apiKey: string): Record<string, string>;
/**
 * List the hub's raw tools with a bare `tools/list` (no `initialize`, no
 * session — the gateway answers it and only hands out a session id when a
 * client initializes, which this path never needs). Used to size the tool set
 * and to expose it whole when it is small enough.
 * @param endpoint - effective endpoint (baseUrl + key); must be configured.
 */
export declare function listHubTools(endpoint: EffectiveEndpoint, options: {
    timeoutMs: number;
    fetchImpl?: typeof fetch;
    agent?: string;
    signal?: AbortSignal;
}): Promise<RawMcpTool[]>;
/**
 * Run one hub tool by its `<server>__<tool>` name with a bare `tools/call`.
 * The hub hands the call to the server behind it. An MCP `isError` result is
 * returned (not thrown) so the caller decides how to surface it.
 */
export declare function callHubTool(endpoint: EffectiveEndpoint, name: string, args: unknown, options: {
    timeoutMs: number;
    fetchImpl?: typeof fetch;
    agent?: string;
    signal?: AbortSignal;
}): Promise<McpCallResult>;
/**
 * The two on-demand proxy tools' hub names (the gateway's `hubFindTool` /
 * `hubCallTool`). A hub tool is `<server>__<tool>`, so neither collides with a
 * real tool's name.
 */
export declare const HUB_FIND_TOOL = "find_tools";
export declare const HUB_CALL_TOOL = "call_tool";
/** Above this many hub tools, expose `find_tools` + `call_tool` instead of every schema. */
export declare const MCP_ON_DEMAND_OVER = 10;
