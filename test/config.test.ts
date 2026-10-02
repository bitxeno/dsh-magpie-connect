import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig, defaults } from '../src/config.ts'

test('resolveConfig fills defaults and keeps overrides', () => {
  const base = resolveConfig()
  assert.equal(base.providerId, defaults.providerId)
  assert.equal(base.displayName, 'magpie')
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

test('dataDir defaults to the home dotdir and accepts overrides', () => {
  assert.match(resolveConfig().dataDir, /\.dsh-magpie-connect$/)
  assert.equal(resolveConfig({ dataDir: '/tmp/x' }).dataDir, '/tmp/x')
})
