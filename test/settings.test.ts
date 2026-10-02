import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SettingsStore,
  defaultSettingsPath,
  normalizeBaseUrl,
  normalizeHiddenModels,
  normalizePageSettings,
  resolveEffectiveEndpoint,
} from '../src/settings.ts'
import { ModelCatalog } from '../src/adapter/catalog.ts'

test('normalizeBaseUrl keeps the version path and strips only a trailing slash', () => {
  assert.equal(normalizeBaseUrl('http://api.lan'), 'http://api.lan')
  assert.equal(normalizeBaseUrl('http://api.lan/'), 'http://api.lan')
  // The version segment is the user's to choose: it must survive a save, so a
  // gateway on /v2 or /v3 stays reachable by editing one string.
  assert.equal(normalizeBaseUrl('http://api.lan/v1'), 'http://api.lan/v1')
  assert.equal(normalizeBaseUrl('http://api.lan/v1/'), 'http://api.lan/v1')
  assert.equal(normalizeBaseUrl('http://api.lan/v2'), 'http://api.lan/v2')
  assert.equal(normalizeBaseUrl('https://example.com:8080/api/v3/'), 'https://example.com:8080/api/v3')
  // Query/fragment are never part of a base URL and would corrupt appended paths.
  assert.equal(normalizeBaseUrl('http://api.lan/v1?x=1'), 'http://api.lan/v1')
  assert.equal(normalizeBaseUrl('http://api.lan/v1#frag'), 'http://api.lan/v1')
  assert.throws(() => normalizeBaseUrl(''), /non-empty/)
  assert.throws(() => normalizeBaseUrl('not a url'), /not a valid URL/)
  assert.throws(() => normalizeBaseUrl('ftp://x'), /http\(s\)/)
  assert.throws(() => normalizeBaseUrl(42), /non-empty/)
})

test('normalizeHiddenModels dedupes and rejects junk', () => {
  assert.deepEqual(normalizeHiddenModels(undefined), [])
  assert.deepEqual(normalizeHiddenModels(['a', 'b', 'a', '  ']), ['a', 'b'])
  assert.throws(() => normalizeHiddenModels('a'), /array/)
  assert.throws(() => normalizeHiddenModels([42]), /array of model ids/)
})

test('normalizePageSettings keeps known fields and drops unknown keys', () => {
  assert.deepEqual(normalizePageSettings({ baseUrl: 'http://x/', apiKey: 'k', hiddenModels: ['m'], evil: 1 }), {
    baseUrl: 'http://x',
    apiKey: 'k',
    hiddenModels: ['m'],
  })
  assert.deepEqual(normalizePageSettings({}), {})
  assert.throws(() => normalizePageSettings(null), /object/)
  assert.throws(() => normalizePageSettings({ baseUrl: 'bogus' }), /valid URL/)
})

test('resolveEffectiveEndpoint prefers the page per field', () => {
  const patch = { baseUrl: 'http://api.lan', apiKey: 'not-needed' }
  assert.deepEqual(resolveEffectiveEndpoint(patch, {}), patch)
  assert.deepEqual(resolveEffectiveEndpoint(patch, { baseUrl: 'http://other' }), { baseUrl: 'http://other', apiKey: 'not-needed' })
  assert.deepEqual(resolveEffectiveEndpoint(patch, { apiKey: 'secret' }), { baseUrl: 'http://api.lan', apiKey: 'secret' })
})

test('defaultSettingsPath lives next to the plugin data dir', () => {
  assert.equal(defaultSettingsPath('/tmp/x'), join('/tmp/x', 'settings.json'))
})

test('SettingsStore round-trips through a file and notifies listeners', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'magpie-settings-'))
  const store = new SettingsStore({ path: join(dir, 'settings.json') })
  assert.deepEqual(store.get(), { hiddenModels: [] })
  let notifications = 0
  const off = store.onChange(() => {
    notifications += 1
  })
  const saved = await store.save({ baseUrl: 'http://api.lan/', apiKey: 'k', hiddenModels: ['a'] })
  assert.deepEqual(saved, { baseUrl: 'http://api.lan', apiKey: 'k', hiddenModels: ['a'] })
  assert.equal(notifications, 1)
  off()
  // partial save merges
  await store.save({ apiKey: 'k2' })
  assert.equal(store.get().apiKey, 'k2')
  assert.equal(store.get().baseUrl, 'http://api.lan')
  // a fresh store loads the persisted file
  const reloaded = new SettingsStore({ path: join(dir, 'settings.json') })
  await reloaded.load()
  assert.deepEqual(reloaded.get(), { baseUrl: 'http://api.lan', apiKey: 'k2', hiddenModels: ['a'] })
  await assert.rejects(store.save({ baseUrl: 'bogus' }), /valid URL/)
})

test('SettingsStore without a path stays in memory', async () => {
  const store = new SettingsStore()
  await store.load()
  await store.save({ hiddenModels: ['x'] })
  assert.deepEqual(store.get().hiddenModels, ['x'])
})

test('corrupt settings file reads as empty instead of throwing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'magpie-settings-'))
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(dir, 'settings.json'), '{broken')
  const store = new SettingsStore({ path: join(dir, 'settings.json') })
  assert.deepEqual(await store.load(), { hiddenModels: [] })
})

function fakeFetch(body: unknown) {
  return (async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
}

const gatewayBody = {
  data: [
    { id: 'a', native_endpoints: ['/v1/chat/completions'], reasoning: false },
    { id: 'b', native_endpoints: ['/v1/responses'], reasoning: true, supported_reasoning_levels: [{ effort: 'low' }] },
  ],
}

test('catalog hidden set filters the picker but keeps resolveModel working', async () => {
  const catalog = new ModelCatalog({ fetchImpl: fakeFetch(gatewayBody), baseUrl: 'http://api.lan' })
  try {
    await catalog.refreshOnce()
    assert.deepEqual(catalog.list(), ['a', 'b'])
    catalog.setHidden(['b', 'unknown-id'])
    assert.deepEqual(catalog.list(), ['a'])
    assert.deepEqual(catalog.hidden(), ['b', 'unknown-id'])
    assert.equal(catalog.isHidden('b'), true)
    assert.equal(catalog.isHidden('a'), false)
    assert.equal(catalog.decision('b').allowed, false)
    assert.equal(catalog.decision('b').source, 'hidden_by_settings')
    assert.equal(catalog.reasoningFor('b')?.efforts.map((e) => e.id).join(','), 'low')
    catalog.setHidden([])
    assert.deepEqual(catalog.list(), ['a', 'b'])
  } finally {
    catalog.stop()
  }
})

test('catalog hidden set also filters the static fallback while pending', async () => {
  const fail = (async () => {
    throw new Error('down')
  }) as typeof fetch
  const catalog = new ModelCatalog({ fetchImpl: fail, baseUrl: 'http://api.lan' })
  await catalog.refreshOnce()
  const total = catalog.list().length
  assert.ok(total > 0)
  catalog.setHidden([catalog.list()[0] as string])
  assert.equal(catalog.list().length, total - 1)
  catalog.stop()
})

test('catalog setBaseUrl switches the refresh origin', async () => {
  const seen: string[] = []
  const impl = (async (url: string | URL) => {
    seen.push(String(url))
    return new Response(JSON.stringify(gatewayBody), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  const catalog = new ModelCatalog({ fetchImpl: impl, baseUrl: 'http://one/v1' })
  try {
    await catalog.refreshOnce()
    catalog.setBaseUrl('http://two/v2/')
    assert.equal(catalog.baseUrl, 'http://two/v2')
    await catalog.refreshOnce()
    assert.ok(seen.some((url) => url.startsWith('http://two/v2/models')))
  } finally {
    catalog.stop()
  }
})

test('isConfigured requires both URL and key', async () => {
  const { isConfigured } = await import('../src/settings.ts')
  assert.equal(isConfigured({ baseUrl: '', apiKey: '' }), false)
  assert.equal(isConfigured({ baseUrl: 'http://x', apiKey: '' }), false)
  assert.equal(isConfigured({ baseUrl: '', apiKey: 'k' }), false)
  assert.equal(isConfigured({ baseUrl: 'http://x', apiKey: 'k' }), true)
})

test('empty apiKey is rejected on save', async () => {
  assert.throws(() => normalizePageSettings({ apiKey: '' }), /apiKey is required/)
  assert.throws(() => normalizePageSettings({ apiKey: '   ' }), /apiKey is required/)
})

test('apiKey surrounding whitespace is trimmed on save', async () => {
  assert.deepEqual(normalizePageSettings({ apiKey: '  k  ' }), { apiKey: 'k' })
})
