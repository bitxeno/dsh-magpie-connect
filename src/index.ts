import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'

import { ModelCatalog, defaultCachePath, type CatalogSnapshot } from './adapter/catalog.ts'
import { MagpieAdapter } from './adapter/magpie-adapter.ts'
import type { AttachmentStore } from './adapter/messages.ts'
import { resolveConfig, type DshMagpieConnectConfig } from './config.ts'

/**
 * dsh-magpie-connect DSH cordis plugin entry.
 *
 * Registers a DSH LlmAdapter streaming directly from the Magpie LAN gateway
 * (marketplace shape: no child process, no binary, no proxy, no API key).
 * The model catalog warms up in the background (live gateway list with disk
 * cache + static snapshot fallback).
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
  effect?(fn: () => () => void): unknown
  on?(event: string, listener: (...args: never[]) => unknown): () => void
}

export const name = 'dsh-magpie-connect'
export const inject = ['llm'] as const

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

  const dataDir = join(homedir(), '.dsh-magpie-connect')
  const statusPath = join(dataDir, 'adapter-status.json')
  const writeStatus = (status: CatalogSnapshot, lastError: string): void => {
    void writeFile(
      statusPath,
      JSON.stringify({ ...status, lastError, writtenAt: new Date().toISOString() }, null, 2),
      'utf8',
    ).catch(() => {})
  }

  const catalog = new ModelCatalog({
    baseUrl: cfg.baseUrl,
    refreshSeconds: cfg.refreshSeconds,
    cachePath: defaultCachePath(dataDir),
    onRefresh: (status, lastError) => {
      writeStatus(status, lastError)
      if (lastError) logger.warn(`dsh-magpie-connect: catalog refresh issue: ${lastError}`)
    },
  })
  const adapter = new MagpieAdapter(catalog, {
    providerId: cfg.providerId,
    displayName: cfg.displayName,
    magpieBaseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    maxRetries: cfg.maxRetries,
    timeoutMs: cfg.timeoutMs,
    firstEventTimeoutMs: cfg.firstEventTimeoutMs,
    idleTimeoutMs: cfg.idleTimeoutMs,
    resolveAttachments: () => {
      try {
        const attachments = typeof ctx.get === 'function' ? (ctx.get('attachments') as AttachmentStore | undefined) : undefined
        return attachments && typeof attachments.readImageRequest === 'function' ? attachments : undefined
      } catch {
        return undefined
      }
    },
  })

  // Register immediately: the provider must appear in the selector right
  // away, even while the catalog is still warming up (listModels is read
  // live at selector time, so models appear as refreshes land).
  ctx.llm.registerAdapter([cfg.providerId], adapter)
  logger.info(`dsh-magpie-connect: adapter registered for "${cfg.providerId}" (catalog warms up in background)`)
  void catalog.start().catch((err) => {
    logger.error(`dsh-magpie-connect: catalog start failed: ${err instanceof Error ? err.message : String(err)}`)
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
  resolveConfig,
  type DshMagpieConnectConfig,
} from './config.ts'
