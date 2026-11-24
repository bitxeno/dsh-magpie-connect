/**
 * DSH tool definitions for the Magpie MCP hub, with client-side on-demand.
 *
 * Magpie's own "Tools on demand" only engages for a *named* Library agent with
 * >10 tools — and the Library only lists agents detected on the machine Magpie
 * runs on. When Magpie is a router and DSH is elsewhere, that never triggers.
 * So this module reproduces the same rule on the DSH side: list the hub's tools
 * over a bare `tools/list`, and
 *
 *   - **≤ 10 tools** → register each as `mcp__magpie__<server>__<tool>` (direct);
 *   - **> 10 tools** → register only two proxies, `mcp__magpie__find_tools` and
 *     `mcp__magpie__call_tool`, which forward to the hub's own `find_tools` /
 *     `call_tool`. Every schema stays out of the request; the model searches
 *     then runs, exactly like Magpie's on-demand pair.
 *
 * Both modes forward every call to the hub over a bare `tools/call` (no MCP
 * session), so the gateway key stays on the Host and a server added on the
 * gateway is reachable through `find_tools`/`call_tool` without re-registering.
 */
import { createHash } from 'node:crypto'
import {
  HUB_CALL_TOOL,
  HUB_FIND_TOOL,
  MCP_ON_DEMAND_OVER,
  callHubTool,
  type RawMcpTool,
} from './mcp.ts'
import type { EffectiveEndpoint } from './settings.ts'

/** Public tool-name prefix every Magpie hub tool carries. */
export const MCP_TOOL_PREFIX = 'mcp__magpie__'

/** Model-facing function-name budget (OpenAI-compatible providers cap at 64). */
const MAX_TOOL_NAME = 64

/**
 * Turn a hub tool name (`<server>__<tool>`) into a safe model-facing name.
 * Non-word characters become `-`; an over-long name is truncated and given a
 * short content hash so two long names never collapse onto one. The hub name
 * itself is kept separately for the actual call.
 */
export function publicToolName(hubName: string): string {
  const base = `${MCP_TOOL_PREFIX}${hubName}`
  const safe = base.replace(/[^A-Za-z0-9_-]/gu, '-')
  if (safe.length <= MAX_TOOL_NAME) return safe
  const hash = createHash('sha256').update(base).digest('hex').slice(0, 12)
  return `${safe.slice(0, MAX_TOOL_NAME - hash.length - 1)}_${hash}`
}

/** The slice of DSH's `ctx.tools` this module drives. */
export interface DshToolService {
  register(definition: DshToolDefinition): () => void
}

/** A content block DSH's tool output renders. */
type TextBlock = { type: 'text'; text: string }

/**
 * The structural shape of a DSH ToolDefinition this module builds. Kept local
 * (no `@deepseek-ai/*` import) so the plugin stays independent of the exact
 * host version; the fields mirror `@deepseek-ai/dsh-tools`'s contract.
 */
export interface DshToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  timeoutMs?: number
  output: {
    schema: Record<string, unknown>
    render(args: unknown, value: unknown): TextBlock[]
  }
  execute(args: unknown, exec: { signal?: AbortSignal }): Promise<unknown>
}

/** The canonical output contract shared by every Magpie tool: one text block. */
function textOutput(): DshToolDefinition['output'] {
  return {
    schema: {
      type: 'object',
      properties: { content: { type: 'array', items: {} } },
      required: ['content'],
      additionalProperties: false,
    },
    render(_args: unknown, value: unknown) {
      const record = value !== null && typeof value === 'object' ? (value as { content?: unknown }) : {}
      const content = Array.isArray(record.content) ? record.content : []
      const text = content
        .map((block) => (block !== null && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string' ? (block as { text: string }).text : ''))
        .join('\n')
      return [{ type: 'text', text }]
    },
  }
}

/** Options shared by every definition: live endpoint, timeout, agent. */
export interface HubToolOptions {
  /** Resolved on each call so a rotated key/origin applies without re-registering. */
  getEndpoint: () => EffectiveEndpoint
  toolCallTimeoutMs: number
  agent: string
}

/** Wrap one hub tool call into a DSH result, throwing on an MCP error result. */
async function runHubTool(
  options: HubToolOptions,
  hubName: string,
  args: unknown,
  exec: { signal?: AbortSignal },
): Promise<unknown> {
  const result = await callHubTool(options.getEndpoint(), hubName, args, {
    timeoutMs: options.toolCallTimeoutMs,
    agent: options.agent,
    ...(exec.signal !== undefined ? { signal: exec.signal } : {}),
  })
  // An MCP isError becomes a thrown error so DSH records the call as failed and
  // shows the server's message rather than a fake success.
  if (result.isError) throw new Error(result.text !== '' ? result.text : `${hubName} returned an error`)
  return { content: [{ type: 'text', text: result.text }] }
}

/** Direct definition for one hub tool: `mcp__magpie__<server>__<tool>`. */
export function directToolDefinition(tool: RawMcpTool, options: HubToolOptions): DshToolDefinition {
  return {
    name: publicToolName(tool.name),
    description: tool.description ?? `Magpie tool ${tool.name}`,
    parameters: tool.inputSchema ?? { type: 'object', properties: {} },
    timeoutMs: options.toolCallTimeoutMs,
    output: textOutput(),
    execute: (args, exec) => runHubTool(options, tool.name, args, exec),
  }
}

/** How many characters of the server/tool catalog `find_tools`' description carries. */
export const FIND_CATALOG_MAX = 1200

/** One hub server and its tool names, in first-seen order. */
interface ServerGroup {
  server: string
  tools: string[]
}

/** Group `<server>__<tool>` names into their servers, keeping discovery order. */
export function groupHubTools(tools: readonly RawMcpTool[]): ServerGroup[] {
  const groups = new Map<string, string[]>()
  for (const tool of tools) {
    const at = tool.name.indexOf('__')
    const server = at > 0 ? tool.name.slice(0, at) : ''
    const name = at > 0 ? tool.name.slice(at + 2) : tool.name
    if (name === '') continue
    const key = server === '' ? '(other)' : server
    groups.set(key, [...(groups.get(key) ?? []), name])
  }
  return [...groups].map(([server, names]) => ({ server, tools: names }))
}

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
export function buildToolCatalog(tools: readonly RawMcpTool[], maxChars = FIND_CATALOG_MAX): string {
  const groups = groupHubTools(tools)
  if (groups.length === 0) return ''
  const total = groups.reduce((sum, group) => sum + group.tools.length, 0)
  const heading =
    `Servers behind this hub (${groups.length}) with ${total} tools in total: ` +
    groups.map((group) => `${group.server} (${group.tools.length})`).join(', ') +
    '.'
  let left = maxChars - heading.length - 1
  if (left <= 0) return heading

  // Shortest first, so the smallest servers get their full list before a huge
  // one eats the remaining budget (Magpie's hubDetails balances the same way).
  const order = [...groups.keys()].sort((a, b) => groups[a]!.tools.length - groups[b]!.tools.length)
  const lines = new Array<string>(groups.length).fill('')
  order.forEach((index, position) => {
    const group = groups[index]!
    const share = Math.max(24, Math.floor(left / (order.length - position)) - 1)
    const prefix = `- ${group.server}: `
    const shown: string[] = []
    let used = prefix.length
    for (const name of group.tools) {
      const piece = (shown.length === 0 ? '' : ', ') + name
      if (used + piece.length > share) break
      shown.push(name)
      used += piece.length
    }
    if (shown.length === 0) {
      // Not even one name fits: at least say how many there are.
      lines[index] = `${prefix}${group.tools.length} tools`
    } else {
      const rest = group.tools.length - shown.length
      lines[index] = `${prefix}${shown.join(', ')}${rest > 0 ? ` (+${rest} more)` : ''}`
    }
    left -= lines[index]!.length + 1
  })
  return [heading, ...lines.filter((line) => line !== '')].join('\n')
}

/**
 * The on-demand `find_tools` proxy: search the hub's tools, get their schemas.
 *
 * The description carries the server/tool catalog (see {@link buildToolCatalog}):
 * in on-demand mode this text is the model's only evidence of what the hub can
 * do, so it must name the servers rather than merely explain how to search.
 * @param options - live endpoint and budgets.
 * @param tools - the hub's current tools, catalogued into the description.
 */
export function findToolsDefinition(options: HubToolOptions, tools: readonly RawMcpTool[] = []): DshToolDefinition {
  const catalog = buildToolCatalog(tools)
  const how =
    'Find the tools of the Magpie MCP hub that match a query. Give words of what you want done, or a tool name; an empty query lists every tool. Each match comes back with its description and parameters (inputSchema) — run one with ' +
    `${MCP_TOOL_PREFIX}${HUB_CALL_TOOL}.`
  return {
    name: `${MCP_TOOL_PREFIX}${HUB_FIND_TOOL}`,
    description: catalog === '' ? how : `${catalog}\n${how}`,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "Words of what you want done, or a tool's name; empty lists every tool" },
        server: { type: 'string', description: "Only this server's tools" },
      },
      additionalProperties: false,
    },
    timeoutMs: options.toolCallTimeoutMs,
    output: textOutput(),
    execute: (args, exec) => runHubTool(options, HUB_FIND_TOOL, args, exec),
  }
}

/** The on-demand `call_tool` proxy: run one hub tool by its `<server>__<tool>` name. */
export function callToolDefinition(options: HubToolOptions): DshToolDefinition {
  return {
    name: `${MCP_TOOL_PREFIX}${HUB_CALL_TOOL}`,
    description:
      'Run a tool of the Magpie MCP hub by its <server>__<tool> name, with arguments as its inputSchema says. ' +
      `If you do not know the exact name, call ${MCP_TOOL_PREFIX}${HUB_FIND_TOOL} first — it returns matching tools with their names, descriptions and parameters.`,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "The tool's name, <server>__<tool>" },
        arguments: { type: 'object', description: "The tool's arguments, as its inputSchema says" },
      },
      required: ['name'],
      additionalProperties: false,
    },
    timeoutMs: options.toolCallTimeoutMs,
    output: textOutput(),
    execute: (args, exec) => runHubTool(options, HUB_CALL_TOOL, args, exec),
  }
}

/** Which tools the current hub set exposes. */
export type McpToolMode = 'direct' | 'on-demand' | 'passthrough'

/**
 * Whether a `tools/list` result is Magpie's *own* on-demand pair.
 *
 * When a named agent has more than 10 tools and Magpie's "Tools on demand" is
 * on, the gateway answers `tools/list` with exactly `find_tools` and
 * `call_tool` (`hubOnDemandSpecs`) instead of every schema. That is the same
 * pair this plugin builds, so a local gateway can simply be passed through:
 * registering its two definitions keeps Magpie's own descriptions — including
 * the server catalog it puts in `find_tools` — instead of duplicating them.
 */
export function isHubOnDemandPair(tools: readonly RawMcpTool[]): boolean {
  if (tools.length !== 2) return false
  const names = new Set(tools.map((tool) => tool.name))
  return names.has(HUB_FIND_TOOL) && names.has(HUB_CALL_TOOL)
}

/**
 * Decide how to expose one `tools/list` result.
 *
 * - `passthrough` — the gateway already answered with its on-demand pair (a
 *   local agent address past 10 tools): register its two definitions as they
 *   are, so Magpie's catalog reaches the model unchanged.
 * - `on-demand` — the gateway listed everything and there are more than
 *   `MCP_ON_DEMAND_OVER` tools: build the pair here, keeping every schema out
 *   of the request. This is what a remote gateway needs, since its agent
 *   address never lists DSH.
 * - `direct` — small enough that registering each tool costs less than a
 *   search before every call.
 * @param tools - the hub's `tools/list` result.
 */
export function toolModeFor(tools: readonly RawMcpTool[]): McpToolMode {
  if (isHubOnDemandPair(tools)) return 'passthrough'
  return tools.length > MCP_ON_DEMAND_OVER ? 'on-demand' : 'direct'
}

/**
 * Registers a tool set on `ctx.tools` and swaps it atomically: `apply` unregisters
 * the previous generation before registering the next, so the model never sees a
 * half-swapped set. Every disposer is tracked so disposal unwinds them all.
 */
export class MagpieToolRegistrar {
  #tools: DshToolService
  #options: HubToolOptions
  #disposers: Array<() => void> = []
  #mode: McpToolMode = 'direct'
  #toolCount = 0
  #disposed = false

  constructor(tools: DshToolService, options: HubToolOptions) {
    this.#tools = tools
    this.#options = options
  }

  /** Current exposure: how many hub tools exist, the mode, and how many DSH tools are registered. */
  state(): { mode: McpToolMode; hubToolCount: number; registeredCount: number } {
    return { mode: this.#mode, hubToolCount: this.#toolCount, registeredCount: this.#disposers.length }
  }

  /** Register the hub's tools in the mode its count selects. Replaces any previous set. */
  apply(tools: RawMcpTool[]): void {
    if (this.#disposed) return
    this.unregister()
    this.#toolCount = tools.length
    this.#mode = toolModeFor(tools)
    const definitions =
      this.#mode === 'passthrough'
        ? // Magpie already answered with its own find_tools/call_tool: keep its
          // definitions verbatim, catalog included.
          tools.map((tool) => directToolDefinition(tool, this.#options))
        : this.#mode === 'on-demand'
          ? [findToolsDefinition(this.#options, tools), callToolDefinition(this.#options)]
          : tools.map((tool) => directToolDefinition(tool, this.#options))
    for (const definition of definitions) {
      try {
        this.#disposers.push(this.#tools.register(definition))
      } catch {
        // A name collision with another plugin's tool must not abort the rest.
      }
    }
  }

  /** Unregister every tool this registrar registered. Idempotent. */
  unregister(): void {
    for (const dispose of this.#disposers) {
      try {
        dispose()
      } catch {
        // disposal is best-effort
      }
    }
    this.#disposers = []
  }

  /** Release everything and refuse further registration. */
  dispose(): void {
    this.#disposed = true
    this.unregister()
  }
}
