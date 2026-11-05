import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig, defaults } from '../src/config.ts'

test('resolveConfig fills defaults and keeps overrides', () => {
  const base = resolveConfig()
  assert.equal(base.providerId, defaults.providerId)
  assert.equal(base.displayName, 'Magpie')
  // The address ships with the conventional local gateway so a first run has
  // somewhere to point; the key stays empty, and `isConfigured` still gates on
  // both, so the picker is not usable until the user saves one.
  assert.equal(base.baseUrl, 'http://127.0.0.1:3425/v1')
  assert.equal(base.apiKey, '')
  assert.equal(base.refreshSeconds, 300)
  assert.equal(base.maxRetries, 2)
  assert.equal(base.timeoutMs, 300_000)
  assert.equal(base.firstEventTimeoutMs, 90_000)
  assert.equal(base.idleTimeoutMs, 60_000)
  const custom = resolveConfig({ providerId: 'x', refreshSeconds: 60 })
  assert.equal(custom.providerId, 'x')
  assert.equal(custom.displayName, 'x')
  assert.equal(custom.refreshSeconds, 60)
})

test('timeout/retry/watchdog knobs are configurable', () => {
  const custom = resolveConfig({ maxRetries: 0, timeoutMs: 1000, firstEventTimeoutMs: 0, idleTimeoutMs: 5000 })
  assert.equal(custom.maxRetries, 0)
  assert.equal(custom.timeoutMs, 1000)
  assert.equal(custom.firstEventTimeoutMs, 0)
  assert.equal(custom.idleTimeoutMs, 5000)
})

test('displayName overrides the picker label without touching the route id', () => {
  const renamed = resolveConfig({ displayName: 'LAN Models' })
  assert.equal(renamed.providerId, defaults.providerId)
  assert.equal(renamed.displayName, 'LAN Models')
})

test('baseUrl/apiKey point at the LAN gateway by default and accept overrides', () => {
  const custom = resolveConfig({ baseUrl: 'http://192.168.1.10:8080/', apiKey: 'secret' })
  assert.equal(custom.baseUrl, 'http://192.168.1.10:8080/')
  assert.equal(custom.apiKey, 'secret')
})

test('dataDir defaults under the Harness home storages dir and accepts overrides', () => {
  const base = resolveConfig()
  assert.match(base.dataDir, /[\\/]storages[\\/]magpie-connect$/)
  assert.equal(resolveConfig({ dataDir: '/tmp/x' }).dataDir, '/tmp/x')
})

test('dataDir honours DSH_HOME and legacyDataDir stays homedir-based', async () => {
  const { resolveConfig: freshResolve } = await import('../src/config.ts')
  const { legacyDataDir, resolveDshHome } = await import('../src/homeDir.ts')
  const saved = process.env.DSH_HOME
  try {
    process.env.DSH_HOME = '/tmp/dsh-home-test'
    // Config reads $DSH_HOME at resolve time.
    assert.equal(freshResolve().dataDir, '/tmp/dsh-home-test/storages/magpie-connect')
    assert.equal(resolveDshHome(), '/tmp/dsh-home-test')
    // A blank override must be treated as unset, never resolving to cwd.
    process.env.DSH_HOME = '   '
    assert.match(freshResolve().dataDir, /[\\/]storages[\\/]magpie-connect$/)
    assert.notEqual(freshResolve().dataDir, '   /storages/magpie-connect')
  } finally {
    if (saved === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = saved
  }
  // The pre-0.5 directory is homedir-based and must ignore DSH_HOME, or an
  // upgrade would look for the old file in the new root and lose it.
  const saved2 = process.env.DSH_HOME
  try {
    process.env.DSH_HOME = '/tmp/ignored-home'
    assert.match(legacyDataDir(), /[\\/]\.dsh-magpie-connect$/)
    assert.equal(legacyDataDir().includes('/tmp/ignored-home'), false)
  } finally {
    if (saved2 === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = saved2
  }
})
