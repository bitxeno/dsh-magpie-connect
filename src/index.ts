import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'

import {
  ModelCatalog,
  defaultCachePath,
  fetchMagpieModels,
  type CatalogSnapshot,
} from './adapter/catalog.ts'
import { MagpieAdapter } from './adapter/magpie-adapter.ts'
import type { AttachmentStore } from './adapter/messages.ts'
import { resolveConfig, type DshMagpieConnectConfig } from './config.ts'
import {
  SettingsStore,
  defaultSettingsPath,
  isConfigured,
  normalizeBaseUrl,
  normalizePageSettings,
  resolveEffectiveEndpoint,
} from './settings.ts'

/**
 * dsh-magpie-connect DSH cordis plugin entry.
 *
 * Registers a DSH LlmAdapter streaming directly from the Magpie LAN gateway
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

/** Backend generation behind the shared settings routes (newest wins). */
export interface SettingsBackend {
  store: SettingsStore
  catalog: ModelCatalog
  patchEndpoint: { baseUrl: string; apiKey: string }
  effective: () => { baseUrl: string; apiKey: string }
  applyPageSettings: () => void
}

type FetchRegister = (route: {
  path: string
  methods: string[]
  requestBody: string
  fetch: (request: Request) => Promise<Response>
}) => () => void | Promise<void>

interface ModelRow {
  id: string
  displayName: string
  contextWindow?: number
  maxTokens?: number
  image: boolean
  responsesOnly: boolean
  reasoning: boolean
  efforts: string[]
  hidden: boolean
}

let currentBackend: SettingsBackend | null = null
let liveRouteSets = 0
let routeDisposers: Array<() => void | Promise<void>> | null = null

/** @internal Test hook: forget installed routes so the next apply reinstalls. */
export function __resetSettingsRoutes(): void {
  currentBackend = null
  liveRouteSets = 0
  routeDisposers = null
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

function buildModelRows(backend: SettingsBackend): ModelRow[] {
  const { store, catalog } = backend
  const hidden = new Set(store.get().hiddenModels ?? [])
  const ids = new Set<string>([...catalog.list(), ...hidden])
  return [...ids].sort().map((id) => {
    const entry = catalog.getEntry(id)
    const endpoints = entry?.nativeEndpoints ?? []
    const responsesOnly =
      endpoints.length > 0
        ? !endpoints.some((endpoint) => endpoint.includes('/chat/completions')) && endpoints.some((endpoint) => endpoint.includes('/responses'))
        : false
    return {
      id,
      displayName: entry?.displayName ?? id,
      ...(entry?.contextWindow !== undefined ? { contextWindow: entry.contextWindow } : {}),
      ...(entry?.maxTokens !== undefined ? { maxTokens: entry.maxTokens } : {}),
      image: entry?.image ?? false,
      responsesOnly,
      reasoning: entry?.reasoning ?? false,
      efforts: entry?.efforts ?? [],
      hidden: hidden.has(id),
    }
  })
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

async function handleSettingsGet(): Promise<Response> {
  try {
    const backend = backendOrThrow()
    const page = backend.store.get()
    const endpoint = resolveEffectiveEndpoint(backend.patchEndpoint, page)
    return routeOk({
      baseUrl: endpoint.baseUrl,
      apiKey: endpoint.apiKey,
      hiddenModels: page.hiddenModels ?? [],
      fromPage: page,
      fromPatch: backend.patchEndpoint,
    })
  } catch (error) {
    return routeFail(error)
  }
}

async function handleSettingsPost(request: Request): Promise<Response> {
  try {
    const backend = backendOrThrow()
    const body = await readRouteBody(request)
    const saved = await backend.store.save(normalizePageSettings(body))
    backend.applyPageSettings()
    const endpoint = resolveEffectiveEndpoint(backend.patchEndpoint, saved)
    return routeOk({ baseUrl: endpoint.baseUrl, apiKey: endpoint.apiKey, hiddenModels: saved.hiddenModels ?? [] })
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

async function handleTestPost(request: Request): Promise<Response> {
  try {
    const backend = backendOrThrow()
    const effective = backend.effective()
    const body = (await readRouteBody(request)) as { baseUrl?: unknown; apiKey?: unknown }
    const origin = normalizeBaseUrl(body.baseUrl ?? effective.baseUrl)
    const rawKey = typeof body.apiKey === 'string' ? body.apiKey : effective.apiKey
    const key = rawKey.trim()
    if (key === '') throw new Error('dsh-magpie-connect: apiKey is required — fill it in before testing')
    const models = await fetchMagpieModels(origin, fetch, { headers: { authorization: `Bearer ${key}` } })
    return routeOk({ count: models.size, models: [...models.keys()].sort().slice(0, 50) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // A 404 from the gateway almost always means the origin path is
    // wrong or the key is unknown/unauthorized (many gateways hide
    // existence behind 404 instead of 401).
    const hinted =
      /HTTP 404/.test(message) && !/网关返回 404/.test(message)
        ? `${message}（网关返回 404：多为 API 地址路径不对，或该 Key 无效/无权访问）`
        : message
    return routeFail(hinted)
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

  const store = new SettingsStore({ path: defaultSettingsPath(dataDir) })
  const patchEndpoint = { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey }
  const effective = () => resolveEffectiveEndpoint(patchEndpoint, store.get())

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
    refreshSeconds: cfg.refreshSeconds,
    cachePath: defaultCachePath(dataDir),
    onRefresh: (status, lastError) => {
      writeStatus(status, lastError)
      if (lastError) logger.warn(`dsh-magpie-connect: catalog refresh issue: ${lastError}`)
    },
    onInvalidate: announceTopology,
  })
  /** Apply page settings to the live catalog + adapter (no restart needed). */
  const applyPageSettings = (): void => {
    const page = store.get()
    const endpoint = resolveEffectiveEndpoint(patchEndpoint, page)
    // The gate: URL and key are both required. Anything missing clears the
    // catalog origin, which empties the picker and fails calls fast.
    const catalogOrigin = isConfigured(endpoint) ? endpoint.baseUrl.replace(/\/+$/, '') : ''
    if (catalog.baseUrl !== catalogOrigin) {
      catalog.setBaseUrl(catalogOrigin)
      if (catalogOrigin !== '') {
        void catalog.refreshOnce().catch((err) => {
          logger.warn(`dsh-magpie-connect: catalog refresh after endpoint change failed: ${err instanceof Error ? err.message : String(err)}`)
        })
      }
    }
    catalog.setHidden(page.hiddenModels ?? [])
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
    await store.load()
    applyPageSettings()
    await catalog.start().catch((err) => {
      logger.error(`dsh-magpie-connect: catalog start failed: ${err instanceof Error ? err.message : String(err)}`)
    })
  })().catch((err) => {
    logger.error(`dsh-magpie-connect: startup failed: ${err instanceof Error ? err.message : String(err)}`)
  })

  // Suppress the auto-generated config form: this plugin owns a dedicated
  // settings page (client half). Guarded — compositions without the settings
  // service simply skip it.
  try {
    if (typeof ctx.inject === 'function') {
      ctx.inject(['settings'], (settingsCtx: Record<string, unknown>) => {
        try {
          const scoped = settingsCtx as {
            effect?: (fn: () => unknown, label?: string) => unknown
            settings?: { configure?: (policy: unknown, fiber: unknown) => unknown }
          }
          const fiber = (ctx as unknown as Record<string, unknown>).fiber
          scoped.effect?.(() => scoped.settings?.configure?.({ auto: false }, fiber), 'dsh-magpie-connect: custom settings page')
        } catch {
          // presentation policy is best-effort
        }
      })
    }
  } catch {
    // presentation policy is best-effort
  }

  // Newest generation wins: shared route handlers below always resolve through
  // here, so the settings page talks to the latest store/catalog/adapter even
  // when an older generation installed the routes.
  currentBackend = { store, catalog, patchEndpoint, effective, applyPageSettings }

  installSettingsRoutes(ctx, logger)

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
export { SettingsStore, isConfigured, resolveEffectiveEndpoint } from './settings.ts'
export {
  resolveConfig,
  type DshMagpieConnectConfig,
} from './config.ts'
