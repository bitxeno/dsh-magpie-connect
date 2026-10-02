import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalEfforts,
  decodeMagpieModels,
  decodeModel,
  effortsFor,
  fetchMagpieModels,
  ModelCatalog,
  modelApiForEntry,
  normalizeEffort,
  requiresResponsesApiEntry,
  staticMagpieModels,
  thinkingLevelMapFor,
} from '../src/adapter/catalog.ts'

function fakeFetch(routes: Record<string, unknown>) {
  return (async (url: string | URL) => {
    const key = String(url).replace(/\?.*$/, '')
    const body = routes[key] ?? routes['*']
    if (body instanceof Error) throw body
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

const gatewayBody = {
  data: [
    {
      id: 'vercel/openai/gpt-4.1',
      display_name: 'openai/gpt-4.1',
      context_window: 1047576,
      max_output_tokens: 32768,
      modalities: { input: ['text', 'image'] },
      native_endpoints: ['/v1/chat/completions'],
      reasoning: false,
      supported_reasoning_levels: [],
    },
    {
      id: 'opencode-zen/muse-spark-1.3-contributor-free',
      display_name: 'Muse Spark 1.3 Free',
      context_window: 1048576,
      max_output_tokens: 131072,
      modalities: { input: ['text', 'image'] },
      native_endpoints: ['/v1/responses'],
      reasoning: true,
      supported_reasoning_levels: [{ effort: 'minimal' }, { effort: 'low' }, { effort: 'medium' }, { effort: 'high' }, { effort: 'xhigh' }],
    },
    {
      id: 'codex/gpt-5.6-terra',
      display_name: 'GPT-5.6-Terra',
      context_window: 272000,
      max_output_tokens: 128000,
      modalities: { input: ['text', 'image'] },
      native_endpoints: ['/v1/responses'],
      reasoning: true,
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'ultra' }],
    },
    {
      id: 'opencode-zen/jev-1.13-free',
      display_name: 'jev-1.13-free',
      native_endpoints: ['/v1/chat/completions', '/v1/responses', '/v1/messages'],
      reasoning: false,
      supported_reasoning_levels: [],
    },
  ],
}

test('normalizeEffort keeps gateway levels and drops unknown spellings', () => {
  assert.equal(normalizeEffort('high'), 'high')
  assert.equal(normalizeEffort(' XHigh '), 'xhigh')
  assert.equal(normalizeEffort('none'), 'none')
  assert.equal(normalizeEffort('ultra'), 'ultra')
  assert.equal(normalizeEffort('bogus'), undefined)
  assert.equal(normalizeEffort(''), undefined)
  assert.equal(normalizeEffort(42), undefined)
})

test('canonicalEfforts dedupes and orders canonically (none first, ultra last)', () => {
  assert.deepEqual(canonicalEfforts([{ effort: 'ultra' }, { effort: 'low' }, { effort: 'low' }, { effort: 'none' }]), ['none', 'low', 'ultra'])
  assert.deepEqual(canonicalEfforts([]), undefined)
  assert.deepEqual(canonicalEfforts(undefined), undefined)
})

test('decodeModel reads gateway fields with fallbacks', () => {
  const chat = decodeModel(gatewayBody.data[0])
  assert.equal(chat?.id, 'vercel/openai/gpt-4.1')
  assert.equal(chat?.displayName, 'openai/gpt-4.1')
  assert.equal(chat?.contextWindow, 1047576)
  assert.equal(chat?.maxTokens, 32768)
  assert.equal(chat?.image, true)
  assert.deepEqual(chat?.nativeEndpoints, ['/v1/chat/completions'])
  assert.equal(chat?.reasoning, false)
  const minimal = decodeModel(gatewayBody.data[3])
  assert.equal(minimal?.image, false)
  assert.equal(minimal?.contextWindow, undefined)
  assert.equal(decodeModel(null), undefined)
  assert.equal(decodeModel({}), undefined)
})

test('decodeMagpieModels keys entries by id', () => {
  const models = decodeMagpieModels(gatewayBody)
  assert.equal(models.size, 4)
  assert.equal(models.get('codex/gpt-5.6-terra')?.efforts?.includes('ultra'), true)
  assert.equal(decodeMagpieModels(null).size, 0)
  assert.equal(decodeMagpieModels({}).size, 0)
})

test('requiresResponsesApiEntry prefers completions whenever advertised', () => {
  assert.equal(requiresResponsesApiEntry(['/v1/responses']), true)
  assert.equal(requiresResponsesApiEntry(['/v1/chat/completions']), false)
  assert.equal(requiresResponsesApiEntry(['/v1/chat/completions', '/v1/responses']), false)
  assert.equal(requiresResponsesApiEntry([]), false)
  assert.equal(modelApiForEntry(['/v1/responses']), 'openai-responses')
  assert.equal(modelApiForEntry(['/v1/chat/completions']), 'openai-completions')
})

test('thinkingLevelMapFor covers only the pi-ai ladder (none/ultra stay out)', () => {
  assert.deepEqual(thinkingLevelMapFor(['none', 'low', 'medium', 'ultra']), {
    off: null,
    minimal: null,
    low: 'low',
    medium: 'medium',
    high: null,
    xhigh: null,
    max: null,
  })
  assert.equal(thinkingLevelMapFor(undefined).max, null)
})

test('effortsFor builds the picker ladder in canonical order', () => {
  assert.deepEqual(effortsFor(['ultra', 'high', 'none', 'low']).map((effort) => effort.id), ['none', 'low', 'high', 'ultra'])
  assert.deepEqual(effortsFor(undefined), [])
})

test('fetchMagpieModels hits /v1/models and parses entries', async () => {
  const models = await fetchMagpieModels('http://api.lan/', fakeFetch({ 'http://api.lan/v1/models': gatewayBody }))
  assert.equal(models.size, 4)
  assert.equal(models.get('vercel/openai/gpt-4.1')?.image, true)
  await assert.rejects(fetchMagpieModels('http://api.lan', fakeFetch({ 'http://api.lan/v1/models': { data: [] } })), /empty list/)
})

test('ModelCatalog exposes the live list with per-model metadata', async () => {
  const catalog = new ModelCatalog({ fetchImpl: fakeFetch({ 'http://api.lan/v1/models': gatewayBody }), baseUrl: 'http://api.lan' })
  try {
    await catalog.refreshOnce()
    assert.deepEqual(catalog.list(), [
      'codex/gpt-5.6-terra',
      'opencode-zen/jev-1.13-free',
      'opencode-zen/muse-spark-1.3-contributor-free',
      'vercel/openai/gpt-4.1',
    ])
    assert.equal(catalog.requiresResponsesApi('opencode-zen/muse-spark-1.3-contributor-free'), true)
    assert.equal(catalog.requiresResponsesApi('vercel/openai/gpt-4.1'), false)
    assert.equal(catalog.requiresResponsesApi('opencode-zen/jev-1.13-free'), false)
    assert.equal(catalog.supportsImage('vercel/openai/gpt-4.1'), true)
    assert.equal(catalog.supportsImage('opencode-zen/jev-1.13-free'), false)
    assert.equal(catalog.thinks('vercel/openai/gpt-4.1'), false)
    assert.equal(catalog.thinks('opencode-zen/muse-spark-1.3-contributor-free'), true)
    const spark = catalog.reasoningFor('opencode-zen/muse-spark-1.3-contributor-free')
    assert.deepEqual(spark?.efforts.map((effort) => effort.id), ['minimal', 'low', 'medium', 'high', 'xhigh'])
    assert.equal(spark?.defaultEffort, 'medium')
    const terra = catalog.reasoningFor('codex/gpt-5.6-terra')
    assert.deepEqual(terra?.efforts.map((effort) => effort.id), ['low', 'ultra'])
    assert.equal(catalog.reasoningFor('vercel/openai/gpt-4.1'), undefined)
    assert.equal(catalog.contextWindowFor('vercel/openai/gpt-4.1'), 1047576)
    assert.equal(catalog.maxTokensFor('codex/gpt-5.6-terra'), 128000)
    assert.equal(catalog.snapshot().status, 'ready')
  } finally {
    catalog.stop()
  }
})

test('ModelCatalog falls back to the static snapshot while the gateway is down', async () => {
  const fail = (async () => {
    throw new Error('network down')
  }) as typeof fetch
  const catalog = new ModelCatalog({ fetchImpl: fail })
  await catalog.refreshOnce()
  assert.deepEqual(catalog.list(), staticMagpieModels.map((entry) => entry.id))
  assert.equal(catalog.decision('vercel/openai/gpt-4.1').allowed, true)
  assert.equal(catalog.decision('unknown-model').allowed, false)
  assert.equal(catalog.snapshot().status, 'pending')
  assert.equal(catalog.thinks('codex/gpt-5.6-terra'), true)
  assert.deepEqual(catalog.reasoningFor('codex/gpt-5.6-terra')?.efforts.map((e) => e.id), ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'])
  catalog.stop()
})

test('start() fast-retries while the live catalog is empty, then settles', async () => {
  let calls = 0
  const flaky = (async (url: string | URL) => {
    if (String(url).includes('/v1/models')) {
      calls += 1
      if (calls <= 2) throw new Error('network not ready yet')
      return new Response(JSON.stringify(gatewayBody), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    throw new Error('unexpected')
  }) as typeof fetch
  const catalog = new ModelCatalog({ fetchImpl: flaky, startupRetryMs: 5, refreshSeconds: 3600 })
  try {
    await catalog.start()
    assert.equal(catalog.snapshot().total, 4)
    assert.equal(calls, 3)
  } finally {
    catalog.stop()
  }
})
