import test from 'node:test'
import assert from 'node:assert/strict'
import { MagpieAdapter, planReasoningEffort, type CatalogLike } from '../src/adapter/magpie-adapter.ts'
import { ModelCatalog } from '../src/adapter/catalog.ts'
import type { HarnessChunk, PiEvent } from '../src/adapter/events.ts'
import type { HarnessGenerateOptions, HarnessMessage } from '../src/adapter/messages.ts'

function catalogStub(entries: Record<string, { image?: boolean; reasoning?: boolean; efforts?: string[]; responses?: boolean; context?: number; max?: number }>): CatalogLike {
  return {
    list: () => Object.keys(entries),
    decision: () => ({ allowed: true, source: 'test', known: true }),
    getEntry: (model: string) => ({ nativeEndpoints: entries[model]?.responses ? ['/v1/responses'] : ['/v1/chat/completions'] }),
    reasoningFor: (model: string) => {
      const entry = entries[model]
      if (!entry?.reasoning || !entry.efforts || entry.efforts.length === 0) return undefined
      const mid = entry.efforts[Math.floor(entry.efforts.length / 2)] ?? 'medium'
      return {
        efforts: entry.efforts.map((id) => ({ id, name: id })),
        defaultEffort: entry.efforts.includes('medium') ? 'medium' : mid,
      }
    },
    thinks: (model: string) => entries[model]?.reasoning ?? false,
    supportsImage: (model: string) => entries[model]?.image ?? false,
    supportsEffort: (model: string, effort: string) => entries[model]?.efforts?.includes(effort) ?? false,
    requiresResponsesApi: (model: string) => entries[model]?.responses ?? false,
    contextWindowFor: (model: string) => entries[model]?.context ?? 262144,
    maxTokensFor: (model: string) => entries[model]?.max ?? 32768,
  }
}

test('MagpieAdapter implements the full dsh-llm adapter surface', () => {
  const adapter = testAdapter(new ModelCatalog())
  for (const method of ['providerInfo', 'providerRetryPolicy', 'imageRequestPricing', 'listModels', 'resolveModel', 'prepareCall', 'stream']) {
    assert.equal(typeof (adapter as unknown as Record<string, unknown>)[method], 'function', `missing method: ${method}`)
  }
})

test('providerInfo preserves the route id and reports the display name', () => {
  const adapter = testAdapter(new ModelCatalog())
  assert.deepEqual(adapter.providerInfo('dsh-magpie-connect'), { id: 'dsh-magpie-connect', name: 'Magpie' })
  const renamed = testAdapter(new ModelCatalog(), { providerId: 'lan', displayName: 'LAN Models' })
  assert.deepEqual(renamed.providerInfo('lan'), { id: 'lan', name: 'LAN Models' })
})

test('providerRetryPolicy defers to the host default', () => {
  const adapter = testAdapter(new ModelCatalog())
  assert.equal(adapter.providerRetryPolicy('dsh-magpie-connect'), undefined)
})

test('imageRequestPricing declares no per-route visual pricing (compact-safe)', () => {
  const adapter = testAdapter(new ModelCatalog())
  assert.equal(adapter.imageRequestPricing('dsh-magpie-connect', 'any-model'), undefined)
  // Regression: /compact resolves pricing via
  // `adapters.get(provider)?.adapter.imageRequestPricing(provider, model)` —
  // a missing method throws "is not a function" and aborts compaction.
  const adapters = new Map([['dsh-magpie-connect', { adapter }]])
  assert.equal(adapters.get('dsh-magpie-connect')?.adapter.imageRequestPricing('dsh-magpie-connect', 'any-model'), undefined)
})

test('listModels mirrors the catalog with image modalities and no duplicates', () => {
  const adapter = testAdapter(catalogStub({ a: { image: true }, b: { image: false } }))
  // inject a duplicate via list override
  const dup = testAdapter({
    ...catalogStub({ a: { image: true } }),
    list: () => ['a', 'a'],
  })
  assert.deepEqual(dup.listModels('p').map((m) => m.id), ['a'])
  const models = adapter.listModels('p')
  assert.deepEqual(models.find((m) => m.id === 'a')?.inputModalities, ['text', 'image'])
  assert.deepEqual(models.find((m) => m.id === 'b')?.inputModalities, ['text'])
})

test('resolveModel declares limits, modalities and the reasoning picker', () => {
  const adapter = testAdapter(
    catalogStub({
      'vercel/openai/gpt-4.1': { image: true, reasoning: false, context: 1047576, max: 32768 },
      'opencode-zen/muse-spark-1.3-contributor-free': { image: true, reasoning: true, efforts: ['minimal', 'low', 'medium', 'high', 'xhigh'], responses: true, context: 1048576, max: 131072 },
      'codex/gpt-5.6-terra': { image: true, reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], responses: true },
    }),
  )
  const text = adapter.resolveModel('p', 'vercel/openai/gpt-4.1')
  assert.deepEqual(text.inputModalities, ['text', 'image'])
  assert.equal(text.context.contextWindow, 1047576)
  assert.equal(text.defaultMaxTokens, 32768)
  assert.equal(text.reasoning, undefined)
  const spark = adapter.resolveModel('p', 'opencode-zen/muse-spark-1.3-contributor-free')
  assert.deepEqual(spark.inputModalities, ['text', 'image'])
  assert.deepEqual(spark.reasoning?.efforts.map((e) => e.id), ['minimal', 'low', 'medium', 'high', 'xhigh'])
  assert.equal(spark.reasoning?.defaultEffort, 'medium')
  const terra = adapter.resolveModel('p', 'codex/gpt-5.6-terra')
  assert.ok(terra.reasoning?.efforts.some((e) => e.id === 'ultra'), 'ultra is exposed')
})

test('planReasoningEffort omits for non-reasoning models and unknown values', () => {
  const catalog = catalogStub({ m: { reasoning: false }, r: { reasoning: true, efforts: ['low', 'medium'] } })
  assert.equal(planReasoningEffort('high', 'm', catalog), undefined)
  assert.equal(planReasoningEffort('bogus', 'r', catalog), undefined)
  assert.equal(planReasoningEffort('', 'r', catalog), undefined)
  assert.equal(planReasoningEffort(undefined, 'r', catalog), undefined)
})

test('planReasoningEffort passes listed levels verbatim (ladder-less too)', () => {
  const catalog = catalogStub({ ladder: { reasoning: true, efforts: [] }, full: { reasoning: true, efforts: ['low', 'medium', 'high'] } })
  assert.equal(planReasoningEffort('high', 'ladder', catalog), 'high')
  assert.equal(planReasoningEffort('medium', 'full', catalog), 'medium')
})

test('planReasoningEffort handles none/off (explicit disable only when listed)', () => {
  const catalog = catalogStub({
    withNone: { reasoning: true, efforts: ['none', 'low', 'medium'] },
    withoutNone: { reasoning: true, efforts: ['low', 'medium'] },
  })
  assert.equal(planReasoningEffort('none', 'withNone', catalog), 'none')
  assert.equal(planReasoningEffort('off', 'withNone', catalog), 'none')
  assert.equal(planReasoningEffort('none', 'withoutNone', catalog), undefined)
})

test('planReasoningEffort forwards ultra when listed, else degrades to max', () => {
  const catalog = catalogStub({
    terra: { reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] },
    plain: { reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
  })
  assert.equal(planReasoningEffort('ultra', 'terra', catalog), 'ultra')
  assert.equal(planReasoningEffort('ULTRA', 'terra', catalog), 'ultra')
  assert.equal(planReasoningEffort('ultra', 'plain', catalog), 'max')
})

test('planReasoningEffort clamps stale levels up-then-down instead of 400ing', () => {
  const catalog = catalogStub({ highOnly: { reasoning: true, efforts: ['high'] } })
  assert.equal(planReasoningEffort('max', 'highOnly', catalog), 'high')
  assert.equal(planReasoningEffort('minimal', 'highOnly', catalog), 'high')
})

// --- streaming harness ---

function legDone(text: string, stopReason: 'length' | 'stop', content: Array<Record<string, unknown>> = [{ type: 'text', text }]): PiEvent {
  return {
    type: 'done',
    message: {
      api: 'openai-completions',
      provider: 'dsh-magpie-connect',
      model: 'm',
      content,
      usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 15 },
      stopReason,
      timestamp: 0,
    },
  } as unknown as PiEvent
}

function textLeg(text: string, stopReason: 'length' | 'stop'): PiEvent[] {
  return [
    { type: 'start', partial: { content: [] } },
    { type: 'text_start', contentIndex: 0, partial: { content: [] } },
    { type: 'text_delta', contentIndex: 0, delta: text, partial: { content: [] } },
    { type: 'text_end', contentIndex: 0, content: text, partial: { content: [] } },
    legDone(text, stopReason),
  ]
}

interface SeenCall {
  maxTokens: unknown
  messageCount: number
  reasoningEffort: unknown
  wireModel: Record<string, unknown>
  maxRetries: unknown
  timeoutMs: unknown
  signalAborted: unknown
}

/** Canned upstream; records what each turn was asked. Supports stream + streamSimple. */
function cannedProvider(legs: PiEvent[][], seen: SeenCall[] = []) {
  let calls = 0
  const record = (model: Record<string, unknown>, context: { messages: unknown[] }, options: Record<string, unknown>) => {
    seen.push({
      maxTokens: options.maxTokens,
      messageCount: context.messages.length,
      reasoningEffort: options.reasoningEffort ?? options.reasoning,
      wireModel: model,
      maxRetries: options.maxRetries,
      timeoutMs: options.timeoutMs,
      signalAborted: options.signal instanceof AbortSignal ? options.signal.aborted : 'missing',
    })
  }
  const next = () => {
    const leg = legs[Math.min(calls, legs.length - 1)] ?? []
    calls += 1
    return (async function* () {
      for (const event of leg) yield event
    })()
  }
  return {
    stream: (model: Record<string, unknown>, context: { messages: unknown[] }, options: Record<string, unknown>) => {
      record(model, context, options)
      return next()
    },
    streamSimple: (model: Record<string, unknown>, context: { messages: unknown[] }, options: Record<string, unknown>) => {
      record(model, context, options)
      return next()
    },
  }
}

function streamOptions(overrides: Partial<HarnessGenerateOptions> = {}): HarnessGenerateOptions {
  const messages: HarnessMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]
  return { provider: 'dsh-magpie-connect', model: 'm', messages, ...overrides }
}

async function collectChunks(adapter: MagpieAdapter, options: HarnessGenerateOptions): Promise<HarnessChunk[]> {
  const call = await adapter.prepareCall('dsh-magpie-connect', options.model)
  const chunks: HarnessChunk[] = []
  for await (const chunk of call.stream(options)) chunks.push(chunk)
  return chunks
}

function finishOf(chunks: HarnessChunk[]): HarnessChunk {
  const finishes = chunks.filter((chunk) => chunk.type === 'finish')
  assert.equal(finishes.length, 1)
  return finishes[0] as HarnessChunk
}

const textCatalog = catalogStub({ m: { image: false, reasoning: false } })

/** Test adapters point at a stub origin unless the case says otherwise. */
function testAdapter(catalog: CatalogLike, options: ConstructorParameters<typeof MagpieAdapter>[1] = {}): MagpieAdapter {
  return new MagpieAdapter(catalog, { magpieBaseUrl: 'http://test.lan', ...options })
}

test('text streams through verbatim with usage then a single finish', async () => {
  const seen: SeenCall[] = []
  const adapter = testAdapter(textCatalog, { providerOverride: cannedProvider([textLeg('AAA', 'stop')], seen) })
  const chunks = await collectChunks(adapter, streamOptions())
  const texts = chunks.filter((c) => c.type === 'text-delta').map((c) => (c as { text: string }).text)
  assert.deepEqual(texts, ['AAA'])
  assert.deepEqual((finishOf(chunks) as { reason: unknown }).reason, { kind: 'stop' })
  assert.equal(seen.length, 1)
  assert.equal(seen[0]?.messageCount, 1)
  assert.equal(seen[0]?.reasoningEffort, undefined)
})

test('a length finish is surfaced honestly (no auto-continuation)', async () => {
  const seen: SeenCall[] = []
  const adapter = testAdapter(textCatalog, { providerOverride: cannedProvider([textLeg('AAA', 'length')], seen) })
  const chunks = await collectChunks(adapter, streamOptions())
  assert.deepEqual((finishOf(chunks) as { reason: unknown }).reason, { kind: 'max-tokens' })
})

test('thinking levels forward verbatim (none/ultra included)', async () => {
  const seen: SeenCall[] = []
  const catalog = catalogStub({
    terra: { image: false, reasoning: true, efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], responses: true },
    qwen: { image: false, reasoning: true, efforts: ['none', 'low', 'medium', 'xhigh'] },
  })
  const adapter = testAdapter(catalog, { providerOverride: cannedProvider([textLeg('hi', 'stop'), textLeg('hi', 'stop')], seen) })
  await collectChunks(adapter, streamOptions({ model: 'terra', reasoningEffort: 'ultra' }))
  assert.equal(seen[0]?.reasoningEffort, 'ultra')
  await collectChunks(adapter, streamOptions({ model: 'qwen', reasoningEffort: 'none' }))
  assert.equal(seen[1]?.reasoningEffort, 'none')
})

test('host maxTokens passes through uncapped, missing falls back to the model limit', async () => {
  const seen: SeenCall[] = []
  const adapter = testAdapter(textCatalog, { providerOverride: cannedProvider([textLeg('hi', 'stop')], seen) })
  await collectChunks(adapter, streamOptions({ maxTokens: 65536 }))
  assert.equal(seen[0]?.maxTokens, 65536)
  const seen2: SeenCall[] = []
  const adapter2 = testAdapter(textCatalog, { providerOverride: cannedProvider([textLeg('hi', 'stop')], seen2) })
  await collectChunks(adapter2, streamOptions())
  assert.equal(seen2[0]?.maxTokens, 32768)
})

test('connection setup uses explicit retries/timeout instead of bare SDK defaults', async () => {
  const seen: SeenCall[] = []
  const adapter = testAdapter(textCatalog, { providerOverride: cannedProvider([textLeg('hi', 'stop')], seen) })
  await collectChunks(adapter, streamOptions())
  assert.equal(seen[0]?.maxRetries, 2)
  assert.equal(seen[0]?.timeoutMs, 300_000)
  assert.equal(seen[0]?.signalAborted, false)
})

test('a harness abort reaches the upstream as an aborted signal', async () => {
  const seen: SeenCall[] = []
  const adapter = testAdapter(textCatalog, { providerOverride: cannedProvider([textLeg('hi', 'stop')], seen) })
  await collectChunks(adapter, streamOptions({ signal: AbortSignal.abort() }))
  assert.equal(seen[0]?.signalAborted, true)
})

test('a stalled upstream fails fast as TIMEOUT instead of hanging', async () => {
  const hangingProvider = {
    stream: () =>
      (async function* (): AsyncGenerator<PiEvent> {
        await new Promise<never>(() => {})
        yield { type: 'start', partial: { content: [] } } as PiEvent
      })(),
    streamSimple: () =>
      (async function* (): AsyncGenerator<PiEvent> {
        await new Promise<never>(() => {})
        yield { type: 'start', partial: { content: [] } } as PiEvent
      })(),
  }
  const adapter = testAdapter(textCatalog, {
    providerOverride: hangingProvider,
    firstEventTimeoutMs: 20,
    idleTimeoutMs: 20,
  })
  const start = Date.now()
  const chunks = await collectChunks(adapter, streamOptions())
  const elapsedMs = Date.now() - start
  assert.deepEqual(chunks[0], { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } })
  const reason = (finishOf(chunks) as { reason: { kind: string; failure?: { message: string; code: string } } }).reason
  assert.equal(reason.kind, 'error')
  assert.equal(reason.failure?.code, 'TIMEOUT')
  assert.ok(elapsedMs < 5000, `stalled upstream should fail fast, took ${elapsedMs}ms`)
})

test('image input without the attachment service fails with a clear error', async () => {
  const catalog = catalogStub({ img: { image: true, reasoning: false } })
  const adapter = testAdapter(catalog, { providerOverride: cannedProvider([textLeg('hi', 'stop')]) })
  await assert.rejects(
    collectChunks(
      adapter,
      streamOptions({ model: 'img', messages: [{ role: 'user', content: [{ type: 'image', attachment: { attachmentId: 'x', mediaType: 'image/png', bytes: 1, width: 10, height: 10 } }] }] }),
    ),
    /attachment service/,
  )
})

test('image input on a text-only model is rejected before the wire', async () => {
  const adapter = testAdapter(textCatalog, { providerOverride: cannedProvider([textLeg('hi', 'stop')]) })
  await assert.rejects(
    collectChunks(
      adapter,
      streamOptions({ messages: [{ role: 'user', content: [{ type: 'image', attachment: { attachmentId: 'x', mediaType: 'image/png', bytes: 1, width: 10, height: 10 } }] }] }),
    ),
    /does not accept image/,
  )
})

test('image input resolves bytes and streams', async () => {
  const seen: SeenCall[] = []
  const catalog = catalogStub({ img: { image: true, reasoning: false } })
  const attachments = {
    async readImageRequest(ref: { mediaType: string; width: number; height: number }) {
      return { data: new Uint8Array([1, 2, 3]), mediaType: ref.mediaType, bytes: 3, width: ref.width, height: ref.height }
    },
  }
  const adapter = testAdapter(catalog, {
    providerOverride: cannedProvider([textLeg('saw it', 'stop')], seen),
    resolveAttachments: () => attachments,
  })
  const chunks = await collectChunks(
    adapter,
    streamOptions({
      model: 'img',
      messages: [{ role: 'user', content: [{ type: 'image', attachment: { attachmentId: 'x', mediaType: 'image/png', bytes: 3, width: 10, height: 10 } }] }],
    }),
  )
  assert.deepEqual((finishOf(chunks) as { reason: unknown }).reason, { kind: 'stop' })
  assert.equal(seen.length, 1)
})

test('live runtime endpoint overrides the static baseUrl/apiKey per request', async () => {
  const seen: SeenCall[] = []
  const adapter = testAdapter(textCatalog, {
    providerOverride: cannedProvider([textLeg('hi', 'stop')], seen),
    magpieBaseUrl: 'http://static.lan/v1',
    apiKey: 'static-key',
    runtime: {
      baseUrl: () => 'http://page.lan/v1',
      apiKey: () => 'page-key',
    },
  })
  await collectChunks(adapter, streamOptions())
  assert.equal((seen[0]?.wireModel.baseUrl as string), 'http://page.lan/v1')
})

test('the configured API root reaches pi-ai verbatim, version included', async () => {
  const seen: SeenCall[] = []
  // A gateway on /v3 must be asked for /v3, not /v3/v1: the version is part of
  // the configured URL and the adapter never synthesizes one.
  const adapter = testAdapter(textCatalog, {
    providerOverride: cannedProvider([textLeg('hi', 'stop')], seen),
    magpieBaseUrl: 'http://static.lan/v3',
    apiKey: 'static-key',
  })
  await collectChunks(adapter, streamOptions())
  assert.equal(seen[0]?.wireModel.baseUrl, 'http://static.lan/v3')
})

test('runtime apiKey reaches the provider options', async () => {
  const calls: Array<{ apiKey: unknown }> = []
  const provider = {
    stream: (_model: unknown, _ctx: unknown, options: { apiKey: unknown }) => {
      calls.push({ apiKey: options.apiKey })
      return (async function* (): AsyncGenerator<PiEvent> {
        yield legDone('hi', 'stop')
      })()
    },
    streamSimple: (_model: unknown, _ctx: unknown, options: { apiKey: unknown }) => {
      calls.push({ apiKey: options.apiKey })
      return (async function* (): AsyncGenerator<PiEvent> {
        yield legDone('hi', 'stop')
      })()
    },
  }
  const adapter = testAdapter(textCatalog, {
    providerOverride: provider,
    runtime: { baseUrl: () => 'http://page.lan', apiKey: () => 'page-key' },
  })
  await collectChunks(adapter, streamOptions())
  assert.equal(calls[0]?.apiKey, 'page-key')
})

test('without runtime the static options apply', async () => {
  const seen: SeenCall[] = []
  const adapter = testAdapter(textCatalog, {
    providerOverride: cannedProvider([textLeg('hi', 'stop')], seen),
    // A trailing slash is stripped either way; the version is untouched.
    magpieBaseUrl: 'http://static.lan/v1/',
    apiKey: 'static-key',
  })
  await collectChunks(adapter, streamOptions())
  assert.equal(seen[0]?.wireModel.baseUrl, 'http://static.lan/v1')
})

test('stream without a configured origin fails fast instead of calling the wire', async () => {
  let calls = 0
  const provider = {
    stream: () => {
      calls += 1
      return (async function* (): AsyncGenerator<PiEvent> {
        yield legDone('hi', 'stop')
      })()
    },
    streamSimple: () => {
      calls += 1
      return (async function* (): AsyncGenerator<PiEvent> {
        yield legDone('hi', 'stop')
      })()
    },
  }
  const unconfigured = testAdapter(textCatalog, {
    providerOverride: provider,
    magpieBaseUrl: '',
    runtime: { baseUrl: () => '', apiKey: () => 'not-needed' },
  })
  await assert.rejects(collectChunks(unconfigured, streamOptions()), /not configured/)
  assert.equal(calls, 0)
})
