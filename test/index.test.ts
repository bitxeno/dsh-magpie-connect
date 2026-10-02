import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, DISCOVER_API, MODELS_API, SETTINGS_API, TEST_API, __resetSettingsRoutes, type PluginContext } from '../src/index.ts'

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
    hiddenModels: [],
    fromPage: { hiddenModels: [] },
    fromPatch: { baseUrl: origin, apiKey: 'test-key' },
  })

  const models = await callRoute(ctx.routes, MODELS_API, 'GET')
  const listed = (models.payload as { value: { models: Array<{ id: string }> } }).value.models.map((row) => row.id)
  assert.deepEqual(listed, ['a', 'b'])

  const probed = await callRoute(ctx.routes, TEST_API, 'POST', { baseUrl: origin, apiKey: 'test-key' })
  assert.equal((probed.payload as { ok: boolean }).ok, true)
  assert.equal((probed.payload as { value: { count: number } }).value.count, 2)
})

test('POST settings persists, hides models from the picker, and validates', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  const dir = mkdtempSync(join(tmpdir(), 'magpie-apply-'))
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: dir })
  await settled()

  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { hiddenModels: ['b'] })
  assert.equal((saved.payload as { ok: boolean }).ok, true)
  assert.deepEqual((saved.payload as { value: unknown }).value, { baseUrl: origin, apiKey: 'test-key', hiddenModels: ['b'] })

  const models = await callRoute(ctx.routes, MODELS_API, 'GET')
  const rows = (models.payload as { value: { models: Array<{ id: string; hidden: boolean }> } }).value.models
  assert.deepEqual(rows.map((row) => row.id).sort(), ['a', 'b'])
  assert.deepEqual(rows.find((row) => row.id === 'b')?.hidden, true)

  const bad = await callRoute(ctx.routes, SETTINGS_API, 'POST', { baseUrl: 'bogus' })
  assert.equal((bad.payload as { ok: boolean }).ok, false)
})

test('an autosave that sends only hiddenModels leaves credentials untouched', async (t) => {
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
  const autosaved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { hiddenModels: ['b'] })
  assert.equal((autosaved.payload as { ok: boolean }).ok, true)
  assert.deepEqual((autosaved.payload as { value: unknown }).value, {
    baseUrl: origin,
    apiKey: 'page-key',
    hiddenModels: ['b'],
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

test('hiding models emits llm/adapters-updated so the picker re-reads', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()
  const afterStart = ctx.emitted.filter((event) => event === 'llm/adapters-updated').length
  assert.equal(afterStart, 1, 'the first catalog fill announces')

  // The picker caches one catalog read per Host generation and re-reads only
  // on this event, so a save that hides a model must publish it.
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { hiddenModels: ['b'] })
  assert.equal(ctx.emitted.filter((event) => event === 'llm/adapters-updated').length, afterStart + 1)

  // Re-saving the same set changes nothing exposed: no extra event.
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { hiddenModels: ['b'] })
  assert.equal(ctx.emitted.filter((event) => event === 'llm/adapters-updated').length, afterStart + 1)

  await callRoute(ctx.routes, SETTINGS_API, 'POST', { hiddenModels: [] })
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

test('saving prunes hidden ids the gateway no longer serves', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  // 'a' is served, 'ghost' is not: the page can only ever show live rows, so a
  // stale id could never be seen or cleared again — it must not be stored.
  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { hiddenModels: ['a', 'ghost'] })
  assert.deepEqual((saved.payload as { value: { hiddenModels: string[] } }).value.hiddenModels, ['a'])

  const settings = await callRoute(ctx.routes, SETTINGS_API, 'GET')
  assert.deepEqual((settings.payload as { value: { hiddenModels: string[] } }).value.hiddenModels, ['a'])
})

test('pruning keeps the submitted set when the directory is still empty', async (t) => {
  // An unreachable gateway must not silently wipe the user's hidden set: with
  // nothing to prune against, the submitted ids are stored as-is.
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: 'http://127.0.0.1:1', apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { hiddenModels: ['kept', 'also-kept'] })
  assert.deepEqual((saved.payload as { value: { hiddenModels: string[] } }).value.hiddenModels, ['kept', 'also-kept'])
})

test('overlapping generations share routes and serve the newest backend', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const first = stubContext()
  apply(first, { baseUrl: origin, apiKey: 'key-one', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  // Second generation overlaps the first (hot reload): no throw, routes shared.
  const second = stubContext()
  apply(second, { baseUrl: origin, apiKey: 'key-two', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  // The second generation registered nothing into its own stub, but the shared
  // routes answer with the newest backend.
  assert.equal(second.routes.length, 0)
  const settings = await callRoute(first.routes, SETTINGS_API, 'GET')
  assert.equal((settings.payload as { value: { apiKey: string } }).value.apiKey, 'key-two')
})

test('every endpoint registers exactly one route per path (POST is never lost)', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  // The connection registry keys routes by path, so a second entry for the
  // same path is dropped — which silently killed POST /api/magpie-settings
  // (the save button) while GET kept working.
  const paths = ctx.routes.map((route) => route.path)
  assert.deepEqual([...new Set(paths)], paths, `each path registers once: ${paths.join(', ')}`)

  const settings = ctx.routes.find((route) => route.path === SETTINGS_API)
  assert.ok(settings, 'settings route registered')
  assert.deepEqual([...settings.methods].sort(), ['GET', 'POST'])
})
