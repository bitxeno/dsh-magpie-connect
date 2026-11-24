import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAGPIE_HUB_MCP_PATH,
  MAGPIE_MCP_SERVER_NAME,
  DEFAULT_MCP_AGENT,
  buildHubRegistration,
  hubFingerprint,
  isLocalGateway,
  magpieHubMcpUrl,
  normalizeMcpAgent,
  probeMagpieHub,
  toStatusView,
} from '../src/mcp.ts'

test('magpieHubMcpUrl names the configured agent by default, or the all-apps address when empty', () => {
  // Default is the all-apps address (no agent) — every server, plugin-side on-demand.
  assert.equal(magpieHubMcpUrl({ baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' }), 'http://127.0.0.1:3425/mcp/magpie/hub')
  // An explicit agent is encoded; '' is the all-apps address.
  assert.equal(magpieHubMcpUrl({ baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' }, 'claude'), 'http://127.0.0.1:3425/mcp/magpie/hub/claude')
  assert.equal(magpieHubMcpUrl({ baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' }, ''), 'http://127.0.0.1:3425/mcp/magpie/hub')
  // A gateway behind a non-version prefix keeps that prefix.
  assert.equal(
    magpieHubMcpUrl({ baseUrl: 'https://example.com/api/v2', apiKey: 'k' }, 'dsh'),
    'https://example.com/api/mcp/magpie/hub/dsh',
  )
  // Both URL and key are required — an incomplete endpoint never dials.
  assert.equal(magpieHubMcpUrl({ baseUrl: '', apiKey: 'k' }), undefined)
  assert.equal(magpieHubMcpUrl({ baseUrl: 'http://127.0.0.1:3425/v1', apiKey: '' }), undefined)
  assert.equal(magpieHubMcpUrl({ baseUrl: 'not a url', apiKey: 'k' }), undefined)
})

test('normalizeMcpAgent: empty/all is the all-apps address; the Library label maps to the dsh id', () => {
  assert.equal(DEFAULT_MCP_AGENT, '', 'default is the all-apps address')
  // Empty (unset) and explicit all-apps forms mean no agent segment.
  assert.equal(normalizeMcpAgent(''), '')
  assert.equal(normalizeMcpAgent(undefined), '')
  assert.equal(normalizeMcpAgent('all'), '')
  assert.equal(normalizeMcpAgent('-'), '')
  // The Library label and spellings map onto the fixed id.
  assert.equal(normalizeMcpAgent('dsh'), 'dsh')
  assert.equal(normalizeMcpAgent('DeepSeek Harness'), 'dsh')
  assert.equal(normalizeMcpAgent('deepseek-harness'), 'dsh')
  assert.equal(normalizeMcpAgent('  DeepSeek  Harness '), 'dsh')
  // A genuinely different agent id is passed through.
  assert.equal(normalizeMcpAgent('claude'), 'claude')
})

test('buildHubRegistration produces a Streamable HTTP entry with the key as a Bearer header', () => {
  const entry = buildHubRegistration({ baseUrl: 'http://127.0.0.1:3425/v1', apiKey: '  secret  ' }, { toolCallTimeoutMs: 120_000 })
  assert.ok(entry)
  assert.equal(entry.transport, 'streamable-http')
  assert.equal(entry.url, 'http://127.0.0.1:3425/mcp/magpie/hub')
  assert.equal(entry.headers?.Authorization, 'Bearer secret')
  assert.equal(entry.toolCallTimeoutMs, 120_000)
  // No `${…}` in the stored key, so the manager's template validator stays happy.
  assert.equal(JSON.stringify(entry).includes('${credential'), false)
})

test('buildHubRegistration returns null for an unconfigured endpoint (nothing to register)', () => {
  assert.equal(buildHubRegistration({ baseUrl: '', apiKey: '' }, { toolCallTimeoutMs: 1 }), null)
})

test('hubFingerprint changes with the URL or the key and is undefined with no registration', () => {
  const a = buildHubRegistration({ baseUrl: 'http://h/v1', apiKey: 'one' }, { toolCallTimeoutMs: 1 })
  const b = buildHubRegistration({ baseUrl: 'http://h/v1', apiKey: 'two' }, { toolCallTimeoutMs: 1 })
  const c = buildHubRegistration({ baseUrl: 'http://h2/v1', apiKey: 'one' }, { toolCallTimeoutMs: 1 })
  assert.equal(hubFingerprint(null), undefined)
  assert.notEqual(hubFingerprint(a), hubFingerprint(b), 'a rotated key rebuilds')
  assert.notEqual(hubFingerprint(a), hubFingerprint(c), 'a moved origin rebuilds')
  assert.equal(hubFingerprint(a), hubFingerprint(buildHubRegistration({ baseUrl: 'http://h/v1', apiKey: 'one' }, { toolCallTimeoutMs: 2 })), 'a budget change alone does not rebuild')
})

test('the namespace and hub path match the gateway contract', () => {
  assert.equal(MAGPIE_MCP_SERVER_NAME, 'magpie')
  assert.equal(MAGPIE_HUB_MCP_PATH, '/mcp/magpie/hub')
})

test('toStatusView flattens every mcp-manager status into the page view', () => {
  assert.deepEqual(toStatusView({ state: 'connected', toolCount: 4, connectedAt: 1 }), { state: 'connected', toolCount: 4 })
  assert.deepEqual(toStatusView({ state: 'connected' }), { state: 'connected' })
  assert.deepEqual(toStatusView({ state: 'connecting', attempt: 0 }), { state: 'connecting' })
  assert.deepEqual(toStatusView({ state: 'reconnecting', attempt: 1, maxAttempts: 3, lastError: 'boom' }), {
    state: 'reconnecting',
    lastError: 'boom',
  })
  assert.deepEqual(toStatusView({ state: 'failed', reason: 'gave-up', lastError: 'nope' }), { state: 'failed', lastError: 'nope' })
  assert.deepEqual(toStatusView({ state: 'waiting-credentials', lastError: 'missing' }), { state: 'failed', lastError: 'missing' })
  assert.deepEqual(toStatusView({ state: 'disabled' }), { state: 'disabled' })
  assert.deepEqual(toStatusView({ state: 'closed', result: {} }), { state: 'disabled' })
  // Unknown shapes never masquerade as connected.
  assert.deepEqual(toStatusView({ state: 'something-new' }), { state: 'unknown' })
  assert.deepEqual(toStatusView(null), { state: 'unknown' })
  assert.deepEqual(toStatusView(undefined), { state: 'unknown' })
})

/** Build a fake fetch that answers Streamable-HTTP JSON-RPC for the hub. */
function fakeHubFetch(options: {
  instructions?: string
  tools?: string[]
  status?: number
  failInit?: boolean
}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { id?: number; method?: string }
    const json = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json', 'mcp-session-id': 'sess-1' },
      })
    if (options.status !== undefined && options.status !== 200) {
      return new Response('nope', { status: options.status })
    }
    if (body.method === 'initialize') {
      if (options.failInit === true) {
        return json({ jsonrpc: '2.0', id: body.id ?? null, error: { code: -32000, message: 'boom' } })
      }
      return json({
        jsonrpc: '2.0',
        id: body.id ?? null,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'magpie', version: '1' },
          ...(options.instructions !== undefined ? { instructions: options.instructions } : {}),
        },
      })
    }
    if (body.method === 'notifications/initialized') {
      return new Response('', { status: 202 })
    }
    if (body.method === 'tools/list') {
      return json({
        jsonrpc: '2.0',
        id: body.id ?? null,
        result: { tools: (options.tools ?? []).map((name) => ({ name })) },
      })
    }
    return new Response('', { status: 202 })
  }) as unknown as typeof fetch
}

test('probeMagpieHub lists tools from the hub over initialize + tools/list', async () => {
  const outcome = await probeMagpieHub(
    { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' },
    { timeoutMs: 5000, fetchImpl: fakeHubFetch({ tools: ['github__create_issue', 'web_search'] }) },
  )
  assert.equal(outcome.ok, true)
  assert.equal(outcome.toolCount, 2)
  assert.deepEqual(outcome.toolNames, ['github__create_issue', 'web_search'])
  assert.equal(outcome.hubOff, undefined)
})

test('probeMagpieHub reports the hub as off when the gateway says so', async () => {
  const outcome = await probeMagpieHub(
    { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' },
    { timeoutMs: 5000, fetchImpl: fakeHubFetch({ instructions: "magpie's MCP hub is off, so it runs no server's tools", tools: [] }) },
  )
  assert.equal(outcome.ok, true)
  assert.equal(outcome.toolCount, 0)
  assert.equal(outcome.hubOff, true)
})

test('probeMagpieHub surfaces HTTP and JSON-RPC failures without throwing', async () => {
  const httpFail = await probeMagpieHub(
    { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' },
    { timeoutMs: 5000, fetchImpl: fakeHubFetch({ status: 403 }) },
  )
  assert.equal(httpFail.ok, false)
  assert.match(httpFail.error ?? '', /403/)

  const rpcFail = await probeMagpieHub(
    { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' },
    { timeoutMs: 5000, fetchImpl: fakeHubFetch({ failInit: true }) },
  )
  assert.equal(rpcFail.ok, false)
  assert.match(rpcFail.error ?? '', /initialize failed/)
})

test('probeMagpieHub refuses an unconfigured endpoint without dialling', async () => {
  let called = false
  const spy = (async () => {
    called = true
    return new Response('')
  }) as unknown as typeof fetch
  const outcome = await probeMagpieHub({ baseUrl: '', apiKey: '' }, { timeoutMs: 1000, fetchImpl: spy })
  assert.equal(outcome.ok, false)
  assert.equal(called, false)
})

test('isLocalGateway recognises loopback spellings only', () => {
  assert.equal(isLocalGateway('http://127.0.0.1:3425/v1'), true)
  assert.equal(isLocalGateway('http://localhost:3425/v1'), true)
  assert.equal(isLocalGateway('http://127.0.0.5:3425/v1'), true, 'all of 127/8 is loopback')
  assert.equal(isLocalGateway('http://[::1]:3425/v1'), true)
  assert.equal(isLocalGateway('http://0.0.0.0:3425/v1'), true)
  // A gateway elsewhere never detects DSH as a local agent.
  assert.equal(isLocalGateway('http://api.lan/v1'), false)
  assert.equal(isLocalGateway('http://192.168.1.1/v1'), false)
  assert.equal(isLocalGateway('https://magpie.example.com/v1'), false)
  assert.equal(isLocalGateway('not a url'), false)
})
