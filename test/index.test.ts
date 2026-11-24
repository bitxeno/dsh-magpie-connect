import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import os, { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  apply,
  DISCOVER_API,
  MCP_TEST_API,
  MODELS_API,
  SEARCH_TEST_API,
  SETTINGS_API,
  TEST_API,
  __resetSettingsRoutes,
  type CandidateRow,
  type PluginContext,
} from '../src/index.ts'
import type { WebSearchProvider } from '../src/search.ts'
import { enabledAfterAdopt } from '../src/client/model-visibility.ts'

const gatewayBody = {
  data: [
    {
      id: 'a',
      display_name: 'A',
      magpie_label: 'A · Alpha',
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
      magpie_label: 'B · Beta',
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

interface StubContextOptions {
  withWeb?: boolean
  withSettings?: boolean
  initialSearchProvider?: string
  writable?: boolean
  /** 模拟 DSH WebRuntime 通过微任务异步释放搜索提供方的场景。 */
  asyncWebDispose?: boolean
  /** 预设已被外部插件占用的搜索提供方 id。 */
  preRegisteredSearchProviders?: readonly WebSearchProvider[]
  /** 注入 `settings.mutate` 失败钩子，验证原子性。 */
  mutateError?: () => Error | undefined
  /** 是否提供 `ctx.tools`（默认提供；设 false 模拟没有工具服务的精简组合）。 */
  withTools?: boolean
}

function stubContext(options: StubContextOptions = {}): PluginContext & {
  routes: Route[]
  adapters: Array<{ providers: string[] }>
  emitted: string[]
  searchProviders: Map<string, WebSearchProvider>
  webConfig: { searchProvider?: string }
  disposers: Array<() => unknown>
  registeredTools: Map<string, unknown>
} {
  const routes: Route[] = []
  const adapters: Array<{ providers: string[] }> = []
  const emitted: string[] = []
  const searchProviders = new Map<string, WebSearchProvider>(
    (options.preRegisteredSearchProviders ?? []).map((provider) => [provider.id, provider]),
  )
  const webConfig: { searchProvider?: string } = {
    ...(options.initialSearchProvider !== undefined ? { searchProvider: options.initialSearchProvider } : {}),
  }
  const disposers: Array<() => unknown> = []
  /** 已注册的工具名 → 定义，供断言“是否已启动/未启动”与注册了哪些工具。 */
  const registeredTools = new Map<string, unknown>()
  const ctx: PluginContext & {
    routes: Route[]
    adapters: Array<{ providers: string[] }>
    emitted: string[]
    searchProviders: Map<string, WebSearchProvider>
    webConfig: { searchProvider?: string }
    disposers: Array<() => unknown>
    registeredTools: Map<string, unknown>
  } = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    routes,
    adapters,
    emitted,
    searchProviders,
    webConfig,
    disposers,
    registeredTools,
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
        const dispose = fn({
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
        if (typeof dispose === 'function') disposers.push(dispose as () => unknown)
      }
      if (deps.includes('web') && options.withWeb === true) {
        const dispose = fn({
          web: {
            registerSearchProvider: (provider: WebSearchProvider) => {
              if (searchProviders.has(provider.id)) {
                const err = new Error(`a web provider with id "${provider.id}" is already registered`) as Error & { code?: string }
                err.code = 'WEB_DUPLICATE_PROVIDER'
                throw err
              }
              searchProviders.set(provider.id, provider)
              return () => {
                if (options.asyncWebDispose === true) {
                  queueMicrotask(() => {
                    if (searchProviders.get(provider.id) === provider) {
                      searchProviders.delete(provider.id)
                    }
                  })
                  return
                }
                if (searchProviders.get(provider.id) === provider) {
                  searchProviders.delete(provider.id)
                }
              }
            },
          },
        })
        if (typeof dispose === 'function') disposers.push(dispose as () => unknown)
      }
      if (deps.includes('settings') && options.withSettings === true) {
        const dispose = fn({
          settings: {
            writable: options.writable ?? true,
            configure: () => () => {},
            describe: () => [
              {
                ns: 'web',
                value: { ...(webConfig.searchProvider !== undefined ? { searchProvider: webConfig.searchProvider } : {}) },
                revision: 1,
              },
            ],
            mutate: async (
              ns: string,
              ops: ReadonlyArray<{ op: 'set'; path: readonly string[]; value: unknown } | { op: 'unset'; path: readonly string[] }>,
            ) => {
              assert.equal(ns, 'web')
              const injectedError = options.mutateError?.()
              if (injectedError !== undefined) throw injectedError
              for (const op of ops) {
                if (op.path.length === 1 && op.path[0] === 'searchProvider') {
                  if (op.op === 'set') webConfig.searchProvider = String(op.value)
                  else delete webConfig.searchProvider
                }
              }
            },
          },
        })
        if (typeof dispose === 'function') disposers.push(dispose as () => unknown)
      }
      if (deps.includes('tools') && options.withTools !== false) {
        const dispose = fn({
          tools: {
            register: (definition: { name: string }) => {
              registeredTools.set(definition.name, definition)
              return () => {
                registeredTools.delete(definition.name)
              }
            },
          },
        })
        if (typeof dispose === 'function') disposers.push(dispose as () => unknown)
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
    hasApiKey: true,
    hasWebKey: false,
    inheritedModels: true,
    showComposerIcon: true,
    mcpEnabled: false,
    mcpAvailable: true,
    mcpRegistered: false,
    mcpMode: 'direct',
    mcpHubToolCount: 0,
    mcpRegisteredCount: 0,
    searchMode: 'mcp',
    searchModel: '',
    searchMaxUses: 5,
    searchActive: false,
    searchProviderId: 'dsh-magpie-connect',
    searchRegistered: false,
    searchSwitchable: false,
  })
  assert.equal(JSON.stringify(settings.payload).includes('test-key'), false)

  const models = await callRoute(ctx.routes, MODELS_API, 'GET')
  const rows = (models.payload as { value: { models: Array<{ id: string; displayName: string }> } }).value.models
  const listed = rows.map((row) => row.id)
  assert.deepEqual(listed, ['a', 'b'])
  // The settings list is sorted by the visible label, not the id, and both
  // rows carry the `<group>/<name>` form built from magpie_label.
  assert.deepEqual(rows.map((row) => row.displayName), ['Alpha/A', 'Beta/B'])

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
    hasApiKey: true,
    hasWebKey: false,
    enabledModels: ['b'],
    inheritedModels: false,
    showComposerIcon: true,
    mcpEnabled: false,
    mcpAvailable: true,
    mcpRegistered: false,
    mcpMode: 'direct',
    mcpHubToolCount: 0,
    mcpRegisteredCount: 0,
    searchMode: 'mcp',
    searchModel: '',
    searchMaxUses: 5,
    searchActive: false,
    searchProviderId: 'dsh-magpie-connect',
    searchRegistered: false,
    searchSwitchable: false,
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

test('Web Key is redacted, validated, and a blank field keeps the saved one', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { webKey: 'web-secret' })
  assert.equal((saved.payload as { ok: boolean }).ok, true)
  const value = (saved.payload as { value: { hasWebKey: boolean } }).value
  assert.equal(value.hasWebKey, true)
  assert.equal(JSON.stringify(saved.payload).includes('web-secret'), false)

  const autosaved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { enabledModels: ['a'], webKey: '' })
  assert.equal((autosaved.payload as { ok: boolean }).ok, true)
  const kept = (autosaved.payload as { value: { hasWebKey: boolean } }).value
  assert.equal(kept.hasWebKey, true)

  const bad = await callRoute(ctx.routes, SETTINGS_API, 'POST', { webKey: 7 })
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
    hasApiKey: true,
    hasWebKey: false,
    enabledModels: ['b'],
    inheritedModels: false,
    showComposerIcon: true,
    mcpEnabled: false,
    mcpAvailable: true,
    mcpRegistered: false,
    mcpMode: 'direct',
    mcpHubToolCount: 0,
    mcpRegisteredCount: 0,
    searchMode: 'mcp',
    searchModel: '',
    searchMaxUses: 5,
    searchActive: false,
    searchProviderId: 'dsh-magpie-connect',
    searchRegistered: false,
    searchSwitchable: false,
  })

  const settings = await callRoute(ctx.routes, SETTINGS_API, 'GET')
  const value = (settings.payload as { value: { hasApiKey: boolean; baseUrl: string } }).value
  assert.equal(value.hasApiKey, true)
  assert.equal(value.baseUrl, origin)
  assert.equal(JSON.stringify(settings.payload).includes('page-key'), false)
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

  const discovered = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: origin, apiKey: '   ' })
  assert.equal((discovered.payload as { ok: boolean }).ok, false)
  assert.match((discovered.payload as { error: string }).error, /apiKey is required/)

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
  assert.equal(a?.displayName, 'Alpha/A')
  const b = value.models.find((row) => row.id === 'b')
  assert.equal(b?.displayName, 'Beta/B')
  assert.equal(b?.responsesOnly, true)
  assert.equal(b?.reasoning, true)
  assert.deepEqual(b?.efforts, ['low', 'medium'])
})

test('both model lists are sorted by displayName and fall back to id on a missing label', async (t) => {
  // Id order is z, a; label order is Zebra, Alpha — the opposite, so a list
  // still sorted by id would fail. `c` has no magpie_label at all: it must
  // show the bare id rather than a partial label.
  const body = {
    data: [
      { id: 'z', display_name: 'Zulu', magpie_label: 'Zulu · Zebra', native_endpoints: ['/v1/chat/completions'], reasoning: false },
      { id: 'a', display_name: 'Able', magpie_label: 'Able · Alpha', native_endpoints: ['/v1/chat/completions'], reasoning: false },
      { id: 'c', display_name: 'Charlie', magpie_label: 'Charlie ·   ', native_endpoints: ['/v1/chat/completions'], reasoning: false },
      { id: 'd', display_name: 'Delta', native_endpoints: ['/v1/chat/completions'], reasoning: false },
    ],
  }
  const { server, origin } = await withServer(body)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-apply-')) })
  await settled()

  const listed = await callRoute(ctx.routes, MODELS_API, 'GET')
  const rows = (listed.payload as { value: { models: Array<{ id: string; displayName: string }> } }).value.models
  assert.deepEqual(rows.map((row) => row.displayName), ['Alpha/Able', 'C/Charlie', 'D/Delta', 'Zebra/Zulu'])

  const found = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: origin, apiKey: 'test-key' })
  const candidates = (found.payload as { value: { models: Array<{ id: string; displayName: string }> } }).value.models
  assert.deepEqual(candidates.map((row) => row.displayName), ['Alpha/Able', 'C/Charlie', 'D/Delta', 'Zebra/Zulu'])
  // A missing/empty group never leaks a dangling slash or a short name.
  assert.equal(rows.find((row) => row.id === 'c')?.displayName, 'C/Charlie')
  assert.equal(rows.find((row) => row.id === 'd')?.displayName, 'D/Delta')
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
  // A blank key means "use the stored one": older pages submit the field
  // empty once the server stops echoing the credential back to them.
  const blankKey = await callRoute(ctx.routes, DISCOVER_API, 'POST', { baseUrl: origin, apiKey: '   ' })
  assert.equal((blankKey.payload as { ok: boolean }).ok, true)
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
  assert.equal((saved.payload as { value: { hasApiKey: boolean } }).value.hasApiKey, true)
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

test('settings responses redact the credential, and a blank key reuses the saved one', async (t) => {
  const auth: Array<string | undefined> = []
  const server = createServer((request, response) => {
    auth.push(request.headers.authorization)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(gatewayBody))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}/v1`
  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'patch-private-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-redact-')) })
  await settled()

  const initial = await callRoute(ctx.routes, SETTINGS_API, 'GET')
  assert.equal((initial.payload as { value: { hasApiKey: boolean } }).value.hasApiKey, true)
  assert.equal(JSON.stringify(initial.payload).includes('patch-private-key'), false)

  const saved = await callRoute(ctx.routes, SETTINGS_API, 'POST', { baseUrl: origin, apiKey: 'page-private-key' })
  assert.equal((saved.payload as { value: { hasApiKey: boolean } }).value.hasApiKey, true)
  assert.equal(JSON.stringify(saved.payload).includes('page-private-key'), false)

  // An older client may still submit the credential field while leaving it
  // blank ("unchanged"): the stored key must survive that save.
  const unchanged = await callRoute(ctx.routes, SETTINGS_API, 'POST', { baseUrl: origin, apiKey: '' })
  assert.equal((unchanged.payload as { ok: boolean }).ok, true)
  for (const route of [TEST_API, DISCOVER_API]) {
    const result = await callRoute(ctx.routes, route, 'POST', { baseUrl: origin, apiKey: '' })
    assert.equal((result.payload as { ok: boolean }).ok, true)
    assert.equal(auth.at(-1), 'Bearer page-private-key')
  }
})

test('注册 ctx.web 搜索提供方，并支持通过设置页一键切换与实时切换搜索模式/模型', async (t) => {
  const seenUrls: string[] = []
  const seenModels: string[] = []
  const server = createServer(async (req, res) => {
    seenUrls.push(req.url ?? '')
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(gatewayBody))
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const rawBody = Buffer.concat(chunks).toString('utf8')
    if (req.url === '/mcp/magpie/web-search') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [{ type: 'text', text: '1. MCP Hit — https://mcp.example.com\nFrom Magpie MCP.' }],
            isError: false,
          },
        }),
      )
      return
    }
    if (req.url === '/v1/messages') {
      const parsed = JSON.parse(rawBody) as { model?: string }
      seenModels.push(parsed.model ?? '')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          content: [
            {
              type: 'web_search_tool_result',
              content: [{ type: 'web_search_result', url: 'https://model.example.com', title: 'Model Hit', snippet: 'From Messages API.' }],
            },
          ],
        }),
      )
      return
    }
    res.writeHead(404)
    res.end('not found')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}/v1`

  __resetSettingsRoutes()
  const ctx = stubContext({ withWeb: true, withSettings: true, initialSearchProvider: 'deepseek-search-api' })
  apply(ctx, { baseUrl: origin, apiKey: 'gw-secret', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-web-search-')) })
  await settled()

  const registered = ctx.searchProviders.get('dsh-magpie-connect')
  assert.ok(registered, '搜索提供方已注册到 ctx.web')
  assert.equal(registered.title, 'Magpie')
  assert.equal(registered.available(), true)
  assert.equal(await registered.ready?.(undefined), true)

  // 初始状态读取到 DSH 原有的 searchProvider
  const initial = await callRoute(ctx.routes, SETTINGS_API, 'GET')
  const initialView = (initial.payload as { value: Record<string, unknown> }).value
  assert.equal(initialView.searchRegistered, true)
  assert.equal(initialView.searchSwitchable, true)
  assert.equal(initialView.searchActive, false)
  assert.equal(initialView.activeSearchProvider, 'deepseek-search-api')

  // 一键开启 MCP 模式切换到 Magpie
  const enabled = await callRoute(ctx.routes, SETTINGS_API, 'POST', { searchMode: 'mcp', searchActive: true })
  assert.equal((enabled.payload as { ok: boolean }).ok, true)
  assert.equal(ctx.webConfig.searchProvider, 'dsh-magpie-connect')
  const mcpResult = await registered.search({ query: 'hello' })
  assert.equal(mcpResult.sources[0]?.url, 'https://mcp.example.com')

  // 切换到指定模型搜索模式时必须提供模型 ID
  const missingModel = await callRoute(ctx.routes, SETTINGS_API, 'POST', { searchMode: 'model', searchModel: '' })
  assert.equal((missingModel.payload as { ok: boolean }).ok, false)

  // 指定模型后实时切换生效，后续再次更换模型也无需重启
  const toModelA = await callRoute(ctx.routes, SETTINGS_API, 'POST', { searchMode: 'model', searchModel: 'a' })
  assert.equal((toModelA.payload as { ok: boolean }).ok, true)
  const modelResult = await registered.search({ query: 'hello model' })
  assert.equal(modelResult.sources[0]?.url, 'https://model.example.com')
  assert.equal(seenModels.at(-1), 'a')

  await callRoute(ctx.routes, SETTINGS_API, 'POST', { searchModel: 'b' })
  await registered.search({ query: 'switch model' })
  assert.equal(seenModels.at(-1), 'b')

  // 测试搜索接口支持不保存直接试探（且不泄露密钥）
  const tested = await callRoute(ctx.routes, SEARCH_TEST_API, 'POST', { searchMode: 'mcp', query: 'probe' })
  assert.equal((tested.payload as { ok: boolean }).ok, true)
  assert.equal((tested.payload as { value: { count: number; mode: string } }).value.count, 1)
  assert.equal((tested.payload as { value: { mode: string } }).value.mode, 'mcp')
  assert.equal(JSON.stringify(tested.payload).includes('gw-secret'), false)

  // 关闭开关恢复 DSH 自动选择（unset）
  const disabled = await callRoute(ctx.routes, SETTINGS_API, 'POST', { searchActive: false })
  assert.equal((disabled.payload as { ok: boolean }).ok, true)
  assert.equal(ctx.webConfig.searchProvider, undefined)
  assert.equal((disabled.payload as { value: { searchActive: boolean } }).value.searchActive, false)

  // 若用户已通过 DSH 内置页面切到其他提供方，取消本开关不会误清别人的设置
  ctx.webConfig.searchProvider = 'deepseek-official'
  await callRoute(ctx.routes, SETTINGS_API, 'POST', { searchActive: false })
  assert.equal(ctx.webConfig.searchProvider, 'deepseek-official')
  assert.ok(seenUrls.includes('/mcp/magpie/web-search'))
  assert.ok(seenUrls.includes('/v1/messages'))
})

test('未配置 API Key 时拒绝开启 Magpie 搜索；多代热重载共享并安全释放搜索提供方', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext({ withWeb: true, withSettings: true })
  const dir = mkdtempSync(join(tmpdir(), 'magpie-search-reload-'))

  // 未配置 apiKey 时不能开启 searchActive
  apply(ctx, { baseUrl: origin, apiKey: '', refreshSeconds: 3600, dataDir: dir })
  await settled()
  const gen1Disposers = [...ctx.disposers]
  const rejected = await callRoute(ctx.routes, SETTINGS_API, 'POST', { searchActive: true })
  assert.equal((rejected.payload as { ok: boolean }).ok, false)
  assert.equal(ctx.webConfig.searchProvider, undefined)

  // 同进程热重载第二代：共享同一 provider 注册不抛 WEB_DUPLICATE_PROVIDER
  apply(ctx, { baseUrl: origin, apiKey: 'next-gen-key', refreshSeconds: 3600, dataDir: dir })
  await settled()
  const gen2Disposers = ctx.disposers.slice(gen1Disposers.length)
  assert.equal(ctx.searchProviders.size, 1)
  const provider = ctx.searchProviders.get('dsh-magpie-connect')
  assert.ok(provider)
  // 已委托到最新一代，具备 next-gen-key
  assert.equal(await provider.ready?.(undefined), true)

  // 第一代卸载后，第二代自动接管注册权，搜索提供方保持在线
  for (const dispose of gen1Disposers) await dispose()
  assert.equal(ctx.searchProviders.size, 1)
  assert.equal(await ctx.searchProviders.get('dsh-magpie-connect')?.ready?.(undefined), true)

  // 第二代也卸载后干净注销
  for (const dispose of gen2Disposers) await dispose()
  assert.equal(ctx.searchProviders.size, 0)
})

test('外部插件占用同 id 时不误报 searchRegistered，且卸载不误删外部提供方', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const externalProvider: WebSearchProvider = {
    id: 'dsh-magpie-connect',
    title: 'External Search',
    available: () => true,
    search: async () => ({ sources: [], truncated: false }),
  }
  const ctx = stubContext({
    withWeb: true,
    withSettings: true,
    preRegisteredSearchProviders: [externalProvider],
  })
  apply(ctx, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-ext-conflict-')) })
  await settled()

  const view = ((await callRoute(ctx.routes, SETTINGS_API, 'GET')).payload as { value: Record<string, unknown> }).value
  assert.equal(view.searchRegistered, false)
  assert.equal(view.searchSwitchable, false)

  const attempt = await callRoute(ctx.routes, SETTINGS_API, 'POST', { searchActive: true })
  assert.equal((attempt.payload as { ok: boolean }).ok, false)
  assert.equal(ctx.webConfig.searchProvider, undefined)

  // 卸载本插件不得删除外部插件注册的 provider
  for (const dispose of ctx.disposers) await dispose()
  assert.equal(ctx.searchProviders.get('dsh-magpie-connect'), externalProvider)
})

test('registerSearchProvider 的 disposer 异步微任务释放时，热重载后续代仍可正常接管', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())
  __resetSettingsRoutes()
  const ctx = stubContext({ withWeb: true, withSettings: true, asyncWebDispose: true })
  const dir = mkdtempSync(join(tmpdir(), 'magpie-async-takeover-'))

  apply(ctx, { baseUrl: origin, apiKey: 'key-1', refreshSeconds: 3600, dataDir: dir })
  await settled()
  const gen1Disposers = [...ctx.disposers]
  const gen1Provider = ctx.searchProviders.get('dsh-magpie-connect')
  assert.ok(gen1Provider)

  // 第二代启动时旧代尚未卸载，进入等待队列
  apply(ctx, { baseUrl: origin, apiKey: 'key-2', refreshSeconds: 3600, dataDir: dir })
  await settled()
  const gen2Disposers = ctx.disposers.slice(gen1Disposers.length)

  // 第一代异步微任务释放后，第二代应在微任务中完成接管
  for (const dispose of gen1Disposers) await dispose()
  await new Promise<void>((resolve) => setTimeout(resolve, 10))
  const activeProvider = ctx.searchProviders.get('dsh-magpie-connect')
  assert.ok(activeProvider)
  assert.notEqual(activeProvider, gen1Provider, '注册权已切换到第二代实例')
  const view = ((await callRoute(ctx.routes, SETTINGS_API, 'GET')).payload as { value: Record<string, unknown> }).value
  assert.equal(view.searchRegistered, true)
  assert.equal(view.searchSwitchable, true)

  // 第二代卸载后同样干净释放
  for (const dispose of gen2Disposers) await dispose()
  await new Promise<void>((resolve) => setTimeout(resolve, 10))
  assert.equal(ctx.searchProviders.size, 0)
})

test('同时提交搜索配置与开关时保证原子性：mutate 失败不写 settings.json，store.save 失败回滚 web.searchProvider', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())

  // 场景 A：ctx.settings.mutate 抛错时，settings.json 不应被提前写入
  __resetSettingsRoutes()
  let shouldFailMutate = true
  const dirA = mkdtempSync(join(tmpdir(), 'magpie-atomic-mutate-'))
  const ctxA = stubContext({
    withWeb: true,
    withSettings: true,
    initialSearchProvider: 'deepseek-search-api',
    mutateError: () => (shouldFailMutate ? new Error('SETTINGS_CONFLICT: web changed') : undefined),
  })
  apply(ctxA, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: dirA })
  await settled()

  const failedSwitch = await callRoute(ctxA.routes, SETTINGS_API, 'POST', {
    searchMode: 'model',
    searchModel: 'a',
    searchActive: true,
  })
  assert.equal((failedSwitch.payload as { ok: boolean }).ok, false)
  assert.equal(ctxA.webConfig.searchProvider, 'deepseek-search-api')
  const afterFailView = ((await callRoute(ctxA.routes, SETTINGS_API, 'GET')).payload as { value: Record<string, unknown> }).value
  assert.equal(afterFailView.searchMode, 'mcp')
  assert.equal(afterFailView.searchModel, '')
  assert.equal(afterFailView.searchActive, false)
  const { existsSync, writeFileSync } = await import('node:fs')
  assert.equal(existsSync(join(dirA, 'settings.json')), false, 'mutate 失败不得产生半截 settings.json')

  // 恢复 mutate 后同一请求可正常提交
  shouldFailMutate = false
  const okSwitch = await callRoute(ctxA.routes, SETTINGS_API, 'POST', {
    searchMode: 'model',
    searchModel: 'a',
    searchActive: true,
  })
  assert.equal((okSwitch.payload as { ok: boolean }).ok, true)
  assert.equal(ctxA.webConfig.searchProvider, 'dsh-magpie-connect')

  // 场景 B：settings.json 损坏导致 store.save 拒绝部分写入时，已切换的 web.searchProvider 应回滚回原值
  __resetSettingsRoutes()
  const dirB = mkdtempSync(join(tmpdir(), 'magpie-atomic-rollback-'))
  writeFileSync(join(dirB, 'settings.json'), '{broken json')
  const ctxB = stubContext({
    withWeb: true,
    withSettings: true,
    initialSearchProvider: 'deepseek-search-api',
  })
  apply(ctxB, { baseUrl: origin, apiKey: 'patch-key', refreshSeconds: 3600, dataDir: dirB })
  await settled()

  const failedSave = await callRoute(ctxB.routes, SETTINGS_API, 'POST', {
    searchMode: 'model',
    searchModel: 'a',
    searchActive: true,
  })
  assert.equal((failedSave.payload as { ok: boolean }).ok, false)
  assert.match((failedSave.payload as { error: string }).error, /unreadable/)
  assert.equal(ctxB.webConfig.searchProvider, 'deepseek-search-api', 'store.save 失败后 web.searchProvider 必须回滚到原值')
})

test('MCP tools stay off until enabled; small hubs register direct, large hubs go on-demand', async (t) => {
  // A hub that lists a given number of tools; answers bare tools/list (no session).
  const makeHub = (toolNames: string[]) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      req.on('end', () => {
        if (req.url !== '/mcp/magpie/hub') {
          res.writeHead(404)
          res.end('not found')
          return
        }
        if (req.headers.authorization !== 'Bearer gw-secret' && req.headers.authorization !== 'Bearer next-secret') {
          res.writeHead(403)
          res.end('bad key')
          return
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { id?: number; method?: string }
        if (body.method === 'tools/list') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? null, result: { tools: toolNames.map((name) => ({ name })) } }))
          return
        }
        res.writeHead(202)
        res.end()
      })
    })
    return server
  }

  // --- small hub (3 tools) → direct registration ---
  const small = makeHub(['a__one', 'a__two', 'b__three'])
  await new Promise<void>((resolve) => small.listen(0, '127.0.0.1', resolve))
  t.after(() => small.close())
  const smallAddr = small.address()
  assert.ok(smallAddr && typeof smallAddr === 'object')
  const smallOrigin = `http://127.0.0.1:${smallAddr.port}/v1`

  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: smallOrigin, apiKey: 'gw-secret', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-mcp-')) })
  await settled()

  // Default off: no tools, no connection.
  assert.equal(ctx.registeredTools.size, 0, 'MCP 工具默认不启动')
  const before = (await callRoute(ctx.routes, SETTINGS_API, 'GET')).payload as { value: Record<string, unknown> }
  assert.equal(before.value.mcpAvailable, true)
  assert.equal(before.value.mcpEnabled, false)
  assert.equal(before.value.mcpRegistered, false)

  // Enable → tools/list → 3 direct tools registered.
  const on = await callRoute(ctx.routes, SETTINGS_API, 'POST', { mcpEnabled: true })
  assert.equal((on.payload as { ok: boolean }).ok, true)
  await settled()
  assert.deepEqual([...ctx.registeredTools.keys()].sort(), ['mcp__magpie__a__one', 'mcp__magpie__a__two', 'mcp__magpie__b__three'])
  const after = (on.payload as { value: Record<string, unknown> }).value
  assert.equal(after.mcpEnabled, true)
  assert.equal(after.mcpRegistered, true)
  assert.equal(after.mcpMode, 'direct')
  assert.equal(after.mcpRegisteredCount, 3)
  assert.equal(after.mcpHubToolCount, 3)

  // Disable → all tools removed.
  const off = await callRoute(ctx.routes, SETTINGS_API, 'POST', { mcpEnabled: false })
  assert.equal((off.payload as { ok: boolean }).ok, true)
  await settled()
  assert.equal(ctx.registeredTools.size, 0)
  assert.equal((off.payload as { value: Record<string, unknown> }).value.mcpRegistered, false)
  small.close()

  // --- large hub (12 tools) → on-demand: only find_tools + call_tool ---
  const bigNames = Array.from({ length: 12 }, (_, i) => `srv__tool_${i}`)
  const big = makeHub(bigNames)
  await new Promise<void>((resolve) => big.listen(0, '127.0.0.1', resolve))
  t.after(() => big.close())
  const bigAddr = big.address()
  assert.ok(bigAddr && typeof bigAddr === 'object')
  const bigOrigin = `http://127.0.0.1:${bigAddr.port}/v1`

  __resetSettingsRoutes()
  const ctx2 = stubContext()
  apply(ctx2, { baseUrl: bigOrigin, apiKey: 'gw-secret', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-mcp-big-')) })
  await settled()
  const on2 = await callRoute(ctx2.routes, SETTINGS_API, 'POST', { mcpEnabled: true })
  assert.equal((on2.payload as { ok: boolean }).ok, true)
  await settled()
  assert.deepEqual([...ctx2.registeredTools.keys()].sort(), ['mcp__magpie__call_tool', 'mcp__magpie__find_tools'])
  const after2 = (on2.payload as { value: Record<string, unknown> }).value
  assert.equal(after2.mcpMode, 'on-demand')
  assert.equal(after2.mcpHubToolCount, 12)
  assert.equal(after2.mcpRegisteredCount, 2)
})

test('enabling the MCP tools is refused without ctx.tools or a configured endpoint', async (t) => {
  const { server, origin } = await withServer(gatewayBody)
  t.after(() => server.close())

  // No ctx.tools: refuse, and nothing registers.
  __resetSettingsRoutes()
  const noTools = stubContext({ withTools: false })
  apply(noTools, { baseUrl: origin, apiKey: 'test-key', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-mcp-none-')) })
  await settled()
  const rejected = await callRoute(noTools.routes, SETTINGS_API, 'POST', { mcpEnabled: true })
  assert.equal((rejected.payload as { ok: boolean }).ok, false)
  assert.match((rejected.payload as { error: string }).error, /MCP manager is unavailable|ctx\.tools|MCP tools/)
  assert.equal(noTools.registeredTools.size, 0)

  // Has ctx.tools but endpoint unconfigured (no key): refuse too.
  __resetSettingsRoutes()
  const unconfigured = stubContext()
  apply(unconfigured, { baseUrl: origin, apiKey: '', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-mcp-nocfg-')) })
  await settled()
  const refused = await callRoute(unconfigured.routes, SETTINGS_API, 'POST', { mcpEnabled: true })
  assert.equal((refused.payload as { ok: boolean }).ok, false)
  assert.match((refused.payload as { error: string }).error, /configure API URL and apiKey/)
  assert.equal(unconfigured.registeredTools.size, 0)
})

test('the MCP test route probes the hub over HTTP without registering anything', async (t) => {
  // The route probes the same address registration would use. This hub listens
  // on loopback, so that is the local agent address (/mcp/magpie/hub/dsh).
  // A gateway that answers the hub's initialize + tools/list over Streamable HTTP.
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => {
      if (req.url !== '/mcp/magpie/hub/dsh') {
        res.writeHead(404)
        res.end('not found')
        return
      }
      if (req.headers.authorization !== 'Bearer gw-secret') {
        res.writeHead(403)
        res.end('bad key')
        return
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { id?: number; method?: string }
      const send = (payload: unknown) => {
        res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'sess' })
        res.end(JSON.stringify(payload))
      }
      if (body.method === 'initialize') {
        send({ jsonrpc: '2.0', id: body.id ?? null, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'magpie', version: '1' } } })
        return
      }
      if (body.method === 'tools/list') {
        send({ jsonrpc: '2.0', id: body.id ?? null, result: { tools: [{ name: 'web_search' }, { name: 'github__create_issue' }] } })
        return
      }
      res.writeHead(202)
      res.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}/v1`

  __resetSettingsRoutes()
  const ctx = stubContext()
  apply(ctx, { baseUrl: origin, apiKey: 'gw-secret', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-mcp-probe-')) })
  await settled()

  const tested = await callRoute(ctx.routes, MCP_TEST_API, 'POST', {})
  assert.equal((tested.payload as { ok: boolean }).ok, true)
  const value = (tested.payload as { value: { ok: boolean; toolCount: number; toolNames: string[] } }).value
  assert.equal(value.ok, true)
  assert.equal(value.toolCount, 2)
  assert.deepEqual(value.toolNames, ['web_search', 'github__create_issue'])
  // The probe never registers a tool and never leaks the key.
  assert.equal(ctx.registeredTools.size, 0)
  assert.equal(JSON.stringify(tested.payload).includes('gw-secret'), false)
})

test('a local gateway uses the agent address and passes Magpie on-demand through; a remote one uses all-apps and does it here', async (t) => {
  /** A hub that records the path asked and answers with a chosen tool set. */
  const makeHub = (answer: (path: string) => string[]) => {
    const seen: string[] = []
    const server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      req.on('end', () => {
        const url = req.url ?? ''
        if (!url.startsWith('/mcp/magpie/hub')) {
          res.writeHead(404)
          res.end('not found')
          return
        }
        seen.push(url)
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { id?: number; method?: string }
        if (body.method === 'tools/list') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? null, result: { tools: answer(url).map((name) => ({ name })) } }))
          return
        }
        res.writeHead(202)
        res.end()
      })
    })
    return { server, seen }
  }

  // --- local: agent address answers with Magpie's own on-demand pair ---
  const localHub = makeHub(() => ['find_tools', 'call_tool'])
  await new Promise<void>((resolve) => localHub.server.listen(0, '127.0.0.1', resolve))
  t.after(() => localHub.server.close())
  const localAddr = localHub.server.address()
  assert.ok(localAddr && typeof localAddr === 'object')
  const localOrigin = `http://127.0.0.1:${localAddr.port}/v1`

  __resetSettingsRoutes()
  const localCtx = stubContext()
  apply(localCtx, { baseUrl: localOrigin, apiKey: 'gw-secret', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-mcp-local-')) })
  await settled()
  const onLocal = await callRoute(localCtx.routes, SETTINGS_API, 'POST', { mcpEnabled: true })
  assert.equal((onLocal.payload as { ok: boolean }).ok, true)
  await settled()
  // Asked the agent address, and passed Magpie's pair through unchanged.
  assert.ok(localHub.seen.some((path) => path === '/mcp/magpie/hub/dsh'), `expected the agent address, saw ${localHub.seen.join(', ')}`)
  assert.deepEqual([...localCtx.registeredTools.keys()].sort(), ['mcp__magpie__call_tool', 'mcp__magpie__find_tools'])
  const localView = (onLocal.payload as { value: Record<string, unknown> }).value
  assert.equal(localView.mcpMode, 'passthrough')
  assert.equal(localView.mcpAddress, 'agent')

  // --- remote: agent address is never used; on-demand is built here ---
  const remoteHub = makeHub((path) => (path === '/mcp/magpie/hub' ? Array.from({ length: 15 }, (_, i) => `s__t${i}`) : []))
  await new Promise<void>((resolve) => remoteHub.server.listen(0, '0.0.0.0', resolve))
  t.after(() => remoteHub.server.close())
  const remoteAddr = remoteHub.server.address()
  assert.ok(remoteAddr && typeof remoteAddr === 'object')
  // Reach it through the machine's LAN address so it is not loopback.
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((entry) => entry !== undefined && entry.family === 'IPv4' && !entry.internal)
  assert.ok(lan, 'a non-loopback IPv4 address is needed for the remote half')
  const remoteOrigin = `http://${lan.address}:${remoteAddr.port}/v1`

  __resetSettingsRoutes()
  const remoteCtx = stubContext()
  apply(remoteCtx, { baseUrl: remoteOrigin, apiKey: 'gw-secret', refreshSeconds: 3600, dataDir: mkdtempSync(join(tmpdir(), 'magpie-mcp-remote-')) })
  await settled()
  const onRemote = await callRoute(remoteCtx.routes, SETTINGS_API, 'POST', { mcpEnabled: true })
  await settled()
  // 15 tools → our own on-demand pair, never the agent path.
  assert.deepEqual([...remoteCtx.registeredTools.keys()].sort(), ['mcp__magpie__call_tool', 'mcp__magpie__find_tools'])
  assert.ok(!remoteHub.seen.some((path) => path.startsWith('/mcp/magpie/hub/dsh')), `remote must not use the agent address, saw ${remoteHub.seen.join(', ')}`)
  const remoteView = (onRemote.payload as { value: Record<string, unknown> }).value
  assert.equal(remoteView.mcpMode, 'on-demand')
  assert.equal(remoteView.mcpAddress, 'all')
})
