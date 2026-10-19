import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SettingsStore,
  defaultSettingsPath,
  normalizeBaseUrl,
  migrateLegacySettings,
  normalizeEnabledModels,
  normalizePageSettings,
  resolveEffectiveEndpoint,
} from '../src/settings.ts'
import { ModelCatalog } from '../src/adapter/catalog.ts'

test('normalizeBaseUrl keeps the version path and strips only a trailing slash', () => {
  assert.equal(normalizeBaseUrl('http://127.0.0.1:3425'), 'http://127.0.0.1:3425')
  assert.equal(normalizeBaseUrl('http://127.0.0.1:3425/'), 'http://127.0.0.1:3425')
  // The version segment is the user's to choose: it must survive a save, so a
  // gateway on /v2 or /v3 stays reachable by editing one string.
  assert.equal(normalizeBaseUrl('http://127.0.0.1:3425/v1'), 'http://127.0.0.1:3425/v1')
  assert.equal(normalizeBaseUrl('http://127.0.0.1:3425/v1/'), 'http://127.0.0.1:3425/v1')
  assert.equal(normalizeBaseUrl('http://127.0.0.1:3425/v2'), 'http://127.0.0.1:3425/v2')
  assert.equal(normalizeBaseUrl('https://example.com:8080/api/v3/'), 'https://example.com:8080/api/v3')
  // Query/fragment are never part of a base URL and would corrupt appended paths.
  assert.equal(normalizeBaseUrl('http://127.0.0.1:3425/v1?x=1'), 'http://127.0.0.1:3425/v1')
  assert.equal(normalizeBaseUrl('http://127.0.0.1:3425/v1#frag'), 'http://127.0.0.1:3425/v1')
  assert.throws(() => normalizeBaseUrl(''), /non-empty/)
  assert.throws(() => normalizeBaseUrl('not a url'), /not a valid URL/)
  assert.throws(() => normalizeBaseUrl('ftp://x'), /http\(s\)/)
  assert.throws(() => normalizeBaseUrl(42), /non-empty/)
})

test('normalizeEnabledModels dedupes and rejects junk', () => {
  assert.deepEqual(normalizeEnabledModels(undefined), [])
  assert.deepEqual(normalizeEnabledModels(['a', 'b', 'a', '  ']), ['a', 'b'])
  assert.throws(() => normalizeEnabledModels('a'), /array/)
  assert.throws(() => normalizeEnabledModels([42]), /array of model ids/)
})

test('normalizePageSettings keeps known fields and drops unknown keys', () => {
  assert.deepEqual(normalizePageSettings({ baseUrl: 'http://x/', apiKey: 'k', enabledModels: ['m'], evil: 1 }), {
    baseUrl: 'http://x',
    apiKey: 'k',
    enabledModels: ['m'],
  })
  assert.deepEqual(normalizePageSettings({}), {})
  assert.throws(() => normalizePageSettings(null), /object/)
  assert.throws(() => normalizePageSettings({ baseUrl: 'bogus' }), /valid URL/)
})

test('resolveEffectiveEndpoint prefers the page per field', () => {
  const patch = { baseUrl: 'http://127.0.0.1:3425', apiKey: 'not-needed' }
  assert.deepEqual(resolveEffectiveEndpoint(patch, {}), patch)
  assert.deepEqual(resolveEffectiveEndpoint(patch, { baseUrl: 'http://other' }), { baseUrl: 'http://other', apiKey: 'not-needed' })
  assert.deepEqual(resolveEffectiveEndpoint(patch, { apiKey: 'secret' }), { baseUrl: 'http://127.0.0.1:3425', apiKey: 'secret' })
})

test('defaultSettingsPath lives next to the plugin data dir', () => {
  assert.equal(defaultSettingsPath('/tmp/x'), join('/tmp/x', 'settings.json'))
})

test('SettingsStore round-trips through a file and notifies listeners', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'magpie-settings-'))
  const store = new SettingsStore({ path: join(dir, 'settings.json') })
  assert.deepEqual(store.get(), {})
  let notifications = 0
  const off = store.onChange(() => {
    notifications += 1
  })
  const saved = await store.save({ baseUrl: 'http://127.0.0.1:3425/', apiKey: 'k', enabledModels: ['a'] })
  assert.deepEqual(saved, { baseUrl: 'http://127.0.0.1:3425', apiKey: 'k', enabledModels: ['a'] })
  assert.equal(notifications, 1)
  off()
  // partial save merges
  await store.save({ apiKey: 'k2' })
  assert.equal(store.get().apiKey, 'k2')
  assert.equal(store.get().baseUrl, 'http://127.0.0.1:3425')
  // a fresh store loads the persisted file
  const reloaded = new SettingsStore({ path: join(dir, 'settings.json') })
  await reloaded.load()
  assert.deepEqual(reloaded.get(), { baseUrl: 'http://127.0.0.1:3425', apiKey: 'k2', enabledModels: ['a'] })
  await assert.rejects(store.save({ baseUrl: 'bogus' }), /valid URL/)
})

test('SettingsStore without a path stays in memory', async () => {
  const store = new SettingsStore()
  await store.load()
  await store.save({ enabledModels: ['x'] })
  assert.deepEqual(store.get().enabledModels, ['x'])
})

test('corrupt settings file reads as empty instead of throwing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'magpie-settings-'))
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(dir, 'settings.json'), '{broken')
  const store = new SettingsStore({ path: join(dir, 'settings.json') })
  assert.deepEqual(await store.load(), {})
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

test('catalog allowlist narrows the picker but keeps resolveModel working', async () => {
  const catalog = new ModelCatalog({ fetchImpl: fakeFetch(gatewayBody), baseUrl: 'http://127.0.0.1:3425' })
  try {
    await catalog.refreshOnce()
    assert.deepEqual(catalog.list(), ['a', 'b'])
    // An allowlist is exact membership: 'b' is out even though the gateway serves it.
    catalog.setEnabled(['a'])
    assert.deepEqual(catalog.list(), ['a'])
    assert.deepEqual(catalog.enabled(), ['a'])
    assert.equal(catalog.isEnabled('a'), true)
    assert.equal(catalog.isEnabled('b'), false)
    assert.equal(catalog.decision('b').allowed, false)
    assert.equal(catalog.decision('b').source, 'not_enabled_by_settings')
    assert.equal(catalog.reasoningFor('b')?.efforts.map((e) => e.id).join(','), 'low')
    // null restores inheritance of the whole directory.
    catalog.setEnabled(null)
    assert.deepEqual(catalog.list(), ['a', 'b'])
    assert.equal(catalog.enabled(), null)
  } finally {
    catalog.stop()
  }
})

test('an empty allowlist offers nothing, unlike the old empty blacklist', async () => {
  const catalog = new ModelCatalog({ fetchImpl: fakeFetch(gatewayBody), baseUrl: 'http://127.0.0.1:3425' })
  try {
    await catalog.refreshOnce()
    catalog.setEnabled([])
    assert.deepEqual(catalog.list(), [])
    assert.deepEqual(catalog.directory(), ['a', 'b'])
  } finally {
    catalog.stop()
  }
})

test('the allowlist also filters the static fallback while pending', async () => {
  const fail = (async () => {
    throw new Error('down')
  }) as typeof fetch
  const catalog = new ModelCatalog({ fetchImpl: fail, baseUrl: 'http://127.0.0.1:3425' })
  await catalog.refreshOnce()
  const total = catalog.list().length
  assert.ok(total > 0)
  const keep = catalog.list()[0] as string
  catalog.setEnabled([keep])
  assert.deepEqual(catalog.list(), [keep])
  assert.equal(catalog.list().length, total > 1 ? 1 : total)
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

test('legacy hiddenModels converts to the inverse allowlist', () => {
  // The old document said "hide these"; the new one says "offer these". Reading
  // it unchanged would offer exactly the models the user had removed.
  const known = ['zcode/a', 'zcode/b', 'zcode/c', 'qoder/qfmodel']
  const { settings, migrated } = migrateLegacySettings({ baseUrl: 'http://gw/v1', apiKey: 'k', hiddenModels: ['zcode/b', 'zcode/c'] }, known)
  assert.equal(migrated, true)
  assert.deepEqual(settings, {
    baseUrl: 'http://gw/v1',
    apiKey: 'k',
    enabledModels: ['zcode/a', 'qoder/qfmodel'],
    migratedFromHiddenModels: true,
  })
  assert.equal('hiddenModels' in settings, false, 'the blacklist key is gone')
})

test('migration is idempotent: an already-converted document is left alone', () => {
  const already = { enabledModels: ['a'], migratedFromHiddenModels: true as const }
  const { settings, migrated } = migrateLegacySettings(already, ['a', 'b'])
  assert.equal(migrated, false)
  assert.deepEqual(settings, already)
})

test('a converted document that still carries hiddenModels is not inverted twice', () => {
  // Belt and braces: if a stray hiddenModels survived alongside the marker, the
  // marker wins — re-inverting would silently change which models are offered.
  const { settings, migrated } = migrateLegacySettings(
    { enabledModels: ['a'], hiddenModels: ['a'], migratedFromHiddenModels: true },
    ['a', 'b'],
  )
  assert.equal(migrated, false)
  assert.deepEqual(settings.enabledModels, ['a'])
})

test('migration without a known directory inherits instead of guessing', () => {
  // Cold start with an unreachable gateway: the allowlist cannot be computed, so
  // the document falls back to "inherit everything" rather than to a list that
  // might drop models the user can still use.
  const { settings, migrated } = migrateLegacySettings({ hiddenModels: ['zcode/b'] })
  assert.equal(migrated, true)
  assert.equal(settings.enabledModels, undefined)
  assert.equal(settings.migratedFromHiddenModels, true)
})

test('a file with neither shape is not treated as legacy', () => {
  const { settings, migrated } = migrateLegacySettings({ baseUrl: 'http://gw/v1', apiKey: 'k' }, ['a'])
  assert.equal(migrated, false)
  assert.deepEqual(settings, { baseUrl: 'http://gw/v1', apiKey: 'k' })
})

test('load() rewrites a legacy file on disk exactly once', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'magpie-migrate-'))
  const path = join(dir, 'settings.json')
  const { writeFileSync, readFileSync } = await import('node:fs')
  writeFileSync(path, JSON.stringify({ baseUrl: 'http://gw/v1', apiKey: 'k', hiddenModels: ['b'] }))

  const store = new SettingsStore({ path })
  const loaded = await store.load(['a', 'b', 'c'])
  assert.deepEqual(loaded.enabledModels, ['a', 'c'])

  const onDisk = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  assert.equal('hiddenModels' in onDisk, false)
  assert.deepEqual(onDisk.enabledModels, ['a', 'c'])
  assert.equal(onDisk.migratedFromHiddenModels, true)

  // A second boot must not re-invert the already-converted file.
  const again = new SettingsStore({ path })
  assert.deepEqual((await again.load(['a', 'b', 'c'])).enabledModels, ['a', 'c'])
})
