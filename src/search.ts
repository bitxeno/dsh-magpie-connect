import { isConfigured, type EffectiveEndpoint, type MagpieSearchMode } from './settings.ts'
import { deriveGatewayBase } from './trace.ts'

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
export const MAGPIE_SEARCH_MCP_PATH = '/mcp/magpie/web-search'

/** Anthropic Messages 搜索默认 `anthropic-version` 请求头。 */
export const DEFAULT_ANTHROPIC_VERSION = '2023-06-01'

/** Anthropic Messages 搜索默认最大生成 token 上限。 */
export const DEFAULT_SEARCH_MAX_TOKENS = 4096

/** Anthropic Messages 搜索默认每次请求最大 `web_search` 使用次数。 */
export const DEFAULT_SEARCH_MAX_USES = 5

/** 单次网页搜索请求默认超时（毫秒，与 Magpie 侧 `searchTimeout` 2 分钟一致）。 */
export const DEFAULT_SEARCH_TIMEOUT_MS = 120_000

/** MCP `web_search` 工具允许的结果数上限（与 Magpie `searchHitsMost` 一致）。 */
const MCP_SEARCH_MAX_COUNT = 20

/** 与 `MagpieAdapter` 保持一致的归因 User-Agent，便于 Magpie 识别为 DSH 请求。 */
const DSH_USER_AGENT = 'deepseek-harness/0.2.2-rc.1 (+https://github.com/deepseek-ai/deepseek-harness)'

/** 与 `@deepseek-ai/dsh-web/types` 结构兼容的搜索请求形状。 */
export interface WebSearchRequest {
  readonly query: string
  readonly maxResults?: number
  readonly llmProvider?: string
}

/** 与 `@deepseek-ai/dsh-web/types` 结构兼容的单条搜索来源。 */
export interface WebSearchSource {
  readonly url: string
  readonly title?: string
  readonly snippet?: string
  readonly summary?: string
  readonly publishedAt?: string
}

/** 与 `@deepseek-ai/dsh-web/types` 结构兼容的搜索结果。 */
export interface WebSearchResult {
  readonly content?: string
  readonly sources: readonly WebSearchSource[]
  readonly truncated: boolean
}

/** 与 `@deepseek-ai/dsh-web/types` 结构兼容的搜索提供方接口。 */
export interface WebSearchProvider {
  readonly id: string
  readonly title?: string
  readonly description?: Record<string, string> & { readonly en: string }
  available(): boolean
  ready?(llmProvider: string | undefined): Promise<boolean>
  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>
}

/** 单次搜索生效的运行时配置快照。 */
export interface EffectiveSearchConfig {
  readonly mode: MagpieSearchMode
  readonly model: string
  readonly maxUses: number
  readonly timeoutMs: number
}

/** 结合连接信息与搜索配置的完整运行时快照。 */
export interface SearchRuntimeSnapshot {
  readonly endpoint: EffectiveEndpoint
  readonly search: EffectiveSearchConfig
}

/** 与 DSH `WebError` 结构兼容的错误类型（携带可机读的 `code` 字段）。 */
export type MagpieSearchErrorCode =
  | 'WEB_ABORTED'
  | 'WEB_PROVIDER_CREDENTIAL_MISSING'
  | 'WEB_PROVIDER_ERROR'

export class MagpieSearchError extends Error {
  readonly code: MagpieSearchErrorCode

  constructor(message: string, code: MagpieSearchErrorCode, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'MagpieSearchError'
    this.code = code
  }
}

interface AnthropicSearchResultItem {
  type?: unknown
  url?: unknown
  title?: unknown
  page_age?: unknown
  snippet?: unknown
}

interface AnthropicCitation {
  url?: unknown
  cited_text?: unknown
}

interface AnthropicContentBlock {
  type?: unknown
  content?: unknown
  citations?: unknown
}

interface AnthropicMessagesResponse {
  content?: unknown
  error?: { message?: unknown } | string
  message?: unknown
}

interface McpJsonRpcResponse {
  result?: {
    content?: Array<{ type?: unknown; text?: unknown }>
    isError?: unknown
  }
  error?: {
    code?: unknown
    message?: unknown
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/** 去除裸 URL 末尾常见的中文/英文标点符号。 */
function cleanTrailingUrlPunctuation(raw: string): string {
  return raw.replace(/[.,;:!?)\]>'"`]+$/u, '')
}

/** 校验是否为合法的 http(s) URL。 */
function isHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** 从 Anthropic Messages 的 `text` 块 `citations[]` 提取 `url → cited_text` 映射。 */
function extractCitationSnippets(blocks: readonly AnthropicContentBlock[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const block of blocks) {
    if (block.type !== 'text' || !Array.isArray(block.citations)) continue
    for (const rawCite of block.citations as AnthropicCitation[]) {
      if (!rawCite || typeof rawCite !== 'object') continue
      const url = typeof rawCite.url === 'string' ? rawCite.url.trim() : ''
      const cited = typeof rawCite.cited_text === 'string' ? rawCite.cited_text.trim() : ''
      if (url !== '' && cited !== '' && !map.has(url)) {
        map.set(url, cited)
      }
    }
  }
  return map
}

/**
 * 将 Anthropic Messages API 搜索响应归一化为 DSH `WebSearchResult`。
 *
 * 与 DSH 官方 `web-search-deepseek` 保持同一解析约定：只消费结构化
 * `web_search_tool_result` 块中的 `web_search_result` 条目，缺失 `snippet`
 * 时回退到同 URL 的 `cited_text`，按 URL 去重；缺少结果块时抛错而不降级抓取正文。
 */
export function mapAnthropicSearchResponse(payload: unknown): WebSearchResult {
  if (!payload || typeof payload !== 'object') {
    throw new MagpieSearchError('Magpie returned a non-object Messages search response', 'WEB_PROVIDER_ERROR')
  }
  const response = payload as AnthropicMessagesResponse
  const blocks = Array.isArray(response.content) ? (response.content as AnthropicContentBlock[]) : []
  const resultBlocks = blocks.filter((block) => block && typeof block === 'object' && block.type === 'web_search_tool_result')
  if (resultBlocks.length === 0) {
    throw new MagpieSearchError(
      'Magpie returned no web_search_tool_result blocks; the selected search model may not have triggered web search',
      'WEB_PROVIDER_ERROR',
    )
  }

  const citations = extractCitationSnippets(blocks)
  const seen = new Set<string>()
  const sources: WebSearchSource[] = []
  for (const block of resultBlocks) {
    if (!Array.isArray(block.content)) continue
    for (const rawItem of block.content as AnthropicSearchResultItem[]) {
      if (!rawItem || typeof rawItem !== 'object') continue
      if (rawItem.type !== 'web_search_result') continue
      const url = typeof rawItem.url === 'string' ? rawItem.url.trim() : ''
      if (url === '' || seen.has(url)) continue
      seen.add(url)
      const title = typeof rawItem.title === 'string' && rawItem.title.trim() !== '' ? rawItem.title.trim() : undefined
      const ownSnippet = typeof rawItem.snippet === 'string' && rawItem.snippet.trim() !== '' ? rawItem.snippet.trim() : undefined
      const snippet = ownSnippet ?? citations.get(url)
      const publishedAt = typeof rawItem.page_age === 'string' && rawItem.page_age.trim() !== '' ? rawItem.page_age.trim() : undefined
      sources.push({
        url,
        ...(title !== undefined ? { title } : {}),
        ...(snippet !== undefined ? { snippet } : {}),
        ...(publishedAt !== undefined ? { publishedAt } : {}),
      })
    }
  }
  return { sources, truncated: false }
}

/** 编号搜索条目头：`1. Title — https://example.com`（Magpie `pagesSaid` 格式）。 */
const NUMBERED_ENTRY_RE = /^\d+\.\s+(?:(.+?)\s+[—–-]\s+)?(https?:\/\/\S+)\s*$/u

/** 无序来源行：`- Title — https://example.com`、`- [Title](https://...)` 或 `- https://...`。 */
const BULLET_DASH_RE = /^[-*]\s+(.+?)\s+[—–-]\s+(https?:\/\/\S+)\s*$/u
const BULLET_MD_RE = /^[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\s*$/u
const BULLET_URL_RE = /^[-*]\s+(https?:\/\/\S+)\s*$/u

/** 解析 `Sources:` 段落中的来源行。 */
function parseSourcesSection(section: string): WebSearchSource[] {
  const seen = new Set<string>()
  const sources: WebSearchSource[] = []
  for (const rawLine of section.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (line === '') continue
    let title: string | undefined
    let url: string | undefined
    const dash = BULLET_DASH_RE.exec(line)
    if (dash) {
      title = dash[1]?.trim()
      url = dash[2]?.trim()
    } else {
      const md = BULLET_MD_RE.exec(line)
      if (md) {
        title = md[1]?.trim()
        url = md[2]?.trim()
      } else {
        const bare = BULLET_URL_RE.exec(line)
        if (bare) url = bare[1]?.trim()
      }
    }
    if (url === undefined) continue
    url = cleanTrailingUrlPunctuation(url)
    if (!isHttpUrl(url) || seen.has(url)) continue
    seen.add(url)
    sources.push({
      url,
      ...(title !== undefined && title !== '' ? { title } : {}),
    })
  }
  return sources
}

/** 兜底提取纯文本中的 Markdown 链接与裸 URL。 */
function extractFallbackSources(text: string): WebSearchSource[] {
  const seen = new Set<string>()
  const sources: WebSearchSource[] = []
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gu
  for (const match of text.matchAll(mdRe)) {
    const title = match[1]?.trim()
    const url = cleanTrailingUrlPunctuation(match[2] ?? '')
    if (!isHttpUrl(url) || seen.has(url)) continue
    seen.add(url)
    sources.push({
      url,
      ...(title !== undefined && title !== '' ? { title } : {}),
    })
  }
  const urlRe = /https?:\/\/[^\s<>()]+/gu
  for (const match of text.matchAll(urlRe)) {
    const url = cleanTrailingUrlPunctuation(match[0])
    if (!isHttpUrl(url) || seen.has(url)) continue
    seen.add(url)
    sources.push({ url })
  }
  return sources
}

/**
 * 将 Magpie `/mcp/magpie/web-search` 返回的文本解析为结构化 `WebSearchResult`。
 *
 * 兼容 Magpie `webSearch()` 的两类标准输出：
 * 1. Search API / 计划自带搜索（`pagesSaid`）：编号列表 `1. 标题 — URL` + 摘要行；
 * 2. 代搜模型（`searchWith`）：回答正文 + `\n\nSources:\n- 标题 — URL`；
 * 3. 其他纯文本回答：保留正文为 `content`，并尽力提取链接作为 `sources`。
 */
export function parseMagpieMcpSearchText(raw: string): WebSearchResult {
  const text = raw.trim()
  if (text === '') return { sources: [], truncated: false }

  // 1) 优先识别 `pagesSaid` 编号条目格式
  const lines = text.split(/\r?\n/u)
  const numberedIndices: Array<{ index: number; title?: string; url: string }> = []
  for (let i = 0; i < lines.length; i++) {
    const match = NUMBERED_ENTRY_RE.exec(lines[i]?.trim() ?? '')
    if (!match) continue
    const url = cleanTrailingUrlPunctuation(match[2] ?? '')
    if (!isHttpUrl(url)) continue
    const title = match[1]?.trim()
    numberedIndices.push({ index: i, ...(title !== undefined && title !== '' ? { title } : {}), url })
  }
  if (numberedIndices.length > 0) {
    const preamble = lines.slice(0, numberedIndices[0]!.index).join('\n').trim()
    const seen = new Set<string>()
    const sources: WebSearchSource[] = []
    for (let i = 0; i < numberedIndices.length; i++) {
      const current = numberedIndices[i]!
      if (seen.has(current.url)) continue
      seen.add(current.url)
      const nextStart = numberedIndices[i + 1]?.index ?? lines.length
      const snippet = lines.slice(current.index + 1, nextStart).join('\n').trim()
      sources.push({
        url: current.url,
        ...(current.title !== undefined ? { title: current.title } : {}),
        ...(snippet !== '' ? { snippet } : {}),
      })
    }
    return {
      ...(preamble !== '' ? { content: preamble } : {}),
      sources,
      truncated: false,
    }
  }

  // 2) 识别代搜模型输出的 `Sources:` 段落
  const sourcesSplit = /(?:^|\r?\n)Sources:\r?\n/u.exec(text)
  if (sourcesSplit) {
    const content = text.slice(0, sourcesSplit.index).trim()
    const section = text.slice(sourcesSplit.index + sourcesSplit[0].length)
    const sources = parseSourcesSection(section)
    return {
      ...(content !== '' ? { content } : {}),
      sources,
      truncated: false,
    }
  }

  // 3) 兜底：保留原文并提取其中的链接
  return {
    content: text,
    sources: extractFallbackSources(text),
    truncated: false,
  }
}

/** 将外部 `AbortSignal` 与单次超时组合成受控信号，区分外部取消与内部超时。 */
function createRequestSignal(
  timeoutMs: number,
  external?: AbortSignal,
): { signal: AbortSignal; timedOut: () => boolean; cleanup: () => void } {
  const controller = new AbortController()
  let expired = false
  const onExternalAbort = (): void => controller.abort(external?.reason)
  if (external) {
    if (external.aborted) controller.abort(external.reason)
    else external.addEventListener('abort', onExternalAbort, { once: true })
  }
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          expired = true
          controller.abort(new Error(`Magpie web search timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      : undefined
  return {
    signal: controller.signal,
    timedOut: () => expired,
    cleanup: () => {
      if (timer !== undefined) clearTimeout(timer)
      external?.removeEventListener('abort', onExternalAbort)
    },
  }
}

/** 尝试从 JSON 错误响应中提取可读错误信息。 */
async function readHttpErrorDetail(response: Response): Promise<string> {
  let raw = ''
  try {
    raw = (await response.text()).trim()
  } catch {
    return ''
  }
  if (raw === '') return ''
  try {
    const parsed = JSON.parse(raw) as AnthropicMessagesResponse
    const detail =
      typeof parsed.error === 'string'
        ? parsed.error
        : typeof parsed.error?.message === 'string'
          ? parsed.error.message
          : typeof parsed.message === 'string'
            ? parsed.message
            : ''
    if (detail.trim() !== '') return detail.trim()
  } catch {
    // 非 JSON 文本响应直接截断返回
  }
  return raw.slice(0, 300)
}

/** 执行一次 MCP 模式的 Magpie 网页搜索。 */
export async function searchViaMagpieMcp(
  options: {
    baseUrl: string
    apiKey: string
    query: string
    maxResults?: number
    timeoutMs?: number
    fetchImpl?: typeof fetch
  },
  signal?: AbortSignal,
): Promise<WebSearchResult> {
  if (signal?.aborted) {
    throw new MagpieSearchError('Magpie web search aborted', 'WEB_ABORTED', { cause: signal.reason })
  }
  const gatewayBase = deriveGatewayBase(options.baseUrl)
  if (gatewayBase === undefined) {
    throw new MagpieSearchError(`Invalid Magpie baseUrl: ${options.baseUrl}`, 'WEB_PROVIDER_ERROR')
  }
  const endpoint = `${gatewayBase}${MAGPIE_SEARCH_MCP_PATH}`
  const count =
    options.maxResults !== undefined && isPositiveInteger(options.maxResults)
      ? Math.min(options.maxResults, MCP_SEARCH_MAX_COUNT)
      : undefined
  const rpcBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'web_search',
      arguments: {
        query: options.query,
        ...(count !== undefined ? { count } : {}),
      },
    },
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const guarded = createRequestSignal(options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS, signal)
  let response: Response
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': DSH_USER_AGENT,
      },
      body: JSON.stringify(rpcBody),
      signal: guarded.signal,
    })
  } catch (error) {
    if (signal?.aborted) {
      throw new MagpieSearchError('Magpie web search aborted', 'WEB_ABORTED', { cause: signal.reason ?? error })
    }
    if (guarded.timedOut() || isAbortError(error)) {
      throw new MagpieSearchError(
        `Magpie MCP search timed out after ${options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS}ms (${endpoint})`,
        'WEB_PROVIDER_ERROR',
        { cause: error },
      )
    }
    throw new MagpieSearchError(
      `Magpie MCP search request failed (${endpoint}): ${error instanceof Error ? error.message : String(error)}`,
      'WEB_PROVIDER_ERROR',
      { cause: error },
    )
  } finally {
    guarded.cleanup()
  }

  if (!response.ok) {
    const detail = await readHttpErrorDetail(response)
    const suffix = detail !== '' ? `: ${detail}` : ''
    const hint =
      response.status === 404
        ? ' (Magpie gateway or reverse proxy does not expose /mcp/magpie/web-search; try switching search mode to a specific Magpie model)'
        : response.status === 403
          ? ' (check Magpie "Share on local network" and gateway key permissions)'
          : ''
    throw new MagpieSearchError(
      `Magpie MCP search HTTP ${response.status}${suffix}${hint}`,
      'WEB_PROVIDER_ERROR',
    )
  }

  let payload: McpJsonRpcResponse
  try {
    payload = (await response.json()) as McpJsonRpcResponse
  } catch (error) {
    throw new MagpieSearchError(
      `Magpie MCP search returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      'WEB_PROVIDER_ERROR',
      { cause: error },
    )
  }

  if (payload.error) {
    const msg = typeof payload.error.message === 'string' && payload.error.message !== ''
      ? payload.error.message
      : `JSON-RPC error ${String(payload.error.code ?? 'unknown')}`
    throw new MagpieSearchError(`Magpie MCP search error: ${msg}`, 'WEB_PROVIDER_ERROR')
  }

  const textParts = Array.isArray(payload.result?.content)
    ? payload.result.content
        .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
        .map((item) => item.text as string)
    : []
  const combined = textParts.join('\n').trim()
  if (payload.result?.isError === true) {
    throw new MagpieSearchError(combined !== '' ? combined : 'Magpie MCP web_search tool returned an error', 'WEB_PROVIDER_ERROR')
  }
  return parseMagpieMcpSearchText(combined)
}

/** 执行一次 Anthropic Messages 模式的 Magpie 指定模型搜索。 */
export async function searchViaMagpieModel(
  options: {
    baseUrl: string
    apiKey: string
    model: string
    query: string
    maxUses?: number
    maxTokens?: number
    apiVersion?: string
    timeoutMs?: number
    fetchImpl?: typeof fetch
  },
  signal?: AbortSignal,
): Promise<WebSearchResult> {
  if (signal?.aborted) {
    throw new MagpieSearchError('Magpie web search aborted', 'WEB_ABORTED', { cause: signal.reason })
  }
  const model = options.model.trim()
  if (model === '') {
    throw new MagpieSearchError(
      'Magpie model search requires a search model — select one on Settings → Magpie',
      'WEB_PROVIDER_ERROR',
    )
  }
  const endpoint = `${options.baseUrl.replace(/\/+$/, '')}/messages`
  const maxUses = options.maxUses ?? DEFAULT_SEARCH_MAX_USES
  const maxTokens = options.maxTokens ?? DEFAULT_SEARCH_MAX_TOKENS
  const apiVersion = options.apiVersion ?? DEFAULT_ANTHROPIC_VERSION
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: `Perform a web search for the query: ${options.query}` }],
      },
    ],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses }],
    thinking: { type: 'disabled' },
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const guarded = createRequestSignal(options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS, signal)
  let response: Response
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'x-api-key': options.apiKey,
        'anthropic-version': apiVersion,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': DSH_USER_AGENT,
      },
      body: JSON.stringify(body),
      signal: guarded.signal,
    })
  } catch (error) {
    if (signal?.aborted) {
      throw new MagpieSearchError('Magpie web search aborted', 'WEB_ABORTED', { cause: signal.reason ?? error })
    }
    if (guarded.timedOut() || isAbortError(error)) {
      throw new MagpieSearchError(
        `Magpie model search timed out after ${options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS}ms (${endpoint})`,
        'WEB_PROVIDER_ERROR',
        { cause: error },
      )
    }
    throw new MagpieSearchError(
      `Magpie model search request failed (${endpoint}): ${error instanceof Error ? error.message : String(error)}`,
      'WEB_PROVIDER_ERROR',
      { cause: error },
    )
  } finally {
    guarded.cleanup()
  }

  if (!response.ok) {
    const detail = await readHttpErrorDetail(response)
    const suffix = detail !== '' ? `: ${detail}` : ''
    throw new MagpieSearchError(
      `Magpie model search HTTP ${response.status}${suffix} (${endpoint}, model=${model})`,
      'WEB_PROVIDER_ERROR',
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new MagpieSearchError(
      `Magpie model search returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      'WEB_PROVIDER_ERROR',
      { cause: error },
    )
  }
  return mapAnthropicSearchResponse(payload)
}

/**
 * 注册到 DSH `ctx.web` 的 Magpie 搜索提供方。
 *
 * 每次操作均从 `resolveSnapshot()` 捕获一份原子快照，保证设置页修改后立即生效
 * 且不会在单次请求中混用新旧配置。
 */
export class MagpieSearchProvider implements WebSearchProvider {
  readonly id: string
  readonly title: string
  readonly description = {
    en: 'Search the web through the Magpie gateway (follows Magpie’s own search settings by default, or a selected Magpie model). Configure on the Magpie settings page.',
    zh: '通过 Magpie 网关执行网页搜索（默认沿用 Magpie 自身的代搜模型或 Search API 配置，也可指定 Magpie 模型）。在「Magpie 网关」设置页中配置。',
  } as const

  readonly #resolveSnapshot: () => SearchRuntimeSnapshot
  readonly #fetchImpl: typeof fetch

  constructor(options: {
    id: string
    title?: string
    resolveSnapshot: () => SearchRuntimeSnapshot
    fetchImpl?: typeof fetch
  }) {
    this.id = options.id
    this.title = options.title ?? 'Magpie'
    this.#resolveSnapshot = options.resolveSnapshot
    this.#fetchImpl = options.fetchImpl ?? fetch
  }

  /**
   * 同步结构可用性检查：仅校验地址和数值参数是否合法，不检查凭据是否已填。
   * 凭据与模型完备性交由 `ready()` 决定，以便未配置完成时 `dsh-tool-web`
   * 优雅撤下 `web_search` 而不是报 `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`。
   */
  available(): boolean {
    const { endpoint, search } = this.#resolveSnapshot()
    if (!isHttpUrl(endpoint.baseUrl)) return false
    if (search.mode === 'mcp') return deriveGatewayBase(endpoint.baseUrl) !== undefined
    return isPositiveInteger(search.maxUses)
  }

  /** 异步就绪检查：必须具备网关地址、API Key，且 model 模式下必须已指定模型。 */
  async ready(): Promise<boolean> {
    const { endpoint, search } = this.#resolveSnapshot()
    if (!isConfigured(endpoint) || !isHttpUrl(endpoint.baseUrl)) return false
    if (search.mode === 'mcp') return deriveGatewayBase(endpoint.baseUrl) !== undefined
    return search.model.trim() !== '' && isPositiveInteger(search.maxUses)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const { endpoint, search } = this.#resolveSnapshot()
    if (!isConfigured(endpoint)) {
      throw new MagpieSearchError(
        'Magpie gateway API URL or API key is not configured — fill in both on Settings → Magpie',
        'WEB_PROVIDER_CREDENTIAL_MISSING',
      )
    }
    const query = request.query.trim()
    if (query === '') {
      throw new MagpieSearchError('Magpie web search query must not be empty', 'WEB_PROVIDER_ERROR')
    }
    if (search.mode === 'mcp') {
      return await searchViaMagpieMcp(
        {
          baseUrl: endpoint.baseUrl,
          apiKey: endpoint.apiKey,
          query,
          ...(request.maxResults !== undefined ? { maxResults: request.maxResults } : {}),
          timeoutMs: search.timeoutMs,
          fetchImpl: this.#fetchImpl,
        },
        signal,
      )
    }
    return await searchViaMagpieModel(
      {
        baseUrl: endpoint.baseUrl,
        apiKey: endpoint.apiKey,
        model: search.model,
        query,
        maxUses: search.maxUses,
        timeoutMs: search.timeoutMs,
        fetchImpl: this.#fetchImpl,
      },
      signal,
    )
  }
}
