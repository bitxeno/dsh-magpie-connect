import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, MODELS_API, SETTINGS_API, TEST_API, type PluginContext } from '../src/index.ts'

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

function stubContext(): PluginContext & { routes: Route[]; adapters: Array<{ providers: string[] }> } {
  const routes: Route[] = []
  const adapters: Array<{ providers: string[] }> = []
  const ctx: PluginContext & { routes: Route[]; adapters: Array<{ providers: string[] }> } = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    routes,
    adapters,
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

test('test endpoint reports gateway failures instead of throwing', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  const dir = mkdtempSync(join(tmpdir(), 'magpie-apply-'))
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
