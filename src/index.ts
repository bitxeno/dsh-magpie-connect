import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'

import {
  ModelCatalog,
  defaultCachePath,
  fetchMagpieModels,
  type CatalogSnapshot,
  type MagpieModelEntry,
} from './adapter/catalog.ts'
import { legacyDataDir } from './homeDir.ts'
import { MagpieAdapter } from './adapter/magpie-adapter.ts'
import type { AttachmentStore } from './adapter/messages.ts'
import { resolveConfig, type DshMagpieConnectConfig } from './config.ts'
import { deriveGatewayBase, fetchTraceView, fetchWebIcon, TRACE_TIMEOUT_MS } from './trace.ts'
import {
  MagpieSearchProvider,
  type SearchRuntimeSnapshot,
  type WebSearchProvider,
} from './search.ts'
import {
  SettingsStore,
  defaultSettingsPath,
  isConfigured,
  normalizeBaseUrl,
  normalizePageSettings,
  normalizeSearchMaxUses,
  normalizeSearchMode,
  resolveEffectiveEndpoint,
  resolveEffectiveSearchSettings,
  type EffectiveSearchSettings,
  type MagpieSettingsView,
  type McpServerStatusView,
} from './settings.ts'
import {
  DEFAULT_MCP_AGENT,
  MCP_ON_DEMAND_OVER,
  buildHubRegistration,
  hubFingerprint,
  isLocalGateway,
  listHubTools,
  resolveHubAgent,
  normalizeMcpAgent,
  probeMagpieHub,
  toStatusView,
  type HubRegistration,
  type RawMcpTool,
} from './mcp.ts'
import { MagpieToolRegistrar, type DshToolService } from './mcp-tools.ts'

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

// Minimal structural typing against the host ctx; keeps the plugin independent
// of the exact @deepseek-ai/cordis version DSH ships.
export interface PluginContext {
  logger: { info(...args: unknown[]): void; warn(...args: unknown[]): void; error(...args: unknown[]): void }
  llm?: { registerAdapter(providers: string[], adapter: unknown): unknown }
  get?(key: string): unknown
  inject?(deps: string[], fn: (ctx: Record<string, unknown>) => unknown): unknown
  effect?(fn: () => () => void): unknown
  on?(event: string, listener: (...args: never[]) => unknown): () => void
  /**
   * Cordis `ctx.emit` (mixed in from the events service). Used to publish
   * `llm/adapters-updated` when this plugin's own catalog moves, without
   * touching the adapter registry.
   */
  emit?(event: string, ...args: unknown[]): unknown
}

export const name = 'dsh-magpie-connect'
export const inject = ['llm'] as const

/** Browser-facing REST root for the settings page (served under the shared /api channel). */
export const SETTINGS_API = '/api/magpie-settings'
export const MODELS_API = '/api/magpie-models'
export const TEST_API = '/api/magpie-test'
/**
 * Candidate discovery: asks the endpoint the form currently shows (including a
 * key typed but not yet saved) what it serves. The reply is candidates the
 * user picks from — never configuration written behind them.
 */
export const DISCOVER_API = '/api/magpie-discover'
/**
 * Routing-trace read for the composer button's popover (`/api/magpie-trace`).
 * The host reads the gateway's quotas (`/v1/magpie/quotas`) with the stored
 * key and serves the compressed view — the browser never sees the key nor
 * talks to the gateway cross-origin.
 */
export const TRACE_API = '/api/magpie-trace'
/** Same-origin proxy for Magpie Web provider icons; the Web Key stays on the Host. */
export const ICON_API = '/api/magpie-icon'
/** 设置页网页搜索测试路由（在 Host 侧使用当前表单或已保存凭据执行一次试探搜索）。 */
export const SEARCH_TEST_API = '/api/magpie-search-test'
/**
 * 设置页 MCP Hub 测试路由：在 Host 侧用当前表单或已保存凭据直接对
 * `/mcp/magpie/hub` 做一次 initialize + tools/list 探测，不注册任何实例。
 */
export const MCP_TEST_API = '/api/magpie-mcp-test'

/**
 * How long a settings save waits for the catalog re-read it triggered.
 *
 * The page re-reads rows right after the response, so the save must not answer
 * before a fast gateway has been read; but the credential write is already
 * durable, so a slow gateway must not hold the request open either.
 */
const SAVE_REFRESH_WAIT_MS = 5000

/** 设置页「测试搜索」按钮的上限超时（需低于浏览器 30s 请求上限，确保返回明确错误）。 */
const SEARCH_TEST_TIMEOUT_MS = 25_000

/** 设置页「测试 MCP」按钮的上限超时（同样低于浏览器 30s 上限）。 */
const MCP_TEST_TIMEOUT_MS = 20_000

/** DSH `web` 服务与本插件搜索提供方的绑定状态。 */
export interface WebSearchBindingState {
  registered: boolean
  switchable: boolean
  active: boolean
  activeProvider?: string
}

/** Backend generation behind the shared settings routes (newest wins). */
export interface SettingsBackend {
  store: SettingsStore
  catalog: ModelCatalog
  patchEndpoint: { baseUrl: string; apiKey: string }
  patchSearch: EffectiveSearchSettings
  searchTimeoutMs: number
  providerId: string
  /** Hub agent segment for the MCP test route ('' = all-apps). */
  mcpAgent: string
  effective: () => { baseUrl: string; apiKey: string }
  effectiveSearch: () => EffectiveSearchSettings
  applyPageSettings: () => void
  readWebSearchState: () => WebSearchBindingState
  setWebSearchActive: (active: boolean) => Promise<void>
  restoreWebSearchProvider: (provider: string | undefined) => Promise<void>
  readMcpState: () => McpBindingState
  /** Re-align the MCP tool set now (awaits the tools/list). */
  reconcileMcp: () => Promise<void>
}

/** Magpie MCP 工具集在 DSH 中的绑定状态。 */
export interface McpBindingState {
  /** 当前环境是否加载了 `ctx.tools`（可注册工具）。 */
  available: boolean
  /** 是否已注册至少一个 Magpie 工具（已勾选、已配置且已拉到工具清单）。 */
  registered: boolean
  /** 当前暴露方式：直连、插件按需，或透传 Magpie 自己的按需对。 */
  mode?: 'direct' | 'on-demand' | 'passthrough'
  /** 实际使用的 Hub 地址：`agent`（本地，Magpie 按需）或 `all`（全应用）。 */
  address?: 'agent' | 'all'
  /** Hub 当前列出的工具数（决定是否进入按需模式）。 */
  hubToolCount?: number
  /** 已注册到 DSH 的工具数（按需模式下为 2）。 */
  registeredCount?: number
  /** 当前连接状态（未注册时省略）。 */
  status?: McpServerStatusView
}

type FetchRegister = (route: {
  path: string
  methods: string[]
  requestBody: string
  fetch: (request: Request) => Promise<Response>
}) => () => void | Promise<void>

interface ModelRow {
  /** Route id, used by the allowlist, requests and session history. */
  id: string
  /** `<group>/<display_name>` label the settings list and picker show. */
  displayName: string
  contextWindow?: number
  maxTokens?: number
  image: boolean
  responsesOnly: boolean
  reasoning: boolean
  efforts: string[]
  /** Whether the allowlist currently offers this model in the picker. */
  enabled: boolean
  /**
   * What lists this id right now: `'gateway'` (the live directory), `'static'`
   * (only the built-in snapshot) or `'none'` (nothing does — a hidden id the
   * gateway has dropped). The page labels the last two so a stale row cannot be
   * mistaken for a model the gateway still serves. Candidates from the discover
   * route leave it unset: they come from the gateway by construction.
   */
  source?: 'gateway' | 'static' | 'none'
}

/** One discovered candidate: a {@link ModelRow} without this plugin's own allowlist flag. */
export type CandidateRow = Omit<ModelRow, 'enabled'>

/** True when the endpoints advertise responses but not chat completions. */
function responsesOnlyFor(nativeEndpoints: readonly string[]): boolean {
  if (nativeEndpoints.length === 0) return false
  const hasCompletions = nativeEndpoints.some((endpoint) => endpoint.includes('/chat/completions'))
  return !hasCompletions && nativeEndpoints.some((endpoint) => endpoint.includes('/responses'))
}

/**
 * Both model lists are sorted by the label the user sees. Grouping models by
 * `<group>/<display_name>` keeps one gateway lane's models together; the id is a
 * tie-break so two models with the same label still have a stable order.
 */
function compareModelRows(left: CandidateRow, right: CandidateRow): number {
  return left.displayName.localeCompare(right.displayName, 'zh') || left.id.localeCompare(right.id)
}

/** Project one catalog entry (or a bare id) into the wire row the page renders. */
function toRow(id: string, entry: MagpieModelEntry | undefined): CandidateRow {
  return {
    id,
    displayName: entry?.displayName ?? id,
    ...(entry?.contextWindow !== undefined ? { contextWindow: entry.contextWindow } : {}),
    ...(entry?.maxTokens !== undefined ? { maxTokens: entry.maxTokens } : {}),
    image: entry?.image ?? false,
    responsesOnly: responsesOnlyFor(entry?.nativeEndpoints ?? []),
    reasoning: entry?.reasoning ?? false,
    efforts: entry?.efforts ?? [],
  }
}

let currentBackend: SettingsBackend | null = null
let liveRouteSets = 0
let routeDisposers: Array<() => void | Promise<void>> | null = null

/** 重叠热重载期间等待接管 `ctx.web` 注册权的同 id 后续代条目。 */
interface PendingSearchWaiter {
  tryTakeover: () => boolean
  onLost: () => void
}

/** 当前由本插件活跃实例占用的 `ctx.web` 搜索提供方 id，用于区分同插件旧代与外部插件冲突。 */
const ownedSearchProviders = new Set<string>()
const pendingSearchRegistrations = new Map<string, PendingSearchWaiter[]>()

/** @internal 测试辅助钩子：重置搜索提供方占位记录与等待接管队列。 */
export function __resetSearchProviders(): void {
  ownedSearchProviders.clear()
  pendingSearchRegistrations.clear()
}

/** @internal Test hook: forget installed routes so the next apply reinstalls. */
export function __resetSettingsRoutes(): void {
  currentBackend = null
  liveRouteSets = 0
  routeDisposers = null
  ownedSearchProviders.clear()
  pendingSearchRegistrations.clear()
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

const routeOk = (value: unknown): Response => jsonResponse(200, { ok: true, value })
const routeFail = (error: unknown): Response =>
  jsonResponse(500, { ok: false, error: error instanceof Error ? error.message : String(error) })

async function readRouteBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

/**
 * The rows the settings page renders.
 *
 * One row per id the gateway directory holds, each flagged with whether the
 * allowlist offers it. Unlike the old blacklist shape there are no extra rows
 * for ids outside the directory: an allowlist entry the gateway no longer
 * serves is simply not a model any more, and surfacing it would offer the user
 * a checkbox that can never take effect.
 */
function buildModelRows(backend: SettingsBackend): ModelRow[] {
  const { store, catalog } = backend
  const allowlist = store.get().enabledModels
  const allowed = allowlist === undefined ? undefined : new Set(allowlist)
  return catalog.directory()
    .map((id) => ({
      ...toRow(id, catalog.getEntry(id)),
      enabled: allowed === undefined || allowed.has(id),
      source: catalog.sourceFor(id),
    }))
    .sort(compareModelRows)
}

function backendOrThrow(): SettingsBackend {
  if (!currentBackend) throw new Error('dsh-magpie-connect: settings backend not ready')
  return currentBackend
}

/**
 * One registered route: the connection registry keys routes by PATH and
 * rejects a second registration of the same path, so every method of one
 * endpoint must share a single entry and dispatch inside its handler. Two
 * entries on `SETTINGS_API` (GET + POST) silently lose the second one — the
 * save button then answers `404 not found` forever.
 */
interface RouteDefinition {
  path: string
  methods: string[]
  requestBody: string
  fetch: (request: Request) => Promise<Response>
}

/**
 * The only settings shape the browser may see. The credential is represented
 * by its presence, never by its value; `fromPage`/`fromPatch` are gone for the
 * same reason — both carried the gateway key.
 */
function settingsView(backend: SettingsBackend): MagpieSettingsView {
  const page = backend.store.get()
  const endpoint = resolveEffectiveEndpoint(backend.patchEndpoint, page)
  const search = resolveEffectiveSearchSettings(backend.patchSearch, page)
  const binding = backend.readWebSearchState()
  const mcp = backend.readMcpState()
  return {
    baseUrl: endpoint.baseUrl,
    hasApiKey: endpoint.apiKey !== '',
    hasWebKey: (page.webKey ?? '').trim() !== '',
    enabledModels: page.enabledModels,
    inheritedModels: page.enabledModels === undefined,
    showComposerIcon: page.showComposerIcon !== false,
    mcpEnabled: page.mcpEnabled === true,
    mcpAvailable: mcp.available,
    mcpRegistered: mcp.registered,
    ...(mcp.mode !== undefined ? { mcpMode: mcp.mode } : {}),
    ...(mcp.address !== undefined ? { mcpAddress: mcp.address } : {}),
    ...(mcp.hubToolCount !== undefined ? { mcpHubToolCount: mcp.hubToolCount } : {}),
    ...(mcp.registeredCount !== undefined ? { mcpRegisteredCount: mcp.registeredCount } : {}),
    ...(mcp.status !== undefined ? { mcpStatus: mcp.status } : {}),
    ...(mcp.status?.state === 'failed' && mcp.status.lastError !== undefined ? { mcpError: mcp.status.lastError } : {}),
    searchMode: search.mode,
    searchModel: search.model,
    searchMaxUses: search.maxUses,
    searchActive: binding.active,
    searchProviderId: backend.providerId,
    searchRegistered: binding.registered,
    searchSwitchable: binding.switchable,
    ...(binding.activeProvider !== undefined ? { activeSearchProvider: binding.activeProvider } : {}),
  }
}

/**
 * Accept an older client's payload that still includes the credential field
 * but left it blank ("keep the saved key"). The field is dropped so the save
 * merges instead of failing validation. A blank key with nothing stored is
 * still an error: there is no credential to keep.
 */
function stripBlankApiKey(backend: SettingsBackend, body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  const record = body as Record<string, unknown>
  const rest = { ...record }
  if (typeof record.apiKey === 'string' && record.apiKey.trim() === '') {
    if (resolveEffectiveEndpoint(backend.patchEndpoint, backend.store.get()).apiKey === '') {
      throw new Error('dsh-magpie-connect: apiKey is required and must not be empty')
    }
    delete rest.apiKey
  }
  // An empty Web Key field means "keep the saved Web Key", just like the API
  // Key field. It may also be omitted entirely by older clients.
  if (typeof record.webKey === 'string' && record.webKey.trim() === '') delete rest.webKey
  return rest
}

async function handleSettingsGet(): Promise<Response> {
  try {
    return routeOk(settingsView(backendOrThrow()))
  } catch (error) {
    return routeFail(error)
  }
}

async function handleSettingsPost(request: Request): Promise<Response> {
  try {
    const backend = backendOrThrow()
    const body = await readRouteBody(request)
    let searchActive: boolean | undefined
    if (body && typeof body === 'object' && 'searchActive' in body) {
      const rawActive = (body as Record<string, unknown>).searchActive
      if (rawActive !== undefined) {
        if (typeof rawActive !== 'boolean') {
          throw new Error('dsh-magpie-connect: searchActive must be a boolean')
        }
        searchActive = rawActive
      }
    }
    const normalized = normalizePageSettings(stripBlankApiKey(backend, body))
    // 预览本次提交生效后的配置，在落盘前统一拦截不完整的搜索切换请求。
    const mergedPage = { ...backend.store.get(), ...normalized }
    const nextEndpoint = resolveEffectiveEndpoint(backend.patchEndpoint, mergedPage)
    const nextSearch = resolveEffectiveSearchSettings(backend.patchSearch, mergedPage)
    const currentBinding = backend.readWebSearchState()
    const willBeActive = searchActive ?? currentBinding.active
    if (searchActive === true) {
      if (!currentBinding.registered) {
        throw new Error('dsh-magpie-connect: DSH web search service is unavailable in this composition')
      }
      if (!currentBinding.switchable) {
        throw new Error('dsh-magpie-connect: cannot update DSH web.searchProvider automatically; select Magpie in DSH Web search settings')
      }
      if (!isConfigured(nextEndpoint)) {
        throw new Error('dsh-magpie-connect: configure API URL and apiKey before enabling Magpie web search')
      }
    }
    if (
      willBeActive &&
      (searchActive === true || normalized.searchMode !== undefined || normalized.searchModel !== undefined) &&
      nextSearch.mode === 'model' &&
      nextSearch.model.trim() === ''
    ) {
      throw new Error('dsh-magpie-connect: searchModel is required when searchMode is "model"')
    }
    // 勾选启用 MCP Hub 时，需当前组合加载了 `ctx.mcpManager` 且连接目标（地址+Key）已配置，
    // 否则在落盘前就明确拒绝，避免写入一个永远起不来的开关。
    if (normalized.mcpEnabled === true) {
      const mcpState = backend.readMcpState()
      if (!mcpState.available) {
        throw new Error('dsh-magpie-connect: DSH MCP manager is unavailable in this composition')
      }
      if (!isConfigured(nextEndpoint)) {
        throw new Error('dsh-magpie-connect: configure API URL and apiKey before enabling the Magpie MCP hub')
      }
    }
    // The submitted allowlist is stored **as submitted**. Dropping ids the
    // current directory does not list would silently undo a delete: a lane's
    // models come and go between refreshes, so the ids removed while the
    // gateway happened to be un-listing them would be forgotten, then reappear
    // in the picker on the next refresh that listed them again.
    // 同时提交页面配置与 `searchActive` 时，先执行容易失败的 `ctx.settings.mutate`，
    // 避免 mutate 失败后留下半截写入的 settings.json；若后续 store.save 失败则回滚。
    const hasPageFields = Object.keys(normalized).length > 0
    if (searchActive !== undefined) {
      const previousProvider = currentBinding.activeProvider
      const willMutateProvider =
        (searchActive && previousProvider !== backend.providerId) ||
        (!searchActive && previousProvider === backend.providerId)
      await backend.setWebSearchActive(searchActive)
      if (hasPageFields) {
        try {
          await backend.store.save(normalized)
          backend.applyPageSettings()
        } catch (saveError) {
          if (willMutateProvider) {
            await backend.restoreWebSearchProvider(previousProvider).catch(() => {})
          }
          throw saveError
        }
      }
    } else {
      await backend.store.save(normalized)
      backend.applyPageSettings()
    }
    // A save can move the endpoint (or just the key), so re-read the directory
    // before answering: the page re-reads rows right after this response, and a
    // key-guarded gateway would otherwise still be serving the old, empty
    // snapshot when that read lands.
    //
    // Bounded: the write is already durable, so a gateway that answers slowly
    // (or not at all) must not turn a successful save into a client-side
    // timeout. Losing the race only costs a stale row, never the setting.
    if (normalized.baseUrl !== undefined || normalized.apiKey !== undefined) {
      await Promise.race([
        backend.catalog.refreshOnce(),
        new Promise((resolve) => setTimeout(resolve, SAVE_REFRESH_WAIT_MS)),
      ])
    }
    // A save that flips `mcpEnabled` (or moves the endpoint it dials) must let
    // the async tools/list settle so the reply reflects the real tool set —
    // bounded, because a slow gateway must not turn a good save into a timeout.
    if (
      normalized.mcpEnabled !== undefined ||
      normalized.baseUrl !== undefined ||
      normalized.apiKey !== undefined
    ) {
      await Promise.race([
        backend.reconcileMcp(),
        new Promise((resolve) => setTimeout(resolve, SAVE_REFRESH_WAIT_MS)),
      ])
    }
    return routeOk(settingsView(backend))
  } catch (error) {
    return routeFail(error)
  }
}

async function handleModelsGet(): Promise<Response> {
  try {
    const backend = backendOrThrow()
    return routeOk({ models: buildModelRows(backend), snapshot: backend.catalog.snapshot() })
  } catch (error) {
    return routeFail(error)
  }
}

/** Resolve the endpoint one probe should ask: form values first, effective config as fallback. */
function probeTarget(
  backend: SettingsBackend,
  body: { baseUrl?: unknown; apiKey?: unknown },
): { origin: string; key: string } {
  const effective = backend.effective()
  const origin = normalizeBaseUrl(body.baseUrl ?? effective.baseUrl)
  // A blank field means "use the saved key": older pages echoed the
  // credential into the form, and a blank submit must keep working now that
  // the server no longer sends it back.
  const typed = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const key = typed === '' ? effective.apiKey.trim() : typed
  if (key === '') throw new Error('dsh-magpie-connect: apiKey is required — fill it in before asking the gateway')
  return { origin, key }
}

/**
 * Turn a gateway failure into copy the page can show. A 404 from the gateway
 * almost always means the origin path is wrong or the key is unknown or
 * unauthorized (many gateways hide existence behind 404 instead of 401).
 */
function hintGatewayFailure(error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error)
  const hinted =
    /HTTP 404/.test(message) && !/网关返回 404/.test(message)
      ? `${message}（网关返回 404：多为 API 地址路径不对，或该 Key 无效/无权访问）`
      : message
  return routeFail(hinted)
}

async function handleTestPost(request: Request): Promise<Response> {
  try {
    const backend = backendOrThrow()
    const body = (await readRouteBody(request)) as { baseUrl?: unknown; apiKey?: unknown }
    const { origin, key } = probeTarget(backend, body)
    const models = await fetchMagpieModels(origin, fetch, { headers: { authorization: `Bearer ${key}` } })
    return routeOk({ count: models.size, models: [...models.keys()].sort().slice(0, 50) })
  } catch (error) {
    return hintGatewayFailure(error)
  }
}

/**
 * Candidate discovery for the fetch-available-models dialog.
 *
 * Unlike {@link handleTestPost} (a count for the connection check) this returns
 * full rows so the picker can show the same chips the list does, and it caps
 * nothing: the dialog filters client-side. The origin and key come from the
 * form, so a provider can be filled in one pass instead of save-then-return.
 */
async function handleDiscoverPost(request: Request): Promise<Response> {
  try {
    const backend = backendOrThrow()
    const body = (await readRouteBody(request)) as { baseUrl?: unknown; apiKey?: unknown }
    const { origin, key } = probeTarget(backend, body)
    const models = await fetchMagpieModels(origin, fetch, { headers: { authorization: `Bearer ${key}` } })
    // The reply is the gateway's whole catalog as of now, so the local
    // directory adopts it wholesale. Without this, a model the gateway dropped
    // lingers in the list (and the picker) until a *successful* background
    // refresh — which on a key-guarded gateway may never come. That is how a
    // model already gone from the dialog kept showing in the settings list.
    backend.catalog.adoptDirectory(models)
    const candidates = [...models.entries()]
      .map(([id, entry]) => toRow(id, entry))
      .sort(compareModelRows)
    return routeOk({ count: candidates.length, models: candidates })
  } catch (error) {
    return hintGatewayFailure(error)
  }
}

/**
 * The composer popover's routing view: the gateway's request ledger plus the
 * accounts' allowances, compressed by {@link fetchTraceView} into the shape
 * `trace-contract.ts` declares. `?session=<id>` (the DSH session the composer
 * popover belongs to) adds the session's own latest route. Errors resolve
 * into a status kind the popover renders as one localized hint row — never
 * a throw.
 */
async function handleTraceGet(request: Request): Promise<Response> {
  try {
    const backend = backendOrThrow()
    const session = new URL(request.url).searchParams.get('session') ?? undefined
    const pageSettings = backend.store.get()
    const view = await fetchTraceView(backend.effective(), AbortSignal.timeout(TRACE_TIMEOUT_MS), session ?? undefined, pageSettings.webKey)
    return routeOk(view)
  } catch (error) {
    return routeFail(error)
  }
}

/**
 * Serve one Magpie Web provider icon through DSH's same-origin API so the
 * browser does not need a Web Key cookie for `api.lan:3430/icons/...`.
 */
async function handleIconGet(request: Request): Promise<Response> {
  const name = new URL(request.url).searchParams.get('name') ?? ''
  if (name === '') return jsonResponse(404, { ok: false, error: 'icon name is required' })
  try {
    const backend = backendOrThrow()
    const webKey = backend.store.get().webKey
    if (webKey === undefined || webKey.trim() === '') {
      return jsonResponse(404, { ok: false, error: 'Magpie Web Key is not configured' })
    }
    const base = deriveGatewayBase(normalizeBaseUrl(backend.effective().baseUrl))
    if (base === undefined || base === '') return jsonResponse(404, { ok: false, error: 'gateway base is invalid' })
    const icon = await fetchWebIcon(base, webKey.trim(), name, AbortSignal.timeout(TRACE_TIMEOUT_MS))
    return new Response(icon.body, {
      status: 200,
      headers: { 'content-type': icon.contentType, 'cache-control': 'public, max-age=3600' },
    })
  } catch (error) {
    return jsonResponse(404, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * 测试网页搜索配置：使用当前表单（或已保存）的网关地址、Key 及搜索参数
 * 发起一次试探搜索，便于用户在保存前验证 MCP 或指定模型搜索是否可用。
 */
async function handleSearchTestPost(request: Request): Promise<Response> {
  try {
    const backend = backendOrThrow()
    const body = (await readRouteBody(request)) as {
      baseUrl?: unknown
      apiKey?: unknown
      searchMode?: unknown
      searchModel?: unknown
      searchMaxUses?: unknown
      query?: unknown
    }
    const { origin, key } = probeTarget(backend, body)
    const current = backend.effectiveSearch()
    const mode = body.searchMode !== undefined ? normalizeSearchMode(body.searchMode) : current.mode
    let model = current.model
    if (body.searchModel !== undefined) {
      if (typeof body.searchModel !== 'string') {
        throw new Error('dsh-magpie-connect: searchModel must be a string')
      }
      model = body.searchModel.trim()
    }
    const maxUses = body.searchMaxUses !== undefined ? normalizeSearchMaxUses(body.searchMaxUses) : current.maxUses
    const query = typeof body.query === 'string' && body.query.trim() !== '' ? body.query.trim() : 'DeepSeek'
    const provider = new MagpieSearchProvider({
      id: backend.providerId,
      resolveSnapshot: () => ({
        endpoint: { baseUrl: origin, apiKey: key },
        search: {
          mode,
          model,
          maxUses,
          timeoutMs: Math.min(backend.searchTimeoutMs, SEARCH_TEST_TIMEOUT_MS),
        },
      }),
    })
    const result = await provider.search({ query, maxResults: 5 })
    return routeOk({
      mode,
      ...(mode === 'model' ? { model } : {}),
      count: result.sources.length,
      hasContent: typeof result.content === 'string' && result.content.length > 0,
      sources: result.sources.slice(0, 5),
    })
  } catch (error) {
    return routeFail(error)
  }
}

/**
 * 测试 Magpie MCP Hub：用当前表单（或已保存）的网关地址、Key 直接对
 * `/mcp/magpie/hub` 做一次 initialize + tools/list 探测。不注册任何实例，
 * 因此即使开关尚未保存、或当前组合没有 `ctx.mcpManager` 也能验证 Hub 是否可达、
 * 列出多少工具、以及它是否已在 Magpie 资源库开启。
 */
async function handleMcpTestPost(request: Request): Promise<Response> {
  try {
    const backend = backendOrThrow()
    const body = (await readRouteBody(request)) as { baseUrl?: unknown; apiKey?: unknown }
    const { origin, key } = probeTarget(backend, body)
    // Probe the same address the registration would use, so the test answers
    // the question the user is actually asking: "will this work here?"
    const agent = resolveHubAgent(origin, normalizeMcpAgent(backend.mcpAgent))
    const local = isLocalGateway(origin)
    const result = await probeMagpieHub(
      { baseUrl: origin, apiKey: key },
      {
        timeoutMs: Math.min(backend.searchTimeoutMs, MCP_TEST_TIMEOUT_MS),
        agent: local ? agent : '',
      },
    )
    return routeOk({ ...result, address: local && agent !== '' ? 'agent' : 'all' })
  } catch (error) {
    return routeFail(error)
  }
}

function routeDefinitions(): RouteDefinition[] {
  return [
    {
      path: SETTINGS_API,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: (request: Request) => (request.method === 'POST' ? handleSettingsPost(request) : handleSettingsGet()),
    },
    {
      path: MODELS_API,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: () => handleModelsGet(),
    },
    {
      path: TEST_API,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: (request: Request) => handleTestPost(request),
    },
    {
      path: DISCOVER_API,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: (request: Request) => handleDiscoverPost(request),
    },
    {
      path: TRACE_API,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: (request: Request) => handleTraceGet(request),
    },
    {
      path: ICON_API,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: (request: Request) => handleIconGet(request),
    },
    {
      path: SEARCH_TEST_API,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: (request: Request) => handleSearchTestPost(request),
    },
    {
      path: MCP_TEST_API,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: (request: Request) => handleMcpTestPost(request),
    },
  ]
}

/**
 * Install the settings-page routes on the authenticated /api channel.
 *
 * Process-wide singleton semantics: hot reload can run overlapping
 * generations of this plugin in one process, and the connection registry
 * rejects duplicate paths. The routes install once and are shared; the last
 * generation out uninstalls. Handlers resolve through `currentBackend`, so
 * they always serve the newest generation.
 */
function installSettingsRoutes(
  ctx: PluginContext,
  logger: PluginContext['logger'],
): void {
  try {
    if (typeof ctx.inject !== 'function') return
    ctx.inject(['connection'], (cctx: Record<string, unknown>) => {
      const connection = cctx.connection as { fetch?: { register?: FetchRegister } } | undefined
      const register = connection?.fetch?.register
      if (typeof register !== 'function') {
        logger.warn('dsh-magpie-connect: connection fetch registry unavailable; settings page API disabled')
        return
      }
      liveRouteSets += 1
      try {
        if (routeDisposers === null) {
          const installed: Array<() => void | Promise<void>> = []
          try {
            for (const definition of routeDefinitions()) {
              try {
                installed.push(register(definition))
              } catch (error) {
                // A live sibling generation already owns this path; share it.
                // Only ever expected for a whole path we also declare — since
                // every method of one path shares one entry, losing one here
                // means the sibling serves it identically.
                if (error instanceof Error && /already registered/.test(error.message)) {
                  logger.warn(`dsh-magpie-connect: ${definition.path} already registered by another generation; sharing it`)
                  continue
                }
                throw error
              }
            }
          } catch (error) {
            for (const dispose of installed.reverse()) {
              try {
                const result = dispose()
                if (result instanceof Promise) result.catch(() => {})
              } catch {
                // roll back best-effort
              }
            }
            throw error
          }
          routeDisposers = installed
        }
      } catch (error) {
        liveRouteSets -= 1
        logger.warn(`dsh-magpie-connect: settings API unavailable: ${error instanceof Error ? error.message : String(error)}`)
        throw error
      }
      return async () => {
        liveRouteSets -= 1
        if (liveRouteSets <= 0) {
          liveRouteSets = 0
          const owned = routeDisposers
          routeDisposers = null
          if (owned) {
            for (const dispose of owned.reverse()) await dispose()
          }
        }
      }
    })
  } catch (error) {
    logger.warn(`dsh-magpie-connect: settings API unavailable: ${error instanceof Error ? error.message : String(error)}`)
  }
}

interface DshSettingsDescriptor {
  ns?: string
  value?: unknown
  revision?: number
}

interface DshSettingsService {
  readonly writable?: boolean
  configure?: (policy: unknown, fiber: unknown) => unknown
  describe?: (options?: unknown) => DshSettingsDescriptor[]
  mutate?: (
    ns: string,
    ops: ReadonlyArray<
      { op: 'set'; path: readonly string[]; value: unknown } | { op: 'unset'; path: readonly string[] }
    >,
    expectedRevision?: number,
  ) => Promise<void>
}

/**
 * 把 Magpie MCP Hub 作为 DSH 原生工具接入（`ctx.tools`），并做**客户端按需加载**。
 *
 * 为什么不用 `ctx.mcpManager`：管理器的每个实例会把网关的全部工具连同完整
 * `inputSchema` 注册进来，每轮请求都发一遍——87 个工具约 6.8 万 tokens。而 Magpie
 * 自带的「按需加载」只对**命名 agent**（且该 agent 在 Magpie 本机被检测到）生效，路由器
 * 上的 Magpie 看不到 DSH，永远触发不了。于是这里复刻同一规则：
 *
 * - 先 `tools/list` 拿到 Hub 的工具数与清单；
 * - **≤10 个**：逐个注册为 `mcp__magpie__<server>__<tool>`（直连）；
 * - **>10 个**：只注册 `mcp__magpie__find_tools` + `mcp__magpie__call_tool` 两个代理，
 *   转发到 Hub 自带的同名工具——所有 schema 都不进请求，模型先查后跑。
 *
 * 「默认不启动、勾选并保存后才启动」：只有 `mcpEnabled` 为真且地址+Key 已配置时才去
 * `tools/list` 并注册；否则注销全部工具，启动时不对网关发起任何 MCP 连接。目标（地址或
 * Key）变化时按新值重刷工具集；未变化时不动，避免打断。
 *
 * 用 `ctx.inject(['tools'])` 接线：没有该服务的精简组合里安静跳过，`readMcpState()`
 * 报告 `available: false`，设置页据此禁用开关。
 */
function installMcpTools(
  ctx: PluginContext,
  logger: PluginContext['logger'],
  options: {
    resolveEndpoint: () => { baseUrl: string; apiKey: string }
    enabled: () => boolean
    toolCallTimeoutMs: number
    listTimeoutMs: number
    /** Hub agent segment ('' = all-apps address). */
    agent: string
    onAvailableChange: (available: boolean) => void
    onStateChange: (state: { mode: 'direct' | 'on-demand' | 'passthrough'; hubToolCount: number; registeredCount: number; address?: 'agent' | 'all'; lastError?: string }) => void
    /** 接管「重新对齐」入口（服务延迟激活时也能拿到真正可用的 reconcile）。 */
    setReconcile: (reconcile: () => Promise<void>) => void
  },
): void {
  if (typeof ctx.inject !== 'function') return
  try {
    ctx.inject(['tools'], (tctx: Record<string, unknown>) => {
      const scoped = tctx as {
        effect?: (fn: () => () => void, label?: string) => unknown
        tools?: DshToolService
      }
      const tools = scoped.tools
      if (tools === undefined || typeof tools.register !== 'function') {
        logger.warn('dsh-magpie-connect: ctx.tools.register unavailable; Magpie MCP tools disabled')
        return
      }
      options.onAvailableChange(true)

      const registrar = new MagpieToolRegistrar(tools, {
        getEndpoint: () => options.resolveEndpoint(),
        toolCallTimeoutMs: options.toolCallTimeoutMs,
        agent: options.agent,
      })

      /** 上一次应用的「目标 + 启用状态」指纹，未变则不重刷。 */
      let currentFingerprint: string | undefined
      /** 递增代号：慢的 tools/list 回来时若已不是最新一次，丢弃，避免旧结果覆盖新状态。 */
      let generation = 0
      /** 当前（或最近一次）应用的在途 Promise：目标未变时让调用方等它落地。 */
      let pending: Promise<void> = Promise.resolve()
      let cleanedUp = false

      const clear = (): void => {
        registrar.unregister()
        currentFingerprint = undefined
        options.onStateChange({ mode: 'direct', hubToolCount: 0, registeredCount: 0 })
      }

      const reconcile = (): Promise<void> => {
        if (cleanedUp) return Promise.resolve()
        const enabled = options.enabled()
        const endpoint = options.resolveEndpoint()
        const registration = enabled ? buildHubRegistration(endpoint, { toolCallTimeoutMs: options.toolCallTimeoutMs, agent: options.agent }) : null
        const fingerprint = hubFingerprint(registration)
        // 未启用 / 未配置：注销全部工具，绝不对网关发起连接。
        if (fingerprint === undefined) {
          clear()
          return Promise.resolve()
        }
        // 目标没变：返回在途的那次（可能仍在 tools/list），让保存方能等它落地。
        if (fingerprint === currentFingerprint) return pending
        currentFingerprint = fingerprint
        const myGeneration = ++generation
        pending = (async () => {
          try {
            // Which hub address to ask depends on where Magpie runs.
            //
            // Local (`127.0.0.1` / `localhost`): Magpie can see DSH as an
            // installed agent, so `/mcp/magpie/hub/<agent>` gives that agent's
            // ticked servers and — past 10 tools — Magpie's own on-demand pair.
            // Letting Magpie do the on-demand keeps its server catalog in
            // `find_tools`' description, which is what makes the model aware of
            // servers like `bookmark` without being told.
            //
            // Remote (a router, another machine): Magpie never detects DSH, so
            // its agent address lists nothing. Use the all-apps address and do
            // the on-demand here.
            const local = isLocalGateway(endpoint.baseUrl)
            const primaryAgent = resolveHubAgent(endpoint.baseUrl, options.agent)
            let hubTools: RawMcpTool[] = []
            try {
              hubTools = await listHubTools(endpoint, {
                timeoutMs: options.listTimeoutMs,
                agent: primaryAgent,
              })
            } catch (error) {
              // A local agent address that fails outright is worth one fallback
              // attempt at the all-apps address before giving up.
              if (!local || primaryAgent === '') throw error
              hubTools = []
            }
            // An agent address that lists nothing means the Library has no
            // servers ticked for it (or DSH is not visible there after all).
            // Falling back to every server beats handing the model no tools.
            let usedAllApps = false
            if (local && primaryAgent !== '' && hubTools.length === 0) {
              hubTools = await listHubTools(endpoint, { timeoutMs: options.listTimeoutMs, agent: '' })
              usedAllApps = hubTools.length > 0
              if (usedAllApps) {
                logger.info(
                  `dsh-magpie-connect: agent "${primaryAgent}" lists no tools; using the all-apps hub address instead`,
                )
              }
            }
            if (cleanedUp || myGeneration !== generation) return
            registrar.apply(hubTools)
            options.onStateChange({ ...registrar.state(), address: usedAllApps || !local ? 'all' : 'agent' })
            logger.info(
              `dsh-magpie-connect: Magpie MCP ${registrar.state().mode} — ${hubTools.length} hub tools from the ${usedAllApps || !local ? 'all-apps' : `agent "${primaryAgent}"`} address`,
            )
          } catch (error) {
            if (cleanedUp || myGeneration !== generation) return
            // 拉不到工具清单：撤下全部工具并保留错误状态，页面显示连接失败。
            registrar.unregister()
            options.onStateChange({ mode: 'direct', hubToolCount: 0, registeredCount: 0, lastError: error instanceof Error ? error.message : String(error) })
            logger.warn(`dsh-magpie-connect: Magpie MCP tools/list failed: ${error instanceof Error ? error.message : String(error)}`)
          }
        })()
        return pending
      }

      const teardown = (): void => {
        if (cleanedUp) return
        cleanedUp = true
        generation += 1
        registrar.dispose()
        options.onAvailableChange(false)
        options.setReconcile(async () => {})
      }

      if (typeof scoped.effect === 'function') {
        scoped.effect(() => teardown, 'dsh-magpie-connect: mcp tools')
      }

      // 首次接线对齐一次，并把 reconcile 交给外部（设置保存后再次调用）。
      void reconcile()
      options.setReconcile(() => (cleanedUp ? Promise.resolve() : reconcile()))
      return () => {
        options.setReconcile(async () => {})
      }
    })
  } catch (error) {
    logger.warn(`dsh-magpie-connect: ctx.tools unavailable: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 按 LIFO（最新一代优先）尝试让等待队列中的后续代接管 `ctx.web` 注册权。 */
function drainSearchWaiters(id: string, finalAttempt: boolean): boolean {
  if (ownedSearchProviders.has(id)) return true
  const waiters = pendingSearchRegistrations.get(id)
  if (!waiters || waiters.length === 0) return false
  for (let i = waiters.length - 1; i >= 0; i--) {
    const candidate = waiters[i]!
    try {
      if (candidate.tryTakeover()) {
        waiters.splice(i, 1)
        if (waiters.length === 0) pendingSearchRegistrations.delete(id)
        return true
      }
    } catch {
      candidate.onLost()
      waiters.splice(i, 1)
    }
  }
  if (finalAttempt && !ownedSearchProviders.has(id)) {
    // 微任务复试后仍无法接管（例如宿主已卸载或外部插件抢占），同步纠正剩余等待者的注册状态。
    const remaining = waiters.splice(0, waiters.length)
    pendingSearchRegistrations.delete(id)
    for (const waiter of remaining) waiter.onLost()
  } else if (waiters.length === 0) {
    pendingSearchRegistrations.delete(id)
  }
  return false
}

/**
 * 向 DSH 的 `ctx.web` 注册 Magpie 网页搜索提供方（可选注入）。
 *
 * 兼容 Cordis 的 fiber 生命周期与热重载重叠场景：
 * - 正常启动时直接向 `wctx.web.registerSearchProvider` 注册，并通过 `wctx.effect`
 *   绑定清理；
 * - 若遇到 `WEB_DUPLICATE_PROVIDER`：仅当确认是本插件活跃前一代占位
 *   （`ownedSearchProviders.has(id)`）时才入队等待接管并上报已注册；若该 id
 *   被外部无关插件占用，则保持未注册状态，避免设置页误允许切换；
 * - 前一代卸载释放注册位后，先同步尝试由最新存活代接管，若 `dispose()` 为
 *   异步微任务释放导致同步仍遇重复 id，则再通过 `queueMicrotask` 复试一次。
 * - 未加载 `web` 服务的精简组合会安静跳过。
 */
function installSearchProvider(
  ctx: PluginContext,
  logger: PluginContext['logger'],
  options: {
    id: string
    title: string
    resolveSnapshot: () => SearchRuntimeSnapshot
    onRegisteredChange: (registered: boolean) => void
  },
): void {
  try {
    if (typeof ctx.inject !== 'function') return
    ctx.inject(['web'], (wctx: Record<string, unknown>) => {
      const scoped = wctx as {
        effect?: (fn: () => () => void, label?: string) => unknown
        web?: { registerSearchProvider?: (provider: WebSearchProvider) => unknown }
      }
      const web = scoped.web
      const register = web?.registerSearchProvider
      if (typeof register !== 'function') {
        logger.warn('dsh-magpie-connect: web search registry unavailable; Magpie search provider disabled')
        return
      }
      const provider = new MagpieSearchProvider({
        id: options.id,
        title: options.title,
        resolveSnapshot: options.resolveSnapshot,
      })
      let ownedDispose: (() => void) | null = null
      let ownsRegistration = false
      let cleanedUp = false

      const tryRegister = (): boolean => {
        if (cleanedUp) return false
        try {
          const disposer = register.call(web, provider)
          ownedDispose = typeof disposer === 'function' ? (disposer as () => void) : null
          ownsRegistration = true
          ownedSearchProviders.add(options.id)
          options.onRegisteredChange(true)
          logger.info(`dsh-magpie-connect: web search provider registered for "${options.id}"`)
          return true
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
          if (/already registered/i.test(message) || code === 'WEB_DUPLICATE_PROVIDER') {
            return false
          }
          logger.warn(`dsh-magpie-connect: web search provider registration failed: ${message}`)
          throw error
        }
      }

      let registeredNow = false
      try {
        registeredNow = tryRegister()
      } catch {
        return
      }

      const waiter: PendingSearchWaiter = {
        tryTakeover: tryRegister,
        onLost: () => {
          if (!cleanedUp && !ownsRegistration) options.onRegisteredChange(false)
        },
      }

      if (!registeredNow) {
        if (!ownedSearchProviders.has(options.id)) {
          logger.warn(
            `dsh-magpie-connect: web search provider "${options.id}" is already registered by another plugin; Magpie web search disabled`,
          )
          options.onRegisteredChange(false)
          return
        }
        logger.warn(`dsh-magpie-connect: web search provider "${options.id}" already registered by an earlier generation; waiting to take over`)
        const queue = pendingSearchRegistrations.get(options.id) ?? []
        queue.push(waiter)
        pendingSearchRegistrations.set(options.id, queue)
        // 前一代正在活跃占位并通过 currentBackend 委托到最新一代，接管完成前保持可用。
        options.onRegisteredChange(true)
      }

      const teardown = (): void => {
        if (cleanedUp) return
        cleanedUp = true
        options.onRegisteredChange(false)
        const queue = pendingSearchRegistrations.get(options.id)
        if (queue) {
          const idx = queue.indexOf(waiter)
          if (idx >= 0) queue.splice(idx, 1)
          if (queue.length === 0) pendingSearchRegistrations.delete(options.id)
        }
        if (!ownsRegistration) return
        ownsRegistration = false
        ownedSearchProviders.delete(options.id)
        const dispose = ownedDispose
        ownedDispose = null
        if (dispose) {
          try {
            dispose()
          } catch {
            // 卸载阶段尽力清理，不阻断其它资源释放
          }
        }
        // 先同步尝试接管；若宿主 dispose 为异步微任务释放，则再调度一次微任务复试。
        if (!drainSearchWaiters(options.id, false)) {
          const remaining = pendingSearchRegistrations.get(options.id)
          if (remaining && remaining.length > 0) {
            queueMicrotask(() => {
              drainSearchWaiters(options.id, true)
            })
          }
        }
      }

      if (typeof scoped.effect === 'function') {
        scoped.effect(() => teardown, 'dsh-magpie-connect: web search provider')
      }
      return teardown
    })
  } catch (error) {
    logger.warn(`dsh-magpie-connect: web search provider unavailable: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function apply(
  ctx: PluginContext,
  config: DshMagpieConnectConfig = {},
): { ready: Promise<{ version: string }> } {
  const logger = ctx.logger
  const cfg = resolveConfig(config)
  const ready = Promise.resolve({ version: 'adapter' })

  if (!ctx.llm || typeof ctx.llm.registerAdapter !== 'function') {
    logger.error('dsh-magpie-connect: llm service unavailable; adapter cannot register')
    return { ready }
  }

  const dataDir = cfg.dataDir
  const statusPath = join(dataDir, 'adapter-status.json')
  const writeStatus = (status: CatalogSnapshot, lastError: string): void => {
    void writeFile(
      statusPath,
      JSON.stringify({ ...status, lastError, writtenAt: new Date().toISOString() }, null, 2),
      'utf8',
    ).catch(() => {})
  }

  // An explicit `dataDir` means the user owns the path: never read the pre-0.5
  // file and never delete anything. Otherwise the store falls back read-only to
  // `~/.dsh-magpie-connect/settings.json` and migrates it on the first save.
  const store = new SettingsStore({
    path: defaultSettingsPath(dataDir),
    legacyPath: config.dataDir === undefined ? join(legacyDataDir(), 'settings.json') : undefined,
    // Only the plugin-owned default directory is chmod-ed; an explicit
    // `dataDir` belongs to the user and is left as they set it.
    privateDir: config.dataDir === undefined,
  })
  const patchEndpoint = { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey }
  const patchSearch: EffectiveSearchSettings = {
    mode: cfg.searchMode,
    model: cfg.searchModel,
    maxUses: cfg.searchMaxUses,
  }
  const effective = () => resolveEffectiveEndpoint(patchEndpoint, store.get())
  const effectiveSearch = () => resolveEffectiveSearchSettings(patchSearch, store.get())

  let searchRegistered = false
  let dshSettings: DshSettingsService | undefined

  /** 当前环境是否加载了 `ctx.tools`，以及 Magpie 工具集当前暴露的状态。 */
  let mcpAvailable = false
  /** 最近一次成功应用的工具集（直连或按需、Hub 工具数、已注册的 DSH 工具数）。 */
  let mcpToolState: { mode: 'direct' | 'on-demand' | 'passthrough'; hubToolCount: number; registeredCount: number; address?: 'agent' | 'all'; lastError?: string } = {
    mode: 'direct',
    hubToolCount: 0,
    registeredCount: 0,
  }
  /** 设置保存后触发工具集重新对齐（`installMcpTools` 接线后才有实际逻辑）。 */
  let reconcileMcp: () => Promise<void> = async () => {}

  /** 读取 Magpie MCP 工具集当前状态，供设置页显示。 */
  const readMcpState = (): McpBindingState => {
    if (!mcpAvailable) return { available: false, registered: false }
    const registered = mcpToolState.registeredCount > 0
    let status: McpServerStatusView | undefined
    if (registered) {
      status = { state: 'connected', toolCount: mcpToolState.registeredCount }
    } else if (store.get().mcpEnabled === true && mcpToolState.lastError !== undefined) {
      status = { state: 'failed', lastError: mcpToolState.lastError }
    }
    return {
      available: true,
      registered,
      mode: mcpToolState.mode,
      ...(mcpToolState.address !== undefined ? { address: mcpToolState.address } : {}),
      hubToolCount: mcpToolState.hubToolCount,
      registeredCount: mcpToolState.registeredCount,
      ...(status !== undefined ? { status } : {}),
    }
  }

  /** 读取 DSH `web.searchProvider` 当前绑定状态（单一事实来源，与内置搜索设置页实时同步）。 */
  const readWebSearchState = (): WebSearchBindingState => {
    if (!dshSettings || typeof dshSettings.describe !== 'function') {
      return { registered: searchRegistered, switchable: false, active: false }
    }
    try {
      const descriptors = dshSettings.describe()
      const webDesc = Array.isArray(descriptors) ? descriptors.find((row) => row?.ns === 'web') : undefined
      if (!webDesc) {
        return { registered: searchRegistered, switchable: false, active: false }
      }
      const rawValue = webDesc.value && typeof webDesc.value === 'object'
        ? (webDesc.value as Record<string, unknown>).searchProvider
        : undefined
      const activeProvider = typeof rawValue === 'string' && rawValue.trim() !== '' ? rawValue.trim() : undefined
      const switchable = searchRegistered && dshSettings.writable !== false && typeof dshSettings.mutate === 'function'
      return {
        registered: searchRegistered,
        switchable,
        active: activeProvider === cfg.providerId,
        ...(activeProvider !== undefined ? { activeProvider } : {}),
      }
    } catch {
      return { registered: searchRegistered, switchable: false, active: false }
    }
  }

  /** 通过 DSH `ctx.settings.mutate` 切换或解除 `web.searchProvider` 对本插件的绑定。 */
  const setWebSearchActive = async (active: boolean): Promise<void> => {
    const state = readWebSearchState()
    if (!dshSettings || typeof dshSettings.mutate !== 'function' || dshSettings.writable === false) {
      throw new Error('dsh-magpie-connect: DSH settings service is unavailable or read-only')
    }
    if (active) {
      if (!state.registered) {
        throw new Error('dsh-magpie-connect: Magpie web search provider is not registered')
      }
      await dshSettings.mutate('web', [{ op: 'set', path: ['searchProvider'], value: cfg.providerId }])
      return
    }
    // 仅当当前确实指向本插件时才取消覆盖，避免误覆盖用户另行选中的其他搜索提供方。
    if (state.activeProvider === cfg.providerId) {
      await dshSettings.mutate('web', [{ op: 'unset', path: ['searchProvider'] }])
    }
  }

  /** 将 `web.searchProvider` 回滚到切换前的值（用于伴随 settings.json 持久化失败时的补偿回滚）。 */
  const restoreWebSearchProvider = async (provider: string | undefined): Promise<void> => {
    if (!dshSettings || typeof dshSettings.mutate !== 'function' || dshSettings.writable === false) return
    if (provider !== undefined) {
      await dshSettings.mutate('web', [{ op: 'set', path: ['searchProvider'], value: provider }])
      return
    }
    await dshSettings.mutate('web', [{ op: 'unset', path: ['searchProvider'] }])
  }

  /**
   * Publish `llm/adapters-updated`, the one notification DSH's model
   * directory listens to.
   *
   * The browser caches one `modelCatalog()` read per Host generation and
   * re-reads only on this event. Registering an adapter fires it once, but
   * nothing does for a pure in-memory change, so hiding models, switching
   * the gateway origin, or a refresh that moved the list all left the picker
   * on the stale snapshot until restart. `dsh-workbuddy-connect` solves the
   * same problem identically for its visibility toggles.
   */
  const announceTopology = (): void => {
    if (typeof ctx.emit !== 'function') return
    try {
      ctx.emit('llm/adapters-updated')
    } catch (error) {
      logger.warn(`dsh-magpie-connect: llm/adapters-updated emit failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const catalog = new ModelCatalog({
    baseUrl: effective().baseUrl,
    apiKey: effective().apiKey,
    refreshSeconds: cfg.refreshSeconds,
    cachePath: defaultCachePath(dataDir),
    onRefresh: (status, lastError) => {
      writeStatus(status, lastError)
      if (lastError) logger.warn(`dsh-magpie-connect: catalog refresh issue: ${lastError}`)
    },
    onInvalidate: announceTopology,
  })
  /**
   * Apply page settings to the live catalog + adapter (no restart needed).
   *
   * The endpoint is a pair: the gateway guards `GET /models` with the same key
   * as inference, so the key is part of the catalog's identity, not just the
   * URL. A key-only edit therefore re-points the catalog too — otherwise the
   * refresh keeps 401ing and the picker keeps serving the static snapshot,
   * which is why a model just ticked in the fetch dialog never appeared.
   */
  const applyPageSettings = (): void => {
    const page = store.get()
    const endpoint = resolveEffectiveEndpoint(patchEndpoint, page)
    // The gate: URL and key are both required. Anything missing clears the
    // catalog API root, which empties the picker and calls fail fast.
    // The value is the versioned root (`…/v1`), passed through untouched.
    const configured = isConfigured(endpoint)
    catalog.setEndpoint(configured ? endpoint.baseUrl.replace(/\/+$/, '') : '', configured ? endpoint.apiKey : '')
    catalog.setEnabled(page.enabledModels ?? null)
    // 连接目标或「是否启用 MCP」变化时让工具集对齐：勾选并保存后才真正启动，
    // 取消勾选或改地址/Key 时即时重刷或注销。未接线时为无害空操作。
    void reconcileMcp()
  }
  const adapter = new MagpieAdapter(catalog, {
    providerId: cfg.providerId,
    displayName: cfg.displayName,
    magpieBaseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    maxRetries: cfg.maxRetries,
    timeoutMs: cfg.timeoutMs,
    firstEventTimeoutMs: cfg.firstEventTimeoutMs,
    idleTimeoutMs: cfg.idleTimeoutMs,
    runtime: {
      baseUrl: () => {
        const endpoint = effective()
        return isConfigured(endpoint) ? endpoint.baseUrl.replace(/\/+$/, '') : ''
      },
      apiKey: () => effective().apiKey,
    },
    resolveAttachments: () => {
      try {
        const attachments = typeof ctx.get === 'function' ? (ctx.get('attachments') as AttachmentStore | undefined) : undefined
        return attachments && typeof attachments.readImageRequest === 'function' ? attachments : undefined
      } catch {
        return undefined
      }
    },
  })
  store.onChange(applyPageSettings)

  // Register immediately: the provider must appear in the selector right
  // away, even while the catalog is still warming up (listModels is read
  // live at selector time, so models appear as refreshes land).
  ctx.llm.registerAdapter([cfg.providerId], adapter)
  logger.info(`dsh-magpie-connect: adapter registered for "${cfg.providerId}" (catalog warms up in background)`)
  void (async () => {
    // Startup order is load-bearing in both directions:
    //
    // 1. read the document first — until it is applied, the catalog is pointed
    //    at the patch/default endpoint, not the user's, so any fetch it does
    //    now fails and leaves the directory empty;
    // 2. apply it, so the catalog knows the real endpoint before it warms up;
    // 3. warm the directory;
    // 4. only then run the legacy conversion, which needs the ids the gateway
    //    actually serves.
    //
    // Doing 3 before 2 was a regression: the warm-up hit the default endpoint,
    // failed, and the settings page fell back to the built-in snapshot.
    const persisted = await store.read()
    await store.hydrate(persisted, undefined)
    applyPageSettings()
    await catalog.start().catch((err) => {
      logger.error(`dsh-magpie-connect: catalog start failed: ${err instanceof Error ? err.message : String(err)}`)
    })
    await store.hydrate(persisted, catalog.directory())
    applyPageSettings()
  })().catch((err) => {
    logger.error(`dsh-magpie-connect: startup failed: ${err instanceof Error ? err.message : String(err)}`)
  })

  // Suppress the auto-generated config form: this plugin owns a dedicated
  // settings page (client half). Guarded — compositions without the settings
  // service simply skip it.
  try {
    if (typeof ctx.inject === 'function') {
      ctx.inject(['settings'], (settingsCtx: Record<string, unknown>) => {
        const scoped = settingsCtx as {
          effect?: (fn: () => unknown, label?: string) => unknown
          settings?: DshSettingsService
        }
        const owned = scoped.settings
        dshSettings = owned
        let released = false
        const releaseSettings = (): void => {
          if (released) return
          released = true
          if (dshSettings === owned) dshSettings = undefined
        }
        try {
          const fiber = (ctx as unknown as Record<string, unknown>).fiber
          scoped.effect?.(() => owned?.configure?.({ auto: false }, fiber), 'dsh-magpie-connect: custom settings page')
          scoped.effect?.(() => releaseSettings, 'dsh-magpie-connect: web search settings ref')
        } catch {
          // presentation policy is best-effort
        }
        return releaseSettings
      })
    }
  } catch {
    // presentation policy is best-effort
  }

  // Newest generation wins: shared route handlers below always resolve through
  // here, so the settings page talks to the latest store/catalog/adapter even
  // when an older generation installed the routes.
  currentBackend = {
    store,
    catalog,
    patchEndpoint,
    patchSearch,
    searchTimeoutMs: cfg.searchTimeoutMs,
    providerId: cfg.providerId,
    mcpAgent: cfg.mcpAgent,
    effective,
    effectiveSearch,
    applyPageSettings,
    readWebSearchState,
    setWebSearchActive,
    restoreWebSearchProvider,
    readMcpState,
    reconcileMcp: () => reconcileMcp(),
  }

  // Register the Magpie MCP hub as DSH tools with client-side on-demand (never
  // dials the gateway until the settings page has saved `mcpEnabled: true`).
  // Newest generation wins: the resolver and enabled-flag read through this
  // generation's store, so a stale generation cannot resurrect an old endpoint.
  installMcpTools(ctx, logger, {
    resolveEndpoint: () => {
      const backend = currentBackend
      return backend && backend.providerId === cfg.providerId ? backend.effective() : effective()
    },
    enabled: () => {
      const backend = currentBackend
      const page = backend && backend.providerId === cfg.providerId ? backend.store.get() : store.get()
      return page.mcpEnabled === true
    },
    toolCallTimeoutMs: cfg.mcpToolCallTimeoutMs,
    listTimeoutMs: MCP_TEST_TIMEOUT_MS,
    agent: normalizeMcpAgent(cfg.mcpAgent),
    onAvailableChange: (available) => {
      if (currentBackend === null || currentBackend.providerId === cfg.providerId) mcpAvailable = available
    },
    onStateChange: (state) => {
      if (currentBackend === null || currentBackend.providerId === cfg.providerId) mcpToolState = state
    },
    setReconcile: (reconcile) => {
      if (currentBackend === null || currentBackend.providerId === cfg.providerId) reconcileMcp = reconcile
    },
  })

  installSettingsRoutes(ctx, logger)
  installSearchProvider(ctx, logger, {
    id: cfg.providerId,
    title: cfg.displayName,
    resolveSnapshot: () => {
      if (currentBackend && currentBackend.providerId === cfg.providerId) {
        const search = currentBackend.effectiveSearch()
        return {
          endpoint: currentBackend.effective(),
          search: {
            mode: search.mode,
            model: search.model,
            maxUses: search.maxUses,
            timeoutMs: currentBackend.searchTimeoutMs,
          },
        }
      }
      const search = effectiveSearch()
      return {
        endpoint: effective(),
        search: {
          mode: search.mode,
          model: search.model,
          maxUses: search.maxUses,
          timeoutMs: cfg.searchTimeoutMs,
        },
      }
    },
    onRegisteredChange: (registered) => {
      searchRegistered = registered
    },
  })

  const maybeEffect = (ctx as { effect?: PluginContext['effect'] }).effect
  if (typeof maybeEffect === 'function') {
    maybeEffect.call(ctx, () => () => {
      catalog.stop()
    })
  }
  return { ready }
}

export { MagpieAdapter } from './adapter/magpie-adapter.ts'
export { ModelCatalog } from './adapter/catalog.ts'
export {
  MagpieSearchProvider,
  MagpieSearchError,
  mapAnthropicSearchResponse,
  parseMagpieMcpSearchText,
  searchViaMagpieMcp,
  searchViaMagpieModel,
} from './search.ts'
export {
  SettingsStore,
  isConfigured,
  resolveEffectiveEndpoint,
  resolveEffectiveSearchSettings,
  type MagpieSearchMode,
} from './settings.ts'
export {
  resolveConfig,
  type DshMagpieConnectConfig,
} from './config.ts'
