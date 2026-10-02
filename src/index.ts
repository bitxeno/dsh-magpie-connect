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
}

export const name = 'dsh-magpie-connect'
export const inject = ['llm'] as const

/** Browser-facing REST root for the settings page (served under the shared /api channel). */
export const SETTINGS_API = '/api/magpie-settings'
export const MODELS_API = '/api/magpie-models'
export const TEST_API = '/api/magpie-test'

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

  const catalog = new ModelCatalog({
    baseUrl: effective().baseUrl,
    refreshSeconds: cfg.refreshSeconds,
    cachePath: defaultCachePath(dataDir),
    onRefresh: (status, lastError) => {
      writeStatus(status, lastError)
      if (lastError) logger.warn(`dsh-magpie-connect: catalog refresh issue: ${lastError}`)
    },
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

  // Browser-facing REST for the settings page. Registered on
  // `ctx.connection.fetch` (authenticated /api channel) — never on the raw
  // webServer route, which has no trust policy.
  try {
    if (typeof ctx.inject === 'function') {
      ctx.inject(['connection'], (cctx: Record<string, unknown>) => {
        const connection = cctx.connection as
          | { fetch?: { register?: (route: { path: string; methods: string[]; requestBody: string; fetch: (request: Request) => Promise<Response> }) => () => void | Promise<void> } }
          | undefined
        const register = connection?.fetch?.register
        if (typeof register !== 'function') return
        const json = (status: number, payload: unknown): Response =>
          new Response(JSON.stringify(payload), {
            status,
            headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
          })
        const ok = (value: unknown): Response => json(200, { ok: true, value })
        const fail = (error: unknown): Response =>
          json(500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        const readBody = async (request: Request): Promise<unknown> => {
          try {
            return await request.json()
          } catch {
            return {}
          }
        }
        const modelRows = (): Array<{
          id: string
          displayName: string
          contextWindow?: number
          maxTokens?: number
          image: boolean
          responsesOnly: boolean
          reasoning: boolean
          efforts: string[]
          hidden: boolean
        }> => {
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
        const disposers: Array<() => void | Promise<void>> = [
          register({
            path: SETTINGS_API,
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async () => {
              try {
                const page = store.get()
                const endpoint = resolveEffectiveEndpoint(patchEndpoint, page)
                return ok({
                  baseUrl: endpoint.baseUrl,
                  apiKey: endpoint.apiKey,
                  hiddenModels: page.hiddenModels ?? [],
                  fromPage: page,
                  fromPatch: patchEndpoint,
                })
              } catch (error) {
                return fail(error)
              }
            },
          }),
          register({
            path: SETTINGS_API,
            methods: ['POST'],
            requestBody: 'buffered',
            fetch: async (request: Request) => {
              try {
                const saved = await store.save(normalizePageSettings(await readBody(request)))
                applyPageSettings()
                const endpoint = resolveEffectiveEndpoint(patchEndpoint, saved)
                return ok({ baseUrl: endpoint.baseUrl, apiKey: endpoint.apiKey, hiddenModels: saved.hiddenModels ?? [] })
              } catch (error) {
                return fail(error)
              }
            },
          }),
          register({
            path: MODELS_API,
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async () => {
              try {
                return ok({ models: modelRows(), snapshot: catalog.snapshot() })
              } catch (error) {
                return fail(error)
              }
            },
          }),
          register({
            path: TEST_API,
            methods: ['POST'],
            requestBody: 'buffered',
            fetch: async (request: Request) => {
              try {
                const body = (await readBody(request)) as { baseUrl?: unknown; apiKey?: unknown }
                const origin = normalizeBaseUrl(body.baseUrl ?? effective().baseUrl)
                const rawKey = typeof body.apiKey === 'string' ? body.apiKey : effective().apiKey
                const key = rawKey.trim()
                if (key === '') throw new Error('dsh-magpie-connect: apiKey is required — fill it in before testing')
                const authedFetch: typeof fetch = (url, init) =>
                  fetch(url, {
                    ...init,
                    headers: { ...((init?.headers as Record<string, string> | undefined) ?? {}), authorization: `Bearer ${key}` },
                  })
                const models = await fetchMagpieModels(origin, authedFetch)
                return ok({ count: models.size, models: [...models.keys()].sort().slice(0, 50) })
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                // A 404 from the gateway almost always means the origin path is
                // wrong or the key is unknown/unauthorized (many gateways hide
                // existence behind 404 instead of 401).
                const hinted =
                  /HTTP 404/.test(message) && !/网关返回 404/.test(message)
                    ? `${message}（网关返回 404：多为 API 地址路径不对，或该 Key 无效/无权访问）`
                    : message
                return fail(hinted)
              }
            },
          }),
        ]
        return async () => {
          for (const dispose of disposers.reverse()) await dispose()
        }
      })
    }
  } catch (error) {
    logger.warn(`dsh-magpie-connect: settings API unavailable: ${error instanceof Error ? error.message : String(error)}`)
  }

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
