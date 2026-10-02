import { readFile, rename, rm, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Model directory for the Magpie LAN gateway.
 *
 * Single source: `GET {baseUrl}/v1/models` already curates the servable set
 * with full per-model metadata (modalities, native endpoints, reasoning
 * ladders, context limits). There is no paid/free filter — everything listed
 * is exposed. A disk cache plus a compile-time static snapshot covers gateway
 * outages (the plugin still registers, the picker still lists).
 */

/** Conventional LAN origin (example value, not a default — empty means unconfigured). */
export const MAGPIE_DEFAULT_BASE_URL = 'http://api.lan'

export interface MagpieModelEntry {
  id: string
  displayName: string
  contextWindow?: number
  maxTokens?: number
  /** Whether the gateway accepts image input for this model. */
  image: boolean
  /** Raw gateway `native_endpoints` (may be empty when undisclosed). */
  nativeEndpoints: string[]
  /** Whether the gateway reports thinking support. */
  reasoning: boolean
  /** Effort allowlist from `supported_reasoning_levels` (canonical order). */
  efforts?: string[]
}

/**
 * Thinking levels the gateway uses. pi-ai natively understands the minimal→max
 * ladder; `none` (thinking disabled) and `ultra` (beyond max, e.g. Terra) are
 * gateway extensions the adapter forwards verbatim on the Responses /
 * completions wire instead of clamping.
 */
export const KNOWN_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export const EXTENDED_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const

export type KnownEffort = (typeof KNOWN_EFFORTS)[number]
export type ExtendedEffort = (typeof EXTENDED_EFFORTS)[number]

/** Picker display order: `none` (disable) first, then increasing strength. */
const EFFORT_ORDER: readonly string[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']

const EFFORT_LABELS: Record<string, { name: string; description: string }> = {
  none: { name: 'None', description: '关闭思考，直接回答' },
  minimal: { name: 'Minimal', description: '最少思考，最快' },
  low: { name: 'Low', description: '轻量思考，适合简单问答' },
  medium: { name: 'Medium', description: '默认档位，均衡质量与速度' },
  high: { name: 'High', description: '深度思考，适合复杂编码' },
  xhigh: { name: 'Extra high', description: '超高思考强度' },
  max: { name: 'Max', description: '最强思考（pi-ai 档位），最慢' },
  ultra: { name: 'Ultra', description: '极限思考（网关直通），最慢最贵' },
}

export interface ReasoningEffortChoice {
  id: string
  name: string
  description?: string
}

/** Normalize one gateway effort spelling; unknown spellings are dropped. */
export function normalizeEffort(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const level = raw.trim().toLowerCase()
  return (EFFORT_ORDER as readonly string[]).includes(level) ? level : undefined
}

/** Canonicalize an effort list: keep known spellings, dedupe, order canonically. */
export function canonicalEfforts(values: readonly unknown[] | undefined): string[] | undefined {
  if (!Array.isArray(values)) return undefined
  const out: string[] = []
  for (const value of values) {
    const level = normalizeEffort(typeof value === 'object' && value !== null ? (value as { effort?: unknown }).effort ?? value : value)
    if (level !== undefined && !out.includes(level)) out.push(level)
  }
  if (out.length === 0) return undefined
  return EFFORT_ORDER.filter((level) => out.includes(level))
}

/** Build picker efforts for an allowlist (display order = none→minimal→…→ultra). */
export function effortsFor(efforts: readonly string[] | undefined): ReasoningEffortChoice[] {
  const allowed = new Set(efforts ?? [])
  return EFFORT_ORDER.filter((level) => allowed.has(level)).map((level) => {
    const label = EFFORT_LABELS[level] ?? { name: level, description: '' }
    return { id: level, name: label.name, description: label.description }
  })
}

/**
 * pi-ai `thinkingLevelMap` for an effort allowlist. `off: null` is
 * load-bearing: without it pi-ai falls back to `reasoning.effort: 'none'`
 * on the Responses lane, which the gateway rejects with 400. Every
 * non-listed known level maps to null so `getSupportedThinkingLevels` hides
 * it and `clampThinkingLevel` folds stale values to the nearest listed one.
 * Gateway extensions (`none`/`ultra`) never enter the map — the adapter
 * forwards them via `provider.stream` instead of `streamSimple`.
 */
export function thinkingLevelMapFor(efforts: readonly string[] | undefined): Record<string, string | null> {
  const allowed = new Set(efforts ?? [])
  const map: Record<string, string | null> = { off: null }
  for (const level of KNOWN_EFFORTS) map[level] = allowed.has(level) ? level : null
  return map
}

/**
 * True when the model must go through `/v1/responses` instead of chat
 * completions: the gateway lists responses as the only native endpoint
 * (Muse Spark, Codex/Grok lanes). Anything advertising
 * `/v1/chat/completions` — including multi-endpoint models — rides the
 * completions lane for better tool support.
 */
export function requiresResponsesApiEntry(nativeEndpoints: readonly string[]): boolean {
  const hasCompletions = nativeEndpoints.some((endpoint) => endpoint.includes('/chat/completions'))
  if (hasCompletions) return false
  return nativeEndpoints.some((endpoint) => endpoint.includes('/responses'))
}

/** pi-ai `model.api` value for the given native endpoints. */
export function modelApiForEntry(nativeEndpoints: readonly string[]): 'openai-completions' | 'openai-responses' {
  return requiresResponsesApiEntry(nativeEndpoints) ? 'openai-responses' : 'openai-completions'
}

/** Decode one gateway model object into a catalog entry. */
export function decodeModel(raw: unknown): MagpieModelEntry | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  const id = record.id
  if (typeof id !== 'string' || id.length === 0) return undefined
  const num = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
  const displayName =
    (typeof record.display_name === 'string' && record.display_name) ||
    (typeof record.magpie_label === 'string' && record.magpie_label) ||
    id
  const contextWindow = num(record.context_window) ?? num(record.context_length) ?? num(record.max_input_tokens)
  const maxTokens = num(record.max_output_tokens)
  const modalities = record.modalities as { input?: unknown } | undefined
  const inputModalities = Array.isArray(modalities?.input) ? modalities.input.map(String).map((s) => s.toLowerCase()) : []
  const image = inputModalities.includes('image')
  const nativeEndpoints = Array.isArray(record.native_endpoints)
    ? (record.native_endpoints as unknown[]).filter((e): e is string => typeof e === 'string')
    : []
  const reasoning = record.reasoning === true
  const levels = record.supported_reasoning_levels
  const efforts = Array.isArray(levels)
    ? canonicalEfforts(levels.map((entry) => (entry as { effort?: unknown })?.effort ?? entry))
    : undefined
  return { id, displayName, ...(contextWindow !== undefined ? { contextWindow } : {}), ...(maxTokens !== undefined ? { maxTokens } : {}), image, nativeEndpoints, reasoning, ...(efforts !== undefined ? { efforts } : {}) }
}

/** Decode the full gateway `/v1/models` payload into entries keyed by id. */
export function decodeMagpieModels(data: unknown): Map<string, MagpieModelEntry> {
  const result = new Map<string, MagpieModelEntry>()
  if (!data || typeof data !== 'object') return result
  const payload = data as { data?: unknown }
  if (!Array.isArray(payload.data)) return result
  for (const raw of payload.data) {
    const entry = decodeModel(raw)
    if (entry && !result.has(entry.id)) result.set(entry.id, entry)
  }
  return result
}

/**
 * Compile-time static snapshot (observed 2026-10-02, 22 models): last-resort
 * bootstrap while the gateway is unreachable. Refreshed by hand when the
 * gateway catalog changes shape; live data always wins when reachable.
 */
export const staticMagpieModels: MagpieModelEntry[] = [
  { id: 'group/auto-gpt-4-1', displayName: 'GPT-4.1', contextWindow: 1047576, maxTokens: 32768, image: true, nativeEndpoints: [], reasoning: false },
  { id: 'group/auto-gpt-6-luna', displayName: 'GPT-6-Luna', contextWindow: 272000, maxTokens: 128000, image: true, nativeEndpoints: [], reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'vercel/xiaomi/mimo-v2.6-flash', displayName: 'xiaomi/mimo-v2.6-flash', contextWindow: 1048576, maxTokens: 131072, image: true, nativeEndpoints: ['/v1/chat/completions'], reasoning: true },
  { id: 'vercel/alibaba/qwen3.8-omni-flash', displayName: 'alibaba/qwen3.8-omni-flash', contextWindow: 1000000, maxTokens: 131072, image: true, nativeEndpoints: ['/v1/chat/completions'], reasoning: true, efforts: ['none', 'low', 'medium', 'xhigh'] },
  { id: 'vercel/openai/gpt-5.4-nano', displayName: 'openai/gpt-5.4-nano', contextWindow: 272000, maxTokens: 128000, image: true, nativeEndpoints: ['/v1/chat/completions'], reasoning: true, efforts: ['none', 'low', 'medium', 'high', 'xhigh'] },
  { id: 'vercel/openai/gpt-4.1', displayName: 'openai/gpt-4.1', contextWindow: 1047576, maxTokens: 32768, image: true, nativeEndpoints: ['/v1/chat/completions'], reasoning: false },
  { id: 'vercel/google/gemini-2.5-flash-lite', displayName: 'google/gemini-2.5-flash-lite', contextWindow: 1048576, maxTokens: 65536, image: true, nativeEndpoints: ['/v1/chat/completions'], reasoning: true, efforts: ['low', 'medium', 'high'] },
  { id: 'opencode-zen/muse-spark-1.3-contributor-free', displayName: 'Muse Spark 1.3 Free', contextWindow: 1048576, maxTokens: 131072, image: true, nativeEndpoints: ['/v1/responses'], reasoning: true, efforts: ['minimal', 'low', 'medium', 'high', 'xhigh'] },
  { id: 'opencode-zen/jev-1.13-free', displayName: 'jev-1.13-free', image: false, nativeEndpoints: ['/v1/chat/completions', '/v1/responses', '/v1/messages'], reasoning: false },
  { id: 'opencode-zen/mimo-v2.6-flash-free', displayName: 'MiMo-V2.6-Flash Free', contextWindow: 200000, maxTokens: 32000, image: true, nativeEndpoints: ['/v1/chat/completions', '/v1/responses', '/v1/messages'], reasoning: true },
  { id: 'opencode-zen/space-bunny-free', displayName: 'Space Bunny Free', contextWindow: 524288, maxTokens: 524288, image: true, nativeEndpoints: ['/v1/chat/completions', '/v1/responses', '/v1/messages'], reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'codex/gpt-6-luna', displayName: 'GPT-6-Luna', contextWindow: 272000, maxTokens: 128000, image: true, nativeEndpoints: ['/v1/responses'], reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'codex/gpt-5.6-terra', displayName: 'GPT-5.6-Terra', contextWindow: 272000, maxTokens: 128000, image: true, nativeEndpoints: ['/v1/responses'], reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] },
  { id: 'codex/gpt-5.6-luna', displayName: 'GPT-5.6-Luna', contextWindow: 272000, maxTokens: 128000, image: true, nativeEndpoints: ['/v1/responses'], reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'codex/gpt-5.5', displayName: 'GPT-5.5', contextWindow: 272000, maxTokens: 128000, image: true, nativeEndpoints: ['/v1/responses'], reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh'] },
  { id: 'copilot/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', contextWindow: 1048576, maxTokens: 65536, image: true, nativeEndpoints: ['/v1/chat/completions'], reasoning: true, efforts: ['low', 'medium', 'high'] },
  { id: 'copilot/grok-4.7', displayName: 'grok-4.7', contextWindow: 500000, maxTokens: 500000, image: true, nativeEndpoints: ['/v1/responses'], reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh'] },
  { id: 'copilot/gpt-4.1', displayName: 'gpt-4.1', contextWindow: 1047576, maxTokens: 32768, image: true, nativeEndpoints: ['/v1/chat/completions', '/v1/responses', '/v1/messages'], reasoning: false },
  { id: 'copilot/gpt-6-luna', displayName: 'gpt-6-luna', contextWindow: 922000, maxTokens: 128000, image: true, nativeEndpoints: ['/v1/responses'], reasoning: true, efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'copilot/claude-sonnet-5.5', displayName: 'claude-sonnet-5.5', contextWindow: 1000000, maxTokens: 128000, image: true, nativeEndpoints: ['/v1/chat/completions', '/v1/messages'], reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'workbuddy-ai/hy4-preview-f', displayName: 'hy4-preview-f', contextWindow: 1000000, maxTokens: 64000, image: true, nativeEndpoints: ['/v1/chat/completions'], reasoning: true, efforts: ['high'] },
  { id: 'workbuddy-ai/deepseek-v4.1-flash', displayName: 'deepseek-v4.1-flash', contextWindow: 1000000, maxTokens: 128000, image: true, nativeEndpoints: ['/v1/chat/completions'], reasoning: true, efforts: ['low', 'high', 'max'] },
]

export interface CatalogSnapshot {
  status: 'pending' | 'ready' | 'stale' | 'error'
  total: number
  exposed: number
  lastRefresh?: string
}

export interface CatalogOptions {
  /** Refresh cadence (seconds). */
  refreshSeconds?: number
  /** Where the gateway snapshot cache lives (plugin data dir). */
  cachePath?: string
  /** Gateway origin override for tests. */
  baseUrl?: string
  fetchImpl?: typeof fetch
  now?: () => number
  /** Observability hook: fired after every refresh round. */
  onRefresh?: (status: CatalogSnapshot, lastError: string) => void
  /**
   * Fired when the exposed model set actually changes. DSH's picker caches
   * one `modelCatalog()` read per Host generation and only re-reads it on
   * `llm/adapters-updated`, so a pure in-memory change (hidden models, a
   * refresh that added or dropped models) is invisible without this.
   */
  onInvalidate?: () => void
  /** Delay between startup retries while the live catalog is empty (default 15s). */
  startupRetryMs?: number
}

const FETCH_TIMEOUT_MS = 30_000

/** Live model directory with refresh loop. All state in-memory; only the gateway snapshot persists. */
export class ModelCatalog {
  #entries: Map<string, MagpieModelEntry> = new Map()
  #hidden: Set<string> = new Set()
  #updatedAt = 0
  #lastError = ''
  #refreshSeconds: number
  #cachePath?: string
  #baseUrl: string
  #fetch: typeof fetch
  #now: () => number
  #timer: NodeJS.Timeout | null = null
  #stopped = false
  #onRefresh?: (status: CatalogSnapshot, lastError: string) => void
  #onInvalidate?: () => void
  #startupRetryMs: number
  /**
   * Last announced exposed set. The picker caches its catalog read, so an
   * invalidation is only worth a Host event when the exposed ids really
   * moved — otherwise the refresh loop would emit every 5 minutes.
   */
  #announced = ''

  constructor(options: CatalogOptions = {}) {
    this.#refreshSeconds = options.refreshSeconds ?? 300
    this.#cachePath = options.cachePath
    this.#baseUrl = (options.baseUrl ?? '').replace(/\/+$/, '')
    this.#fetch = options.fetchImpl ?? fetch
    this.#now = options.now ?? Date.now
    this.#onRefresh = options.onRefresh
    this.#onInvalidate = options.onInvalidate
    this.#startupRetryMs = options.startupRetryMs ?? 15_000
  }

  /**
   * Start the refresh loop: immediate fetch, fast retries while the live
   * catalog is still empty (the first fetch often races the machine's
   * network coming up), then the normal cadence.
   */
  async start(): Promise<void> {
    await this.refreshOnce()
    let attempts = 0
    while (this.#entries.size === 0 && attempts < 4 && !this.#stopped) {
      attempts += 1
      await new Promise((resolve) => setTimeout(resolve, this.#startupRetryMs))
      if (this.#stopped) return
      await this.refreshOnce()
    }
    if (this.#stopped) return
    this.#timer = setInterval(() => {
      void this.refreshOnce()
    }, this.#refreshSeconds * 1000)
    this.#timer.unref?.()
  }

  stop(): void {
    this.#stopped = true
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }
  }

  async refreshOnce(): Promise<void> {
    await this.refreshModels()
    if (this.#onRefresh) {
      try {
        this.#onRefresh(this.snapshot(), this.#lastError)
      } catch {
        // observers must never break the refresh loop
      }
    }
    // A refresh can add or drop models: tell the picker to re-read.
    this.#announce()
  }

  /**
   * Announce the exposed set when it changed.
   *
   * DSH's browser-side model directory caches one `modelCatalog()` read per
   * Host generation and only re-reads it on `llm/adapters-updated`, so
   * in-memory catalog mutations (hidden models, a refresh that moved the
   * list) are otherwise invisible until restart. Firing the event on every
   * refresh would also work but wakes the whole picker every 5 minutes, so
   * the exposed ids are fingerprinted and only a real change is announced.
   */
  #announce(): void {
    const fingerprint = this.#fingerprint()
    if (fingerprint === this.#announced) return
    this.#announced = fingerprint
    if (!this.#onInvalidate) return
    try {
      this.#onInvalidate()
    } catch {
      // observers must never break the refresh loop
    }
  }

  /** Stable fingerprint of the exposed set (ids + their capabilities). */
  #fingerprint(): string {
    const rows = this.list().map((id) => {
      const entry = this.#entryFor(id)
      return [
        id,
        entry?.displayName ?? '',
        entry?.image === true ? 'img' : '-',
        entry?.reasoning === true ? 'think' : '-',
        (entry?.efforts ?? []).join(','),
        String(entry?.contextWindow ?? 0),
        String(entry?.maxTokens ?? 0),
      ].join('|')
    })
    return rows.join('\n')
  }

  /** Whether a gateway origin is configured (empty baseUrl = not configured). */
  get configured(): boolean {
    return this.#baseUrl !== ''
  }

  async refreshModels(): Promise<void> {
    if (!this.configured) {
      this.#lastError = 'magpie gateway baseUrl is not configured — set it on the Magpie settings page'
      return
    }
    try {
      const entries = await fetchMagpieModels(this.#baseUrl, this.#fetch)
      this.#entries = entries
      this.#updatedAt = this.#now()
      this.#lastError = ''
      if (this.#cachePath) await saveModelsCache(this.#cachePath, entries, this.#now()).catch(() => {})
    } catch (err) {
      // Network failure with a cached copy is not fatal: load the cache.
      if (this.#cachePath && this.#entries.size === 0) {
        const cached = await loadModelsCache(this.#cachePath).catch(() => null)
        if (cached && cached.size > 0) {
          this.#entries = cached
          this.#updatedAt = this.#updatedAt === 0 ? this.#now() : this.#updatedAt
          return
        }
      }
      this.#lastError = err instanceof Error ? err.message : String(err)
    }
  }

  getEntry(model: string): MagpieModelEntry | undefined {
    return this.#entries.get(model)
  }

  /**
   * Replace the settings-page hidden set (models excluded from the picker).
   * Announces: hiding/showing models changes the exposed list, and DSH's
   * picker only re-reads it on `llm/adapters-updated`.
   */
  setHidden(ids: readonly string[]): void {
    const next = new Set(ids)
    if (next.size === this.#hidden.size && [...next].every((id) => this.#hidden.has(id))) return
    this.#hidden = next
    this.#announce()
  }

  /** Currently hidden model ids. */
  hidden(): string[] {
    return [...this.#hidden]
  }

  isHidden(model: string): boolean {
    return this.#hidden.has(model)
  }

  /** Point the refresh loop at another gateway origin (settings page change). */
  setBaseUrl(baseUrl: string): void {
    const origin = baseUrl.replace(/\/+$/, '')
    if (origin === this.#baseUrl) return
    this.#baseUrl = origin
    // Drop entries from the previous origin: the picker must not serve a
    // stale directory, and clearing unconfigured state must empty it.
    this.#entries = new Map()
    this.#updatedAt = 0
    this.#lastError = origin === '' ? 'magpie gateway baseUrl is not configured — set it on the Magpie settings page' : ''
    // The picker must not keep serving the previous origin's directory.
    this.#announce()
  }

  get baseUrl(): string {
    return this.#baseUrl
  }

  decision(model: string): { allowed: boolean; source: string; known: boolean } {
    if (!this.configured) return { allowed: false, source: 'unconfigured', known: false }
    if (this.#hidden.has(model)) return { allowed: false, source: 'hidden_by_settings', known: true }
    if (this.#entries.has(model)) return { allowed: true, source: 'gateway', known: true }
    const fallback = staticMagpieModels.find((entry) => entry.id === model)
    if (fallback) return { allowed: true, source: 'static_verified', known: false }
    return { allowed: false, source: this.#entries.size === 0 ? 'gateway_pending' : 'gateway_unknown', known: false }
  }

  /** Entry lookup: live map first, static snapshot while configured (never unconfigured). */
  #entryFor(model: string): MagpieModelEntry | undefined {
    if (!this.configured) return undefined
    return this.#entries.get(model) ?? staticMagpieModels.find((candidate) => candidate.id === model)
  }

  /**
   * Reasoning capability for one model id (DSH `resolveModel().reasoning`
   * + pi-ai `thinkingLevelMap` source of truth). Ladder-less thinking models
   * (reasoning without an effort list) think with upstream defaults — see
   * `thinks()` — and expose no picker.
   */
  reasoningFor(model: string): { efforts: ReasoningEffortChoice[]; defaultEffort: string } | undefined {
    const entry = this.#entryFor(model)
    const efforts = entry?.efforts
    if (!entry?.reasoning) return undefined
    if (efforts !== undefined && efforts.length > 0) {
      const mid = efforts[Math.floor(efforts.length / 2)] ?? 'medium'
      return { efforts: effortsFor(efforts), defaultEffort: efforts.includes('medium') ? 'medium' : mid }
    }
    return undefined
  }

  /** Whether the wire model may think (pi-ai `reasoning: true`). */
  thinks(model: string): boolean {
    const entry = this.#entryFor(model)
    return entry?.reasoning ?? false
  }

  /** Whether the model accepts image input. */
  supportsImage(model: string): boolean {
    const entry = this.#entryFor(model)
    return entry?.image ?? false
  }

  /** Whether one effort id is selectable for the model. */
  supportsEffort(model: string, effort: string): boolean {
    const entry = this.#entryFor(model)
    if (!entry?.reasoning) return false
    if (!entry.efforts || entry.efforts.length === 0) return true // ladder-less: upstream accepts, picker hidden
    return entry.efforts.includes(effort)
  }

  requiresResponsesApi(model: string): boolean {
    const entry = this.#entryFor(model)
    if (!entry) return /muse-spark|codex\/|grok/i.test(model)
    return requiresResponsesApiEntry(entry.nativeEndpoints)
  }

  contextWindowFor(model: string): number {
    return this.#entryFor(model)?.contextWindow ?? 262144
  }

  maxTokensFor(model: string): number {
    return this.#entryFor(model)?.maxTokens ?? 32768
  }

  /** ids exposed to DSH: live gateway list minus hidden (empty while unconfigured). */
  list(): string[] {
    if (!this.configured) return []
    if (this.#entries.size === 0) return staticMagpieModels.map((entry) => entry.id).filter((id) => !this.#hidden.has(id))
    return [...this.#entries.keys()].filter((id) => !this.#hidden.has(id)).sort()
  }

  /** Catalog health snapshot (pending/ready/stale + counts). */
  snapshot(): CatalogSnapshot {
    const age = this.#updatedAt === 0 ? Infinity : this.#now() - this.#updatedAt
    const stale = this.#updatedAt !== 0 && age > 10 * 60 * 1000
    return {
      status: this.#updatedAt === 0 ? 'pending' : stale ? 'stale' : 'ready',
      total: this.#entries.size,
      exposed: this.list().length,
      ...(this.#updatedAt !== 0 ? { lastRefresh: new Date(this.#updatedAt).toISOString() } : {}),
    }
  }

  get lastError(): string {
    return this.#lastError
  }
}

async function withTimeout(
  run: (signal: AbortSignal) => Promise<Response>,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await run(controller.signal)
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`models endpoint timed out after ${timeoutMs}ms`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch the live gateway model list. */
export async function fetchMagpieModels(
  baseUrl: string,
  fetchImpl: typeof fetch,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<Map<string, MagpieModelEntry>> {
  const response = await withTimeout(
    (signal) =>
      fetchImpl(`${baseUrl.replace(/\/+$/, '')}/v1/models`, {
        headers: { accept: 'application/json', ...(options.headers ?? {}) },
        signal,
      }),
    options.timeoutMs ?? FETCH_TIMEOUT_MS,
  )
  if (!response.ok) throw new Error(`models endpoint returned HTTP ${response.status}`)
  const payload = (await response.json()) as unknown
  const models = decodeMagpieModels(payload)
  if (models.size === 0) throw new Error('models endpoint returned an empty list')
  return models
}

interface ModelsCache {
  updatedAt: number
  entries: MagpieModelEntry[]
}

async function saveModelsCache(path: string, entries: Map<string, MagpieModelEntry>, now: number): Promise<void> {
  const cache: ModelsCache = { updatedAt: now, entries: [...entries.values()] }
  const tmp = `${path}.${process.pid}.tmp`
  await mkdir(dirname(path), { recursive: true })
  await writeFile(tmp, JSON.stringify(cache), 'utf8')
  await rm(path, { force: true })
  await rename(tmp, path)
}

async function loadModelsCache(path: string): Promise<Map<string, MagpieModelEntry>> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as ModelsCache
  if (Date.now() - raw.updatedAt > 7 * 24 * 60 * 60 * 1000) {
    throw new Error('gateway cache too old')
  }
  return new Map(raw.entries.map((entry) => [entry.id, entry]))
}

/** Default cache location next to the plugin data dir (index.ts convention). */
export function defaultCachePath(dataDir: string): string {
  return join(dataDir, 'magpie-models.json')
}
