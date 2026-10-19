import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, DISCOVER_API, MODELS_API, SETTINGS_API, TEST_API, __resetSettingsRoutes, type CandidateRow, type PluginContext } from '../src/index.ts'
import { enabledAfterAdopt } from '../src/client/model-visibility.ts'

const gatewayBody = {
  data: [
    {
      id: 'a',
      display_name: 'A',
      context_window: 100000,
      max_output_tokens: 8000,
      modalities: { input: ['text', 'image'] },
      native_endpoints: ['/v1/chat/completions'],
      reasoning: false,
      supported_reasoning_levels: [],
    },
    {
      id: 'b',
      display_name: 'B',
      context_window: 200000,
      max_output_tokens: 16000,
      modalities: { input: ['text'] },
      native_endpoints: ['/v1/responses'],
      reasoning: true,
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }],
    },
  ],
}

interface Route {
  path: string
  methods: string[]
  fetch: (request: Request) => Promise<Response>
}

function stubContext(): PluginContext & { routes: Route[]; adapters: Array<{ providers: string[] }>; emitted: string[] } {
  const routes: Route[] = []
  const adapters: Array<{ providers: string[] }> = []
  const emitted: string[] = []
  const ctx: PluginContext & { routes: Route[]; adapters: Array<{ providers: string[] }>; emitted: string[] } = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    routes,
    adapters,
    emitted,
    emit: (event: string) => {
      emitted.push(event)
    },
    llm: {
      registerAdapter: (providers: string[], _adapter: unknown) => {
        adapters.push({ providers })
        return () => {}
      },
    },
    get: () => undefined,
    inject: (deps: string[], fn: (child: Record<string, unknown>) => unknown) => {
      if (deps.includes('connection')) {
        fn({
          connection: {
            fetch: {
              register: (route: Route) => {
                // Mirror the real connection registry: routes are keyed by
                // PATH and a second registration of the same path throws.
                if (routes.some((entry) => entry.path === route.path)) {
                  throw new Error(`connection: exact Fetch route ${JSON.stringify(route.path)} is already registered`)
                }
                routes.push(route)
                return () => {}
              },
            },
          },
        })
      }
      return () => {}
    },
    effect: (fn: () => () => void) => fn(),
  }
  return ctx
}

async function withServer(body: unknown): Promise<{ server: Server; origin: string }> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return { server, origin: `http://127.0.0.1:${port}` }
}

/**
 * A gateway whose directory the test moves between requests: a lane's models
 * come and go between refreshes, and that is exactly when the hidden set used to
 * lose a delete.
 */
async function withMutableServer(
  initial: readonly string[],
): Promise<{ server: Server; origin: string; serve: (ids: readonly string[]) => void }> {
  let ids = [...initial]
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        data: ids.map((id) => ({ id, native_endpoints: ['/v1/chat/completions'], reasoning: false })),
      }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return { server, origin: `http://127.0.0.1:${port}`, serve: (next) => (ids = [...next]) }
}

/**
 * A gateway that guards `GET /models` with a Bearer key, exactly like the real
 * Magpie gateway (which answers 401 to a keyless request). The catalog refresh
 * and the fetch dialog must both authenticate.
 */
async function withKeyedServer(body: unknown, key: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${key}`) {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'no API key was sent' } }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return { server, origin: `http://127.0.0.1:${port}` }
}

async function callRoute(routes: Route[], path: string, method: string, body?: unknown): Promise<{ status: number; payload: unknown }> {
  const route = routes.find((entry) => entry.path === path && entry.methods.includes(method))
  assert.ok(route, `route ${method} ${path} registered`)
  const response = await route.fetch(
    new Request(`http://internal${path}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  )
  return { status: response.status, payload: await response.json() }
}

async function settled(tries = 50): Promise<void> {
  for (let i = 0; i < tries; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

test('apply registers the adapter and serves settings/models/test routes', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  const dir = mkdtempSync(join(tmpdir(), 'magpie-apply-'))
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: dir })
  assert.deepEqual(ctx.adapters, [{ providers: ['dsh-magpie-connect'] }])
  await settled()

  const settings = await callRoute(ctx.routes, SETTINGS_API, 'GET')
  assert.equal(settings.status, 200)
  assert.deepEqual((settings.payload as { value: unknown }).value, {
    baseUrl: origin,
    apiKey: 'test-key',
    inheritedModels: true,
    fromPage: {},
    fromPatch: { baseUrl: origin, apiKey: 'test-key' },
  })

  const models = await callRoute(ctx.routes, MODELS_API, 'GET')
  const listed = (models.payload as { value: { models: Array<{ id: string }> } }).value.models.map((row) => row.id)
  assert.deepEqual(listed, ['a', 'b'])

  const probed = await callRoute(ctx.routes, TEST_API, 'POST', { baseUrl: origin, apiKey: 'test-key' })
  assert.equal((probed.payload as { ok: boolean }).ok, true)
  assert.equal((probed.payload as { value: { count: number } }).value.count, 2)
})

test('POST settings persists the allowlist, narrows the picker, and validates', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  const dir = mkdtempSync(join(tmpdir(), 'magpie-apply-'))
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: dir })
  await settled()

  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: ['b'] })
  assert.equal((saved.payload as { ok: boolean }).ok, true)
  assert.deepEqual((saved.payload as { value: unknown }).value, {
    baseUrl: origin,
    apiKey: 'test-key',
    enabledModels: ['b'],
    inheritedModels: false,
  })

  const models = await callRoute(ctx.routes, MODELS_API, 'GET')
  const rows = (models.payload as { value: { models: Array<{ id: string; enabled: boolean }> } }).value.models
  // Both rows are still listed (the directory has them); only 'b' is offered.
  assert.deepEqual(rows.map((row) => row.id).sort(), ['a', 'b'])
  assert.equal(rows.find((row) => row.id === 'b')?.enabled, true)
  assert.equal(rows.find((row) => row.id === 'a')?.enabled, false)

  const bad = await callRoute(ctx.routes, SETTINGS_API, 'POST', { baseUrl: 'bogus' })
  assert.equal((bad.payload as { ok: boolean }).ok, false)
})

test('an autosave that sends only enabledModels leaves credentials untouched', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  // Establish a page-owned endpoint, then edit only the visible set — the
  // shape every remove and adopt takes now. It must not re-commit, blank, or
  // otherwise disturb what the credential form is holding.
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { baseUrl: origin, apiKey: 'page-key' })
  const autosaved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: ['b'] })
  assert.equal((autosaved.payload as { ok: boolean }).ok, true)
  assert.deepEqual((autosaved.payload as { value: unknown }).value, {
    baseUrl: origin,
    apiKey: 'page-key',
    enabledModels: ['b'],
    inheritedModels: false,
  })

  const settings = await callRoute(ctx.routes, SETTINGS_API, 'GET')
  const value = (settings.payload as { value: { apiKey: string; baseUrl: string } }).value
  assert.equal(value.apiKey, 'page-key')
  assert.equal(value.baseUrl, origin)
})

test('test endpoint reports gateway failures instead of throwing', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  const dir = mkdtempSync(join(tmpdir(), 'magpie-apply-'))
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: dir })
  await settled()

  const refused = await callRoute(ctx.routes, TEST_API, 'POST', { baseUrl: 'http://127.0.0.1:1' })
  assert.equal((refused.payload as { ok: boolean }).ok, false)
  const invalid = await callRoute(ctx.routes, TEST_API, 'POST', { baseUrl: 'not a url' })
  assert.equal((invalid.payload as { ok: boolean }).ok, false)
})

test('missing apiKey gates the picker, saves, and the test probe', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  const dir = mkdtempSync(join(tmpdir(), 'magpie-apply-'))
  __resetSettingsRoutes()
  const ctx = stubContext()
  // URL set but no key anywhere: treated as unconfigured.
  apply(ctx, { baseUrl: origin, refreshSeconds: 3600, dataDir: dir })
  await settled()

  const models = await callRoute(ctx.routes, MODELS_API, 'GET')
  assert.deepEqual((models.payload as { value: { models: unknown[] } }).value.models, [])

  const emptyKey = await callRoute(ctx.routes, SETTINGS_API, 'POST', { apiKey: '' })
  assert.equal((emptyKey.payload as { ok: boolean }).ok, false)
  const blankKey = await callRoute(ctx.routes, SETTINGS_API, 'POST', { apiKey: '   ' })
  assert.equal((blankKey.payload as { ok: boolean }).ok, false)

  const probe = await callRoute(ctx.routes, TEST_API, 'POST', { baseUrl: origin })
  assert.equal((probe.payload as { ok: boolean }).ok, false)

  // Saving a key completes the configuration: the picker fills on next refresh.
  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { apiKey: 'k' })
  assert.equal((saved.payload as { ok: boolean }).ok, true)
  await settled()
  const after = await callRoute(ctx.routes, MODELS_API, 'GET')
  assert.deepEqual(
    (after.payload as { value: { models: Array<{ id: string }> } }).value.models.map((row) => row.id),
    ['a', 'b'],
  )
})

test('narrowing the allowlist emits llm/adapters-updated so the picker re-reads', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()
  const afterStart = ctx.emitted.filter((event) => event === 'llm/adapters-updated').length
  assert.equal(afterStart, 1, 'the first catalog fill announces')

  // The picker caches one catalog read per Host generation and re-reads only
  // on this event, so a save that narrows the allowlist must publish it.
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: ['b'] })
  assert.equal(ctx.emitted.filter((event) => event === 'llm/adapters-updated').length, afterStart + 1)

  // Re-saving the same set changes nothing exposed: no extra event.
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: ['b'] })
  assert.equal(ctx.emitted.filter((event) => event === 'llm/adapters-updated').length, afterStart + 1)

  await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: [] })
  assert.equal(ctx.emitted.filter((event) => event === 'llm/adapters-updated').length, afterStart + 2)
})

test('switching the gateway origin empties the stale directory and announces it', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  const other = await withServer(gatewayBody)
  t.after(() => {
    server.close()
    other.server.close()
  })
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()
  const afterStart = ctx.emitted.filter((event) => event === 'llm/adapters-updated').length

  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { baseUrl: other.origin, apiKey: 'test-key' })
  assert.equal((saved.payload as { ok: boolean }).ok, true)
  // The old origin's models must not stay in the picker while the new
  // directory is still warming up.
  assert.equal(
    ctx.emitted.filter((event) => event === 'llm/adapters-updated').length > afterStart,
    true,
    'an origin change announces',
  )
})

test('discover returns full candidate rows for the fetch dialog', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  const found = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: origin, apiKey: 'test-key' })
  assert.equal((found.payload as { ok: boolean }).ok, true)
  const value = (found.payload as { value: { count: number; models: Array<Record<string, unknown>> } }).value
  assert.equal(value.count, 2)
  assert.deepEqual(
    value.models.map((row) => row.id),
    ['a', 'b'],
  )
  // The dialog renders the same chips the list does, so discovery must carry
  // the capabilities — not just ids.
  const a = value.models.find((row) => row.id === 'a')
  assert.equal(a?.image, true)
  assert.equal(a?.contextWindow, 100000)
  const b = value.models.find((row) => row.id === 'b')
  assert.equal(b?.responsesOnly, true)
  assert.equal(b?.reasoning, true)
  assert.deepEqual(b?.efforts, ['low', 'medium'])
})

test('discover asks the endpoint the form shows, not the saved one', async (t) => {
  const saved = await withServer(gatewayBody)
  const typed = await withServer({ data: [{ id: 'typed-only' }] })
  t.after(() => {
    saved.server.close()
    typed.server.close()
  })
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: saved.origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  // Filling in a gateway must be one pass: the unsaved URL answers, so the
  // dialog can list candidates before the user commits anything.
  const found = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: typed.origin, apiKey: 'typed-key' })
  const value = (found.payload as { value: { models: Array<{ id: string }> } }).value
  assert.deepEqual(value.models.map((row) => row.id), ['typed-only'])
})

test('discover reports gateway failures and a missing key instead of throwing', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  const refused = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: 'http://127.0.0.1:1' })
  assert.equal((refused.payload as { ok: boolean }).ok, false)
  const invalid = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: 'not a url' })
  assert.equal((invalid.payload as { ok: boolean }).ok, false)
  const noKey = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: origin, apiKey: '   ' })
  assert.equal((noKey.payload as { ok: boolean }).ok, false)
  assert.match((noKey.payload as { error: string }).error, /apiKey is required/)
})

test('the allowlist keeps an id the gateway no longer serves, harmlessly', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  // 'ghost' is not in the directory. It is stored as submitted — the list is a
  // statement of intent, and silently dropping an entry would be a delete the
  // user never asked for — but it can never appear as a row or be offered.
  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: ['a', 'ghost'] })
  assert.deepEqual((saved.payload as { value: { enabledModels?: string[] } }).value.enabledModels, ['a', 'ghost'])

  const listed = await callRoute(ctx.routes, MODELS_API, 'GET')
  const rows = (listed.payload as { value: { models: Array<{ id: string; enabled: boolean; source: string }> } }).value.models
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b'], 'only directory ids get rows')
  assert.equal(rows.find((row) => row.id === 'a')?.enabled, true)
  assert.equal(rows.find((row) => row.id === 'b')?.enabled, false)
  assert.equal(rows.find((row) => row.id === 'a')?.source, 'gateway')
})

test('the models list flags each row with its allowlist state and source', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: ['b'] })

  const listed = await callRoute(ctx.routes, MODELS_API, 'GET')
  const rows = (listed.payload as { value: { models: Array<{ id: string; enabled: boolean; source: string }> } }).value.models
  assert.deepEqual(rows.map((entry) => [entry.id, entry.enabled, entry.source]), [
    ['a', false, 'gateway'],
    ['b', true, 'gateway'],
  ])
})

test('the allowlist survives a gateway that drops and later re-lists a model', async (t) => {
  // The original bug, end to end. Three zcode models are allowed; the gateway
  // then drops two; a fetch+apply for an unrelated model must not hand them
  // back when the lane returns, because only an explicit add can do that.
  const zcode = ['zcode/GLM-5.3-Flash', 'zcode/DeepSeek-V3', 'zcode/GLM-4.6']
  const { server, origin, serve } = await withMutableServer([...zcode, 'qoder/qfmodel'])
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  // The user removes all three zcode rows from the list.
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: ['qoder/qfmodel'] })
  let rows = ((await callRoute(ctx.routes, MODELS_API, 'GET')).payload as { value: { models: Array<{ id: string; enabled: boolean }> } }).value.models
  assert.deepEqual(rows.filter((row) => row.enabled).map((row) => row.id), ['qoder/qfmodel'])

  // The gateway stops listing two of them.
  serve(['zcode/GLM-5.3-Flash', 'qoder/qfmodel'])
  const found = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: origin, apiKey: 'test-key' })
  const candidates = (found.payload as { value: { models: CandidateRow[] } }).value.models
  assert.deepEqual(candidates.map((row) => row.id).sort(), ['qoder/qfmodel', 'zcode/GLM-5.3-Flash'])

  // The dialog pre-ticks what is offered, so Apply keeps exactly that.
  const picked = new Set(['qoder/qfmodel'])
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: enabledAfterAdopt(candidates, picked) })
  rows = ((await callRoute(ctx.routes, MODELS_API, 'GET')).payload as { value: { models: Array<{ id: string; enabled: boolean }> } }).value.models
  assert.deepEqual(rows.filter((row) => row.enabled).map((row) => row.id), ['qoder/qfmodel'])

  // The lane returns in full, plus a model the user never saw. Nothing is
  // offered that the user did not declare.
  serve([...zcode, 'qoder/qfmodel', 'kiro/deepseek-3.2'])
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { baseUrl: origin, apiKey: 'test-key' })
  rows = ((await callRoute(ctx.routes, MODELS_API, 'GET')).payload as { value: { models: Array<{ id: string; enabled: boolean }> } }).value.models
  assert.deepEqual(rows.filter((row) => row.enabled).map((row) => row.id), ['qoder/qfmodel'])
  assert.deepEqual(rows.map((row) => row.id).sort(), ['kiro/deepseek-3.2', 'qoder/qfmodel', ...zcode].sort())
})

test('fetching available models drops models the gateway no longer lists', async (t) => {
  // The user's scenario: the local directory holds zcode/a,b,c, the gateway now
  // serves only zcode/a. Opening the dialog shows only zcode/a — and the list
  // must agree immediately, without waiting for a background refresh (which on
  // a key-guarded gateway used to fail silently and keep b/c forever).
  const { server, origin, serve } = await withMutableServer(['zcode/a', 'zcode/b', 'zcode/c', 'qoder/qfmodel'])
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  let listed = await callRoute(ctx.routes, MODELS_API, 'GET')
  let rows = (listed.payload as { value: { models: Array<{ id: string }> } }).value.models
  assert.deepEqual(rows.map((row) => row.id).sort(), ['qoder/qfmodel', 'zcode/a', 'zcode/b', 'zcode/c'])

  serve(['zcode/a'])
  const found = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: origin, apiKey: 'test-key' })
  const candidates = (found.payload as { value: { models: CandidateRow[] } }).value.models
  assert.deepEqual(candidates.map((row) => row.id), ['zcode/a'])

  // No Apply needed: the fetch itself adopted the gateway's directory, so the
  // list can no longer show models the dialog does not offer.
  listed = await callRoute(ctx.routes, MODELS_API, 'GET')
  rows = (listed.payload as { value: { models: Array<{ id: string }> } }).value.models
  assert.deepEqual(rows.map((row) => row.id), ['zcode/a'])
})

test('a failed fetch leaves the local directory intact', async (t) => {
  // A bad endpoint must not be read as "the gateway serves nothing": the
  // directory would blank the picker.
  const { server, origin } = await withMutableServer(['zcode/a', 'zcode/b'])
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  const failed = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: 'http://127.0.0.1:1', apiKey: 'test-key' })
  assert.equal((failed.payload as { ok: boolean }).ok, false)

  const listed = await callRoute(ctx.routes, MODELS_API, 'GET')
  const rows = (listed.payload as { value: { models: Array<{ id: string }> } }).value.models
  assert.deepEqual(rows.map((row) => row.id), ['zcode/a', 'zcode/b'])
})

test('adopting a model the dialog just fetched makes it appear in the list', async (t) => {
  // End-to-end shape of the reported bug: the dialog asks the endpoint the form
  // shows (which authenticates), the user ticks a model, and the list — which
  // had been serving the static snapshot — must show the ticked row.
  const gateway = { data: [...gatewayBody.data, { id: 'amd/GLM-5.3-Flash', display_name: 'GLM', native_endpoints: ['/v1/chat/completions'], reasoning: false }] }
  const { server, origin } = await withKeyedServer(gateway, 'test-key')
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  const found = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: origin, apiKey: 'test-key' })
  assert.equal((found.payload as { ok: boolean }).ok, true)
  const candidates = (found.payload as { value: { models: Array<{ id: string }> } }).value.models.map((row) => row.id)
  assert.ok(candidates.includes('amd/GLM-5.3-Flash'), 'the dialog lists the AMD model')

  // Tick everything and adopt: the hidden set is empty, so every candidate is on.
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: [] })

  const listed = await callRoute(ctx.routes, MODELS_API, 'GET')
  const rows = (listed.payload as { value: { models: Array<{ id: string; enabled: boolean }> } }).value.models
  const amd = rows.find((row) => row.id === 'amd/GLM-5.3-Flash')
  assert.ok(amd, 'the adopted AMD model has a row in the list')
  assert.equal(amd?.enabled, false)
})

test('a key-only save re-reads the directory before the page reloads its rows', async (t) => {
  const { server, origin } = await withKeyedServer(gatewayBody, 'rotated')
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  // Starts on the wrong key: the refresh 401s, so the picker serves the
  // compile-time static snapshot rather than this gateway's live directory.
  apply(ctx, { baseUrl: origin, apiKey: 'stale', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()
  const before = await callRoute(ctx.routes, MODELS_API, 'GET')
  const staleIds = (before.payload as { value: { models: Array<{ id: string }> } }).value.models.map((row) => row.id)
  assert.ok(staleIds.length > 0, 'the static snapshot covers the unreachable gateway')
  assert.ok(!staleIds.includes('a'), 'the live directory was never read')

  // Saving the right key must refresh the catalog before answering, because
  // the page re-reads the rows immediately after this response.
  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { apiKey: 'rotated' })
  assert.equal((saved.payload as { ok: boolean }).ok, true)
  const after = await callRoute(ctx.routes, MODELS_API, 'GET')
  assert.deepEqual(
    (after.payload as { value: { models: Array<{ id: string }> } }).value.models.map((row) => row.id),
    ['a', 'b'],
  )
})

test('an unreachable gateway still lets a save answer (the refresh wait is bounded)', async (t) => {
  // The credential write is durable before the refresh is attempted, so a
  // gateway that never answers must not turn a successful save into a timeout.
  const blackhole = createServer(() => {
    // Accept the request and never answer: the catalog fetch hangs here.
  })
  await new Promise<void>((resolve) => blackhole.listen(0, '127.0.0.1', resolve))
  t.after(() => blackhole.close())
  const address = blackhole.address()
  const hanging = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`

  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: 'http://127.0.0.1:1', apiKey: 'stale', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  const started = Date.now()
  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { baseUrl: hanging, apiKey: 'test-key' })
  assert.equal((saved.payload as { ok: boolean }).ok, true)
  assert.equal((saved.payload as { value: { apiKey: string } }).value.apiKey, 'test-key')
  assert.ok(Date.now() - started < 30_000, 'the save answered without waiting out the gateway')
})

test('startup warms the directory with the saved endpoint, not the defaults', async (t) => {
  // Regression: warming the catalog before applying the persisted document
  // pointed it at the patch/default endpoint. That fetch failed, the directory
  // stayed empty, and the settings page rendered the built-in snapshot — four
  // rows instead of the eight the user had saved.
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const dir = mkdtempSync(join(tmpdir(), 'magpie-boot-'))
  const { writeFileSync } = await import('node:fs')
  writeFileSync(
    join(dir, 'settings.json'),
    JSON.stringify({ baseUrl: origin, apiKey: 'saved-key', enabledModels: ['a'], migratedFromHiddenModels: true }),
  )

  const ctx = stubContext()
  // The patch config points nowhere: only the persisted file knows the gateway.
  apply(ctx, { baseUrl: 'http://127.0.0.1:1/v1', apiKey: '', refreshSeconds: 3600, dataDir: dir })
  await settled(100)

  const listed = await callRoute(ctx.routes, MODELS_API, 'GET')
  const value = (listed.payload as { value: { models: Array<{ id: string; source: string }>; snapshot: { status: string; total: number } } }).value
  assert.deepEqual(value.models.map((row) => row.id), ['a', 'b'], 'the live directory was read')
  assert.equal(value.models.every((row) => row.source === 'gateway'), true)
  assert.equal(value.snapshot.status, 'ready')
  assert.equal(value.snapshot.total, 2)
})
