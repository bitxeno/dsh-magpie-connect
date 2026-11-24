import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FIND_CATALOG_MAX,
  MCP_TOOL_PREFIX,
  MagpieToolRegistrar,
  buildToolCatalog,
  callToolDefinition,
  directToolDefinition,
  findToolsDefinition,
  publicToolName,
  toolModeFor,
} from '../src/mcp-tools.ts'
import { MCP_ON_DEMAND_OVER, type RawMcpTool } from '../src/mcp.ts'

test('toolModeFor: passthrough for Magpie\'s own pair, else on-demand above 10 tools', () => {
  assert.equal(MCP_ON_DEMAND_OVER, 10)
  const many = (n: number): RawMcpTool[] => Array.from({ length: n }, (_, i) => ({ name: `s__t${i}` }))
  assert.equal(toolModeFor([]), 'direct')
  assert.equal(toolModeFor(many(10)), 'direct')
  assert.equal(toolModeFor(many(11)), 'on-demand')
  assert.equal(toolModeFor(many(87)), 'on-demand')
  // Magpie's own on-demand answer is passed through, not rebuilt.
  assert.equal(toolModeFor([{ name: 'find_tools' }, { name: 'call_tool' }]), 'passthrough')
  // The pair only counts when it is exactly those two.
  assert.equal(toolModeFor([{ name: 'find_tools' }]), 'direct')
  assert.equal(toolModeFor([{ name: 'find_tools' }, { name: 'call_tool' }, { name: 'x__y' }]), 'direct')
})

test('publicToolName keeps short names and sanitizes/hashes long ones', () => {
  assert.equal(publicToolName('bookmark__sync-status'), `${MCP_TOOL_PREFIX}bookmark__sync-status`)
  // Illegal characters become dashes.
  assert.equal(publicToolName('a b/c'), `${MCP_TOOL_PREFIX}a-b-c`)
  // Over the 64-char budget: truncated and hash-suffixed, still unique per input.
  const long = 'notion__' + 'x'.repeat(80)
  const a = publicToolName(long)
  const b = publicToolName(long + 'y')
  assert.ok(a.length <= 64, `expected <=64, got ${a.length}`)
  assert.notEqual(a, b, 'different long names never collapse')
})

/** A fake ctx.tools that records registrations. */
function fakeTools() {
  const registered = new Map<string, unknown>()
  return {
    registered,
    register(definition: { name: string }) {
      registered.set(definition.name, definition)
      return () => {
        registered.delete(definition.name)
      }
    },
  }
}

const endpoint = { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' }
const hubOptions = { getEndpoint: () => endpoint, toolCallTimeoutMs: 5000, agent: '' }

test('a small tool set registers one direct tool per hub tool', () => {
  const tools = fakeTools()
  const registrar = new MagpieToolRegistrar(tools, hubOptions)
  const hubTools: RawMcpTool[] = [
    { name: 'a__one', description: 'A one', inputSchema: { type: 'object', properties: {} } },
    { name: 'b__two' },
  ]
  registrar.apply(hubTools)
  assert.deepEqual([...tools.registered.keys()].sort(), [`${MCP_TOOL_PREFIX}a__one`, `${MCP_TOOL_PREFIX}b__two`])
  assert.deepEqual(registrar.state(), { mode: 'direct', hubToolCount: 2, registeredCount: 2 })
  registrar.unregister()
  assert.equal(tools.registered.size, 0)
})

test('a large tool set registers only find_tools + call_tool', () => {
  const tools = fakeTools()
  const registrar = new MagpieToolRegistrar(tools, hubOptions)
  registrar.apply(Array.from({ length: 20 }, (_, i): RawMcpTool => ({ name: `s__t${i}` })))
  assert.deepEqual([...tools.registered.keys()].sort(), [`${MCP_TOOL_PREFIX}call_tool`, `${MCP_TOOL_PREFIX}find_tools`])
  assert.deepEqual(registrar.state(), { mode: 'on-demand', hubToolCount: 20, registeredCount: 2 })
})

test('re-applying swaps the whole set (no stale tools left behind)', () => {
  const tools = fakeTools()
  const registrar = new MagpieToolRegistrar(tools, hubOptions)
  registrar.apply([{ name: 'a__one' }, { name: 'b__two' }, { name: 'c__three' }])
  assert.equal(tools.registered.size, 3)
  registrar.apply(Array.from({ length: 15 }, (_, i): RawMcpTool => ({ name: `s__t${i}` })))
  assert.equal(tools.registered.size, 2)
  assert.ok(tools.registered.has(`${MCP_TOOL_PREFIX}find_tools`))
})

test('find/call definitions carry the proxy schemas; direct carries the hub schema', () => {
  const find = findToolsDefinition(hubOptions)
  assert.equal(find.name, `${MCP_TOOL_PREFIX}find_tools`)
  assert.equal((find.parameters as { properties: Record<string, unknown> }).properties.query !== undefined, true)
  const call = callToolDefinition(hubOptions)
  assert.equal(call.name, `${MCP_TOOL_PREFIX}call_tool`)
  assert.deepEqual((call.parameters as { required: string[] }).required, ['name'])

  const direct = directToolDefinition({ name: 'x__y', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } }, hubOptions)
  assert.equal(direct.name, `${MCP_TOOL_PREFIX}x__y`)
  assert.deepEqual((direct.parameters as { properties: Record<string, unknown> }).properties, { q: { type: 'string' } })
})

test('direct execute forwards to the hub tools/call and renders its text', async () => {
  const calls: Array<{ name: string; args: unknown }> = []
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { method: string; params: { name: string; arguments: unknown } }
    calls.push({ name: body.params.name, args: body.params.arguments })
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'ran ok' }] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
  const def = directToolDefinition({ name: 'bookmark__sync-status' }, hubOptions)
  // Route the call through a fetchImpl by swapping the global temporarily.
  const original = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    const value = (await def.execute({}, {})) as { content: Array<{ text: string }> }
    assert.equal(value.content[0]?.text, 'ran ok')
    assert.deepEqual(calls, [{ name: 'bookmark__sync-status', args: {} }])
    assert.deepEqual(def.output.render({}, value), [{ type: 'text', text: 'ran ok' }])
  } finally {
    globalThis.fetch = original
  }
})

test('an MCP isError result rejects so DSH records the call as failed', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'boom' }], isError: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch
  const original = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    const def = directToolDefinition({ name: 'x__y' }, hubOptions)
    await assert.rejects(() => def.execute({}, {}), /boom/)
  } finally {
    globalThis.fetch = original
  }
})

test('the find_tools description names every server and its tools (the discovery fix)', () => {
  // The regression this guards: with only "search for a tool" as the text, a
  // model cannot know a bookmark server exists, so "find my bookmarks" never
  // reaches the hub. The catalog must name the server on every request.
  const tools: RawMcpTool[] = [
    ...Array.from({ length: 77 }, (_, i): RawMcpTool => ({ name: `notion__notion-tool-${i}` })),
    { name: 'bookmark__search-bookmarks' },
    { name: 'bookmark__list-bookmark-tree' },
    { name: 'bookmark__sync-status' },
    { name: 'atvloadly__get_device_list' },
  ]
  const def = findToolsDefinition(hubOptions, tools)
  assert.match(def.description, /bookmark \(3\)/, 'the server and its tool count are named')
  assert.match(def.description, /search-bookmarks/, 'a small server keeps its tool names')
  assert.match(def.description, /atvloadly/, 'every server appears')
  assert.match(def.description, /notion \(77\)/, 'a large server is still named')
  assert.match(def.description, /\+\d+ more/, 'the overflow is marked rather than silently dropped')
  assert.ok(def.description.length < 2000, `description stays small, got ${def.description.length}`)
})

test('the catalog budget is shared fairly: a small server is never crowded out', () => {
  const tools: RawMcpTool[] = [
    ...Array.from({ length: 200 }, (_, i): RawMcpTool => ({ name: `huge__tool-with-a-fairly-long-name-${i}` })),
    { name: 'bookmark__search-bookmarks' },
  ]
  const def = findToolsDefinition(hubOptions, tools)
  assert.match(def.description, /bookmark: search-bookmarks/, 'the 1-tool server keeps its name despite the 200-tool one')
  assert.ok(def.description.length <= FIND_CATALOG_MAX + 400, `bounded, got ${def.description.length}`)
})

test('buildToolCatalog is empty with no tools, so the description falls back to instructions only', () => {
  assert.equal(buildToolCatalog([]), '')
  const def = findToolsDefinition(hubOptions, [])
  assert.doesNotMatch(def.description, /Servers behind this hub/)
  assert.match(def.description, /Find the tools of the Magpie MCP hub/)
})
