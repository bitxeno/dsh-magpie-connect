import { createProvider, type Api, type Context, type Model } from '@earendil-works/pi-ai'
import * as openaiCompletions from '@earendil-works/pi-ai/api/openai-completions'
import * as openaiResponses from '@earendil-works/pi-ai/api/openai-responses'

import {
  ModelCatalog,
  modelApiForEntry,
  thinkingLevelMapFor,
} from './catalog.ts'
import { toStreamChunks, type HarnessChunk, type PiEvent } from './events.ts'
import {
  contentHasImage,
  toPiContext,
  toPiContextWithImages,
  type AttachmentStore,
  type HarnessGenerateOptions,
} from './messages.ts'
import { withStallTimeout } from './watchdog.ts'

/**
 * Magpie LAN gateway adapter: registers as a DSH LlmAdapter and streams
 * directly from the configured API root (e.g. `…/v1`) — chat completions for most models plus the
 * Responses API for responses-only models (Muse Spark / Codex / Grok lanes).
 *
 * Adapter contract: dsh-llm LlmAdapter (providerInfo/listModels/resolveModel/
 * prepareCall/stream) — structural, no host import.
 *
 * Images resolve through the harness attachment service; thinking levels come
 * from the gateway catalog and forward verbatim (including the `none`/`ultra`
 * extensions pi-ai does not model).
 */

/** Structural pi-ai provider surface the adapter consumes. */
export interface PiProviderLike {
  stream(model: unknown, context: unknown, options: unknown): AsyncIterable<PiEvent>
  streamSimple(model: unknown, context: unknown, options: unknown): AsyncIterable<PiEvent>
}

/** Live endpoint read per request so the settings page applies without restart. */
export interface RuntimeEndpoint {
  /** Versioned API root, e.g. `http://127.0.0.1:3425/v1` (no trailing slash). */
  baseUrl(): string
  /** Bearer key sent to the gateway. */
  apiKey(): string
}

export const PROVIDER_ID = 'dsh-magpie-connect'

/** Default picker label for the default route id. */
export const DEFAULT_DISPLAY_NAME = 'Magpie'

export interface MagpieModelInfo {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
}

export interface CatalogLike {
  list(): string[]
  decision(model: string): { allowed: boolean; source: string; known: boolean }
  getEntry?(model: string): { nativeEndpoints: string[] } | undefined
  reasoningFor?(model: string): { efforts: Array<{ id: string; name: string; description?: string }>; defaultEffort: string } | undefined
  thinks?(model: string): boolean
  supportsImage?(model: string): boolean
  supportsEffort?(model: string, effort: string): boolean
  requiresResponsesApi?(model: string): boolean
  contextWindowFor?(model: string): number
  maxTokensFor?(model: string): number
}

const DEFAULT_CONTEXT_WINDOW = 262144
const DEFAULT_MAX_TOKENS = 32768

/** Credential sent to the LAN gateway (it needs none; pi-ai requires a value). */
const DEFAULT_API_KEY = 'not-needed'

/** Connection-setup retries (429/5xx with backoff, interruptible by abort). */
export const DEFAULT_MAX_RETRIES = 2
/** Overall SDK request cap (replaces the OpenAI SDK 10 min default). */
export const DEFAULT_TIMEOUT_MS = 300_000
/** Max wait for the first upstream event (queueing happens here). */
export const DEFAULT_FIRST_EVENT_TIMEOUT_MS = 90_000
/** Max silence between upstream events once streaming. */
export const DEFAULT_IDLE_TIMEOUT_MS = 60_000

const STRENGTH_ORDER = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const

/**
 * Plan the wire `reasoning_effort` for one request. Returns the effort to
 * send via `provider.stream`, or undefined to omit the field (gateway
 * default applies).
 *
 * - `off` aliases `none` (explicitly disable thinking).
 * - `none` sends only when the model lists it; otherwise omitted.
 * - `ultra` sends when listed; otherwise degrades to the highest listed
 *   strength level (`max` → … → `minimal`).
 * - Known strength levels send verbatim when listed or when the model thinks
 *   without a ladder (gateway decides); otherwise clamped up-then-down to
 *   the nearest listed level so a stale remembered value never 400s.
 * - Unknown values and non-reasoning models omit.
 */
export function planReasoningEffort(
  requested: unknown,
  model: string,
  catalog: Pick<CatalogLike, 'thinks' | 'supportsEffort' | 'reasoningFor'>,
): string | undefined {
  if (typeof requested !== 'string') return undefined
  const level = requested.trim().toLowerCase()
  if (level === '') return undefined
  const thinks = catalog.thinks?.(model) ?? false
  if (!thinks) return undefined
  const normalized = level === 'off' ? 'none' : level
  const supports = (effort: string): boolean => catalog.supportsEffort?.(model, effort) ?? false
  const ladder = catalog.reasoningFor?.(model)?.efforts.map((effort) => effort.id)
  const ladderLess = ladder === undefined

  if (normalized === 'none') {
    return supports('none') ? 'none' : undefined
  }
  if (!(STRENGTH_ORDER as readonly string[]).includes(normalized)) return undefined
  if (supports(normalized) || ladderLess) return normalized
  // Clamp a stale/foreign level up-then-down (pi-ai clamp order).
  const order = STRENGTH_ORDER as readonly string[]
  const index = order.indexOf(normalized as (typeof STRENGTH_ORDER)[number])
  if (index !== -1) {
    for (let i = index + 1; i < order.length; i++) {
      const candidate = order[i] as string
      if (supports(candidate)) return candidate
    }
    for (let i = index - 1; i >= 0; i--) {
      const candidate = order[i] as string
      if (supports(candidate)) return candidate
    }
  }
  return undefined
}

function toPiModel(
  providerId: string,
  baseUrl: string,
  id: string,
  catalog: CatalogLike,
  contextWindow = DEFAULT_CONTEXT_WINDOW,
  maxTokens = DEFAULT_MAX_TOKENS,
): Model<Api> {
  const endpoints = catalog.getEntry?.(id)?.nativeEndpoints ?? []
  const api = modelApiForEntry(endpoints)
  const entryThinks = catalog.thinks?.(id) ?? api === 'openai-responses'
  const ladder = catalog.reasoningFor?.(id)
  const ladderIds = ladder?.efforts.map((effort) => effort.id)
  const resolvedContext = catalog.contextWindowFor?.(id) ?? contextWindow
  const resolvedMax = catalog.maxTokensFor?.(id) ?? maxTokens
  if (api === 'openai-responses') {
    return {
      id,
      name: id,
      api,
      provider: providerId,
      baseUrl,
      reasoning: true,
      thinkingLevelMap: thinkingLevelMapFor(ladderIds),
      input: catalog.supportsImage?.(id) ?? true ? ['text', 'image'] : ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: resolvedContext,
      maxTokens: resolvedMax,
    }
  }
  const wire: Model<Api> = {
    id,
    name: id,
    api,
    provider: providerId,
    baseUrl,
    reasoning: entryThinks,
    input: catalog.supportsImage?.(id) ?? false ? ['text', 'image'] : ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: resolvedContext,
    maxTokens: resolvedMax,
  }
  if (entryThinks) wire.thinkingLevelMap = thinkingLevelMapFor(ladderIds)
  return wire
}

export class MagpieAdapter {
  readonly #catalog: CatalogLike
  readonly #provider: PiProviderLike
  readonly #providerId: string
  readonly #displayName: string
  /** Static fallback API root; the live settings page overrides per request. */
  readonly #fallbackBaseUrl: string
  readonly #fallbackApiKey: string
  readonly #runtime?: RuntimeEndpoint
  readonly #maxRetries: number
  readonly #timeoutMs: number
  readonly #firstEventTimeoutMs: number
  readonly #idleTimeoutMs: number
  readonly #resolveAttachments?: () => AttachmentStore | undefined

  constructor(
    catalog: CatalogLike,
    options: {
      magpieBaseUrl?: string
      baseUrl?: string
      providerOverride?: unknown
      /** Route id registered into DSH (model `provider` field + pi-ai provider tag). */
      providerId?: string
      /** Display name reported via providerInfo (model picker grouping label). */
      displayName?: string
      /** Gateway credential (LAN needs none). */
      apiKey?: string
      /**
       * Live endpoint read per request (settings page). Falls back to the
       * static `magpieBaseUrl`/`apiKey` options when absent.
       */
      runtime?: RuntimeEndpoint
      /** Connection-setup retries for 429/5xx (default 2). */
      maxRetries?: number
      /** Overall SDK request cap in ms (default 300000). */
      timeoutMs?: number
      /** Stall watchdog: max wait for the first upstream event in ms (default 90000; <=0 disables). */
      firstEventTimeoutMs?: number
      /** Stall watchdog: max silence between upstream events in ms (default 60000; <=0 disables). */
      idleTimeoutMs?: number
      /** Harness attachment service for image bytes (wired in index.ts). */
      resolveAttachments?: () => AttachmentStore | undefined
    } = {},
  ) {
    this.#catalog = catalog
    this.#providerId = options.providerId ?? PROVIDER_ID
    this.#displayName = options.displayName ?? (options.providerId ?? DEFAULT_DISPLAY_NAME)
    // The configured value is already the versioned API root (`…/v1`), which is
    // exactly what pi-ai's `baseUrl` expects: it appends `/chat/completions`
    // and `/responses` itself. Synthesizing a version here would double it and
    // would hard-code `/v1` against a gateway that later moves to `/v2`.
    this.#fallbackBaseUrl = (options.magpieBaseUrl ?? options.baseUrl ?? '').replace(/\/+$/, '')
    this.#fallbackApiKey = options.apiKey ?? DEFAULT_API_KEY
    this.#runtime = options.runtime
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.#firstEventTimeoutMs = options.firstEventTimeoutMs ?? DEFAULT_FIRST_EVENT_TIMEOUT_MS
    this.#idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
    this.#resolveAttachments = options.resolveAttachments
    if (options.providerOverride !== undefined) {
      this.#provider = options.providerOverride as never
      return
    }
    this.#provider = createProvider<Api>({
      id: this.#providerId,
      name: this.#displayName,
      baseUrl: this.#fallbackBaseUrl,
      auth: {
        apiKey: {
          name: 'Magpie LAN gateway',
          resolve: async () => ({ auth: { apiKey: this.#runtime?.apiKey() ?? this.#fallbackApiKey } }),
        },
      },
      models: [],
      // Mixed-API provider: pi-ai dispatches on `model.api`, so completions
      // models ride /v1/chat/completions while responses-only models ride
      // /v1/responses through the same provider instance.
      api: {
        'openai-completions': openaiCompletions,
        'openai-responses': openaiResponses,
      },
    }) as unknown as PiProviderLike
  }

  providerInfo(provider: string): { id: string; name: string } {
    return { id: provider, name: this.#displayName }
  }

  /**
   * dsh-llm calls this unconditionally at registration.
   * undefined = the host default retry policy.
   */
  providerRetryPolicy(_provider: string): undefined {
    return undefined
  }

  /** Advisory catalog for the DSH model picker (deduped; dsh-llm rejects duplicates). */
  listModels(provider: string): Array<{ provider: string; id: string; name: string; inputModalities: string[] }> {
    const seen = new Set<string>()
    const models: Array<{ provider: string; id: string; name: string; inputModalities: string[] }> = []
    for (const id of this.#catalog.list()) {
      if (seen.has(id)) continue
      seen.add(id)
      const image = this.#catalog.supportsImage?.(id) ?? false
      models.push({ provider, id, name: id, inputModalities: image ? ['text', 'image'] : ['text'] })
    }
    return models
  }

  resolveModel(
    provider: string,
    model: string,
  ): {
    provider: string
    id: string
    name: string
    inputModalities: string[]
    context: { contextWindow: number }
    defaultMaxTokens: number
    reasoning?: {
      efforts: ReadonlyArray<{ id: string; name: string; description?: string }>
      defaultEffort?: string
    }
  } {
    // DSH capability seam: exposing efforts lights up the session model
    // selector's reasoning picker; ids flow back as
    // GenerateOptions.reasoningEffort and are forwarded verbatim by
    // planReasoningEffort (gateway extensions `none`/`ultra` included).
    // No `off` entry: omission keeps the gateway default (= defaultEffort).
    const image = this.#catalog.supportsImage?.(model) ?? this.#catalog.requiresResponsesApi?.(model) ?? false
    const ladder = this.#catalog.reasoningFor?.(model)
    return {
      provider,
      id: model,
      name: model,
      inputModalities: image ? ['text', 'image'] : ['text'],
      context: { contextWindow: this.#catalog.contextWindowFor?.(model) ?? DEFAULT_CONTEXT_WINDOW },
      defaultMaxTokens: this.#catalog.maxTokensFor?.(model) ?? DEFAULT_MAX_TOKENS,
      ...(ladder !== undefined ? { reasoning: ladder } : {}),
    }
  }

  async prepareCall(
    provider: string,
    model: string,
    _signal?: AbortSignal,
  ): Promise<{
    model: ReturnType<MagpieAdapter['resolveModel']>
    stream: (options: HarnessGenerateOptions) => AsyncGenerator<HarnessChunk>
  }> {
    return {
      model: this.resolveModel(provider, model),
      stream: (options) => this.stream(options),
    }
  }

  /**
   * Fail fast when no gateway API URL is configured (picker stays empty too).
   * @returns the versioned API root, trailing slash stripped.
   */
  #requireBaseUrl(): string {
    const raw = this.#runtime?.baseUrl() ?? this.#fallbackBaseUrl
    const baseUrl = raw.replace(/\/+$/, '')
    if (baseUrl === '') {
      throw new Error('dsh-magpie-connect: Magpie gateway API URL or key is not configured — open Settings → Magpie and fill in both')
    }
    return baseUrl
  }

  /** Effective bearer key for this request. */
  #wireApiKey(): string {
    return this.#runtime?.apiKey() ?? this.#fallbackApiKey
  }

  /**
   * Stream one chat turn from the Magpie gateway: a single pi-ai stream,
   * translated to harness chunks verbatim. Upstream failures (rate limit,
   * auth, timeout, transport) arrive as classified finish reasons, and
   * turn-level retries stay owned by DSH.
   *
   * A stall watchdog races every upstream event against a timer: on expiry
   * the upstream is aborted and the turn ends fast with a TIMEOUT error
   * instead of hanging to the SDK/harness timeout.
   */
  async *stream(options: HarnessGenerateOptions): AsyncGenerator<HarnessChunk> {
    const baseUrl = this.#requireBaseUrl()
    const endpoints = this.#catalog.getEntry?.(options.model)?.nativeEndpoints ?? []
    const hasImage = contentHasImage(options.messages)
    if (hasImage && !(this.#catalog.supportsImage?.(options.model) ?? false)) {
      throw new Error(`dsh-magpie-connect: model "${options.model}" does not accept image input`)
    }
    const context = hasImage
      ? await this.#imageContext(options, endpoints)
      : toPiContext(options, endpoints)
    const model = toPiModel(this.#providerId, baseUrl, options.model, this.#catalog)
    // Linked controller: the watchdog aborts the upstream on stall, while a
    // harness abort (user stop / host timeout) still propagates through.
    const controller = new AbortController()
    const harnessSignal = options.signal
    const onHarnessAbort = (): void => controller.abort()
    if (harnessSignal) {
      if (harnessSignal.aborted) controller.abort()
      else harnessSignal.addEventListener('abort', onHarnessAbort, { once: true })
    }
    try {
      const events = withStallTimeout(
        this.#eventsFor(options, context, model, controller.signal) as AsyncIterable<PiEvent>,
        { firstEventTimeoutMs: this.#firstEventTimeoutMs, idleTimeoutMs: this.#idleTimeoutMs },
        { model: options.model, onTimeout: () => controller.abort() },
      )
      yield* toStreamChunks(events, model.contextWindow)
    } finally {
      harnessSignal?.removeEventListener('abort', onHarnessAbort)
    }
  }

  async #imageContext(options: HarnessGenerateOptions, endpoints: readonly string[]): Promise<ReturnType<typeof toPiContext>> {
    const attachments = this.#resolveAttachments?.()
    if (!attachments) {
      throw new Error('dsh-magpie-connect: image input requires the attachment service')
    }
    return toPiContextWithImages(options, attachments, endpoints)
  }

  #eventsFor(
    options: HarnessGenerateOptions,
    context: ReturnType<typeof toPiContext>,
    model: ReturnType<typeof toPiModel>,
    signal: AbortSignal,
  ): unknown {
    // Single dispatch through `provider.stream` with our own clamped effort:
    // gateway extensions (`none`/`ultra`) ride verbatim, known levels ride
    // the ladder, and omission keeps the gateway default.
    const reasoningEffort = planReasoningEffort(options.reasoningEffort, options.model, this.#catalog)
    return this.#provider.stream(model, context as unknown as Context, {
      apiKey: this.#wireApiKey(),
      signal,
      maxRetries: this.#maxRetries,
      timeoutMs: this.#timeoutMs,
      temperature: options.temperature,
      maxTokens: options.maxTokens ?? model.maxTokens,
      ...(reasoningEffort !== undefined ? { reasoningEffort } : {}),
    })
  }

  /** Expose the live catalog snapshot for diagnostics. */
  catalogStatus(): { total: number; exposed: number } {
    const list = this.#catalog.list()
    return { total: list.length, exposed: list.length }
  }

  decisionFor(model: string): { allowed: boolean; source: string } {
    const decision = this.#catalog.decision(model)
    return { allowed: decision.allowed, source: decision.source }
  }
}

/** Build the adapter over a live catalog. */
export function createMagpieAdapter(catalog: ModelCatalog): MagpieAdapter {
  return new MagpieAdapter(catalog)
}
