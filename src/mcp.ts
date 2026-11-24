/**
 * Magpie MCP hub wiring.
 *
 * The gateway serves its whole MCP Library (search, browser, image tools, and
 * the servers the user ticked) as one Streamable HTTP MCP server at
 * `/mcp/magpie/hub`. Rather than mounting a `@deepseek-ai/dsh-mcp-client` row in
 * the patch (which would dial the gateway on every boot), this plugin registers
 * the hub into DSH's `ctx.mcpManager` **on demand** — only after the user ticks
 * the box on the settings page and saves. That keeps "MCP services default off"
 * true: a boot with no saved opt-in never opens a connection.
 *
 * One instance, stable namespace: every hub tool appears as
 * `mcp__magpie__<tool>`. Enabling, editing the endpoint, or rotating the key
 * rebuilds the registration (the callbacks close over the current values, so
 * they never go stale), and the settings page reflects the live connection
 * status the manager reports.
 */
import { deriveGatewayBase } from './trace.ts'
import { isConfigured, normalizeBaseUrl, type EffectiveEndpoint, type McpServerStatusView } from './settings.ts'

/** Namespace every hub tool takes: `mcp__magpie__<tool>`. */
export const MAGPIE_MCP_SERVER_NAME = 'magpie'

/**
 * Magpie's MCP hub path (the gateway's `gateway.HubMCPAll`): one address with
 * every server in the Library, ticked for an agent or not.
 */
export const MAGPIE_HUB_MCP_PATH = '/mcp/magpie/hub'

/**
 * The agent segment used when none is configured: empty — the **all-apps**
 * address `/mcp/magpie/hub`, which lists every server in the Library (ticked
 * for any agent or none). This is the default because plugin-side on-demand
 * does not need a per-agent tick, and a router-hosted Magpie never detects DSH
 * as a local agent (so `/mcp/magpie/hub/dsh` would list nothing there). Set a
 * name to use that agent's ticked subset instead.
 */
export const DEFAULT_MCP_AGENT = ''

/**
 * Normalize a configured agent name into the hub URL segment. Accepts the id
 * (`dsh`) and maps the display name "DeepSeek Harness" (and a few spellings)
 * onto it, so a user who copies the Library label still lands on the id.
 * Returns `''` for the all-apps address.
 */
export function normalizeMcpAgent(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_MCP_AGENT
  const value = raw.trim()
  if (value === '') return DEFAULT_MCP_AGENT
  // The all-apps address is requested explicitly.
  if (value === '-' || value.toLowerCase() === 'all') return ''
  const lower = value.toLowerCase().replace(/[\s_]+/gu, '-')
  if (lower === 'deepseek-harness' || lower === 'deepseekharness' || lower === 'dsh') return 'dsh'
  return value
}

/** Loopback hosts: a gateway reached here runs on this machine. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]', '0.0.0.0'])

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
export function isLocalGateway(baseUrl: string): boolean {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    return false
  }
  // `URL` normalises IPv6 to `[::1]`; both spellings are accepted.
  const host = url.hostname.toLowerCase()
  if (LOOPBACK_HOSTS.has(host)) return true
  return /^127\.\d+\.\d+\.\d+$/u.test(host)
}

/** The agent a **local** gateway is asked for when none is configured. */
export const LOCAL_DEFAULT_AGENT = 'dsh'

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
export function resolveHubAgent(baseUrl: string, configured: string): string {
  if (!isLocalGateway(baseUrl)) return ''
  return configured === '' ? LOCAL_DEFAULT_AGENT : configured
}

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
export function magpieHubMcpUrl(endpoint: EffectiveEndpoint, agent: string = DEFAULT_MCP_AGENT): string | undefined {
  if (!isConfigured(endpoint)) return undefined
  let normalised: string
  try {
    normalised = normalizeBaseUrl(endpoint.baseUrl)
  } catch {
    return undefined
  }
  const base = deriveGatewayBase(normalised)
  if (base === undefined || base === '') return undefined
  const segment = agent === '' ? '' : `/${encodeURIComponent(agent)}`
  return `${base}${MAGPIE_HUB_MCP_PATH}${segment}`
}

/**
 * Build the entry handed to `ctx.mcpManager.register`. A Streamable HTTP server
 * with the gateway key as a Bearer header. The key is passed verbatim (no
 * `${credential:…}` template) and lives only in the manager's in-memory
 * registration — `list()` reports name/status, never the entry, so it is never
 * readable from a config document.
 * @returns the registration, or `null` when the endpoint cannot be dialled.
 */
export function buildHubRegistration(
  endpoint: EffectiveEndpoint,
  options: { toolCallTimeoutMs: number; startupTimeoutMs?: number; agent?: string },
): HubRegistration | null {
  const url = magpieHubMcpUrl(endpoint, options.agent ?? DEFAULT_MCP_AGENT)
  if (url === undefined) return null
  const key = endpoint.apiKey.trim()
  return {
    transport: 'streamable-http',
    url,
    ...(key === '' ? {} : { headers: { Authorization: `Bearer ${key}` } }),
    toolCallTimeoutMs: options.toolCallTimeoutMs,
    startupTimeoutMs: options.startupTimeoutMs ?? 30_000,
  }
}

/** A registered entry DSH's `ctx.mcpManager.register` accepts (Streamable HTTP). */
export interface HubRegistration {
  transport: 'streamable-http'
  url: string
  headers?: Record<string, string>
  toolCallTimeoutMs: number
  startupTimeoutMs: number
}

/**
 * Identity of one registration, for change detection. Rebuilding on every
 * reconcile would tear down and re-dial a healthy connection; comparing this
 * keeps an unchanged endpoint/key a no-op and only rebuilds when the URL or
 * the key actually moved. `undefined` means "nothing to register".
 */
export function hubFingerprint(registration: HubRegistration | null): string | undefined {
  if (registration === null) return undefined
  return `${registration.url}\u0000${registration.headers?.Authorization ?? ''}`
}

/**
 * Flatten one `ctx.mcpManager.list()` row's status — a union owned by
 * mcp-client/mcp-manager — into the small view the settings page renders.
 * Unknown shapes become `unknown` rather than a misleading "connected".
 */
export function toStatusView(status: unknown): McpServerStatusView {
  if (status === null || typeof status !== 'object') return { state: 'unknown' }
  const record = status as Record<string, unknown>
  const state = typeof record.state === 'string' ? record.state : ''
  const lastError = typeof record.lastError === 'string' ? record.lastError : undefined
  switch (state) {
    case 'connected':
      return {
        state: 'connected',
        ...(typeof record.toolCount === 'number' ? { toolCount: record.toolCount } : {}),
      }
    case 'connecting':
      return { state: 'connecting' }
    case 'reconnecting':
      return { state: 'reconnecting', ...(lastError !== undefined ? { lastError } : {}) }
    case 'waiting-credentials':
    case 'failed':
      return { state: 'failed', ...(lastError !== undefined ? { lastError } : {}) }
    case 'closed':
    case 'disabled':
      return { state: 'disabled' }
    default:
      return { state: 'unknown' }
  }
}

/** One probe's outcome: whether the hub answered, and what it listed. */
export interface HubProbeOutcome {
  ok: boolean
  /** Tools the hub listed (names, capped for display). */
  toolNames: string[]
  toolCount: number
  /**
   * True when the hub answered but reports it is switched off in Magpie
   * (its `instructions` carry the gateway's "hub is off" message) — reachable
   * but exposing no tools until the Library switch is turned on.
   */
  hubOff?: boolean
  /** The hub's `instructions` line (names the servers behind it), when it sent one. */
  instructions?: string
  /** Diagnostic text when the probe failed. */
  error?: string
}

/** JSON-RPC envelope the hub answers with (Streamable HTTP, plain JSON). */
interface McpJsonRpcReply {
  jsonrpc?: string
  id?: number | string | null
  result?: {
    instructions?: unknown
    serverInfo?: { name?: unknown; version?: unknown }
    tools?: Array<{ name?: unknown }>
    [key: string]: unknown
  }
  error?: { code?: unknown; message?: unknown }
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
export async function probeMagpieHub(
  endpoint: EffectiveEndpoint,
  options: { timeoutMs: number; fetchImpl?: typeof fetch; signal?: AbortSignal; agent?: string },
): Promise<HubProbeOutcome> {
  const registration = buildHubRegistration(endpoint, {
    toolCallTimeoutMs: options.timeoutMs,
    agent: options.agent ?? DEFAULT_MCP_AGENT,
  })
  if (registration === null) {
    return { ok: false, toolNames: [], toolCount: 0, error: 'endpoint is not configured' }
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs)])
    : AbortSignal.timeout(options.timeoutMs)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...(registration.headers ?? {}),
  }

  let sessionId: string | undefined
  const post = async (body: unknown): Promise<{ reply: McpJsonRpcReply; session?: string }> => {
    const response = await fetchImpl(registration.url, {
      method: 'POST',
      redirect: 'error',
      headers: { ...headers, ...(sessionId !== undefined ? { 'Mcp-Session-Id': sessionId } : {}) },
      body: JSON.stringify(body),
      signal,
    })
    const nextSession = response.headers.get('mcp-session-id') ?? undefined
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      const suffix = detail.trim() !== '' ? `: ${detail.trim().slice(0, 300)}` : ''
      const hint =
        response.status === 403
          ? ' (enable "Share on local network" in Magpie → Network and sharing, and check the key allows MCP)'
          : response.status === 404
            ? ' (the gateway or a reverse proxy does not expose /mcp/magpie/hub)'
            : ''
      throw new Error(`MCP hub HTTP ${response.status}${suffix}${hint}`)
    }
    const text = await response.text()
    // A notification is answered 202 with an empty body.
    if (text.trim() === '') return { reply: {}, session: nextSession }
    try {
      return { reply: JSON.parse(text) as McpJsonRpcReply, session: nextSession }
    } catch {
      throw new Error('MCP hub returned invalid JSON')
    }
  }

  try {
    const init = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'dsh-magpie-connect', version: '0' },
      },
    })
    sessionId = init.session
    if (init.reply.error !== undefined) {
      throw new Error(`initialize failed: ${String(init.reply.error.message ?? init.reply.error.code ?? 'unknown error')}`)
    }
    // Best-effort initialized notification; the hub keeps nothing by it.
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' }).catch(() => ({ reply: {} }))

    const listed = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    if (listed.reply.error !== undefined) {
      throw new Error(`tools/list failed: ${String(listed.reply.error.message ?? listed.reply.error.code ?? 'unknown error')}`)
    }
    const tools = Array.isArray(listed.reply.result?.tools) ? listed.reply.result?.tools ?? [] : []
    const toolNames = tools
      .map((tool) => (typeof tool?.name === 'string' ? tool.name : ''))
      .filter((name) => name !== '')
    const instructions =
      typeof init.reply.result?.instructions === 'string' ? init.reply.result.instructions : undefined
    // The gateway's "hub is off" message (gateway.errHubOff) is the one signal
    // that the hub is reachable but exposing nothing until the Library switch is on.
    const hubOff = instructions !== undefined && /MCP hub is off|hub is off/iu.test(instructions)
    return {
      ok: true,
      toolNames: toolNames.slice(0, 50),
      toolCount: toolNames.length,
      ...(hubOff ? { hubOff: true } : {}),
      ...(instructions !== undefined ? { instructions } : {}),
    }
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'TimeoutError'
        ? `probe timed out after ${options.timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error)
    return { ok: false, toolNames: [], toolCount: 0, error: message }
  }
}


/* ------------------------------------------------------------------ *
 * Bare Streamable-HTTP JSON-RPC transport (no session)
 * ------------------------------------------------------------------ */

/** One raw MCP tool as `tools/list` returns it. */
export interface RawMcpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
}

/** A normalized tool result: text projection plus whether the server flagged an error. */
export interface McpCallResult {
  text: string
  isError: boolean
}

/** Throw for any non-2xx or non-JSON reply, with a status-specific hint. */
async function postRpc(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, {
    method: 'POST',
    redirect: 'error',
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const suffix = detail.trim() !== '' ? `: ${detail.trim().slice(0, 300)}` : ''
    const hint =
      response.status === 403
        ? ' (enable "Share on local network" in Magpie → Network and sharing, and check the key allows MCP)'
        : response.status === 404
          ? ' (the gateway or a reverse proxy does not expose /mcp/magpie/hub)'
          : ''
    throw new Error(`MCP hub HTTP ${response.status}${suffix}${hint}`)
  }
  const text = await response.text()
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error('MCP hub returned invalid JSON')
  }
}

/** Join an MCP `content` array's text blocks, tolerating a plain string result. */
function textOf(result: Record<string, unknown> | undefined): string {
  if (result === undefined) return ''
  const content = result.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => (block !== null && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string' ? (block as { text: string }).text : ''))
    .filter((part) => part !== '')
    .join('\n')
}

/** Build request headers: JSON, the gateway key as Bearer, no event stream. */
export function hubHeaders(apiKey: string): Record<string, string> {
  const key = apiKey.trim()
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    ...(key === '' ? {} : { authorization: `Bearer ${key}` }),
  }
}

/**
 * List the hub's raw tools with a bare `tools/list` (no `initialize`, no
 * session — the gateway answers it and only hands out a session id when a
 * client initializes, which this path never needs). Used to size the tool set
 * and to expose it whole when it is small enough.
 * @param endpoint - effective endpoint (baseUrl + key); must be configured.
 */
export async function listHubTools(
  endpoint: EffectiveEndpoint,
  options: { timeoutMs: number; fetchImpl?: typeof fetch; agent?: string; signal?: AbortSignal },
): Promise<RawMcpTool[]> {
  const url = magpieHubMcpUrl(endpoint, options.agent ?? DEFAULT_MCP_AGENT)
  if (url === undefined) throw new Error('dsh-magpie-connect: endpoint is not configured')
  const fetchImpl = options.fetchImpl ?? fetch
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs)])
    : AbortSignal.timeout(options.timeoutMs)
  const reply = await postRpc(url, hubHeaders(endpoint.apiKey), { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, fetchImpl, signal)
  if (reply.error !== undefined) {
    const e = reply.error as { message?: unknown; code?: unknown }
    throw new Error(`tools/list failed: ${String(e.message ?? e.code ?? 'unknown error')}`)
  }
  const result = reply.result as { tools?: unknown } | undefined
  const tools = result !== undefined && Array.isArray(result.tools) ? (result.tools as Array<Record<string, unknown>>) : []
  return tools
    .filter((tool) => typeof tool?.name === 'string' && tool.name !== '')
    .map((tool) => ({
      name: tool.name as string,
      ...(typeof tool.description === 'string' ? { description: tool.description } : {}),
      ...(tool.inputSchema !== null && typeof tool.inputSchema === 'object' ? { inputSchema: tool.inputSchema as Record<string, unknown> } : {}),
      ...(tool.outputSchema !== null && typeof tool.outputSchema === 'object' ? { outputSchema: tool.outputSchema as Record<string, unknown> } : {}),
    }))
}

/**
 * Run one hub tool by its `<server>__<tool>` name with a bare `tools/call`.
 * The hub hands the call to the server behind it. An MCP `isError` result is
 * returned (not thrown) so the caller decides how to surface it.
 */
export async function callHubTool(
  endpoint: EffectiveEndpoint,
  name: string,
  args: unknown,
  options: { timeoutMs: number; fetchImpl?: typeof fetch; agent?: string; signal?: AbortSignal },
): Promise<McpCallResult> {
  const url = magpieHubMcpUrl(endpoint, options.agent ?? DEFAULT_MCP_AGENT)
  if (url === undefined) throw new Error('dsh-magpie-connect: endpoint is not configured')
  const fetchImpl = options.fetchImpl ?? fetch
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs)])
    : AbortSignal.timeout(options.timeoutMs)
  const reply = await postRpc(
    url,
    hubHeaders(endpoint.apiKey),
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args ?? {} } },
    fetchImpl,
    signal,
  )
  if (reply.error !== undefined) {
    const e = reply.error as { message?: unknown; code?: unknown }
    throw new Error(`tools/call failed: ${String(e.message ?? e.code ?? 'unknown error')}`)
  }
  const result = reply.result as Record<string, unknown> | undefined
  return { text: textOf(result), isError: result?.isError === true }
}

/**
 * The two on-demand proxy tools' hub names (the gateway's `hubFindTool` /
 * `hubCallTool`). A hub tool is `<server>__<tool>`, so neither collides with a
 * real tool's name.
 */
export const HUB_FIND_TOOL = 'find_tools'
export const HUB_CALL_TOOL = 'call_tool'

/** Above this many hub tools, expose `find_tools` + `call_tool` instead of every schema. */
export const MCP_ON_DEMAND_OVER = 10
