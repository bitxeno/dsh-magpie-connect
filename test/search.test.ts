import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAGPIE_SEARCH_MCP_PATH,
  MagpieSearchError,
  MagpieSearchProvider,
  mapAnthropicSearchResponse,
  parseMagpieMcpSearchText,
  type SearchRuntimeSnapshot,
} from '../src/search.ts'

test('mapAnthropicSearchResponse 提取结构化来源、按 URL 去重并用 citations 补齐 snippet', () => {
  const result = mapAnthropicSearchResponse({
    content: [
      {
        type: 'web_search_tool_result',
        content: [
          {
            type: 'web_search_result',
            url: 'https://example.com/a',
            title: 'Page A',
            snippet: 'Direct snippet A',
            page_age: '2 days ago',
          },
          {
            type: 'web_search_result',
            url: 'https://example.com/b',
            title: 'Page B',
          },
          {
            type: 'web_search_result',
            url: 'https://example.com/a',
            title: 'Duplicate A',
            snippet: 'Should be ignored',
          },
        ],
      },
      {
        type: 'text',
        text: 'Summary prose',
        citations: [
          { url: 'https://example.com/b', cited_text: 'Cited excerpt B' },
          { url: 'https://example.com/b', cited_text: 'Second excerpt ignored' },
        ],
      },
    ],
  })

  assert.equal(result.truncated, false)
  assert.deepEqual(result.sources, [
    {
      url: 'https://example.com/a',
      title: 'Page A',
      snippet: 'Direct snippet A',
      publishedAt: '2 days ago',
    },
    {
      url: 'https://example.com/b',
      title: 'Page B',
      snippet: 'Cited excerpt B',
    },
  ])
})

test('mapAnthropicSearchResponse 缺少 web_search_tool_result 块时抛出 WEB_PROVIDER_ERROR', () => {
  assert.throws(
    () => mapAnthropicSearchResponse({ content: [{ type: 'text', text: 'Only prose' }] }),
    (error: unknown) => error instanceof MagpieSearchError && error.code === 'WEB_PROVIDER_ERROR',
  )
})

test('parseMagpieMcpSearchText 解析 Search API 编号列表（pagesSaid 格式）', () => {
  const text = [
    '1. Go downloads — https://go.dev/dl/',
    'go1.27.1 is the latest release.',
    'More details on line two.',
    '',
    '2. Release History — https://go.dev/doc/devel/release',
    'Release notes archive.',
    '',
    '3. Duplicate — https://go.dev/dl/',
    'Ignored duplicate.',
  ].join('\n')

  const result = parseMagpieMcpSearchText(text)
  assert.equal(result.content, undefined)
  assert.equal(result.truncated, false)
  assert.deepEqual(result.sources, [
    {
      url: 'https://go.dev/dl/',
      title: 'Go downloads',
      snippet: 'go1.27.1 is the latest release.\nMore details on line two.',
    },
    {
      url: 'https://go.dev/doc/devel/release',
      title: 'Release History',
      snippet: 'Release notes archive.',
    },
  ])
})

test('parseMagpieMcpSearchText 解析代搜模型正文与 Sources 段落（searchWith 格式）', () => {
  const text = [
    'Go 1.27.1 is the latest stable release.',
    '',
    'Sources:',
    '- Go downloads — https://go.dev/dl/',
    '- [Go blog](https://go.dev/blog/)',
    '- https://go.dev/dl/',
  ].join('\n')

  const result = parseMagpieMcpSearchText(text)
  assert.equal(result.content, 'Go 1.27.1 is the latest stable release.')
  assert.deepEqual(result.sources, [
    { url: 'https://go.dev/dl/', title: 'Go downloads' },
    { url: 'https://go.dev/blog/', title: 'Go blog' },
  ])
})

test('parseMagpieMcpSearchText 对无结构纯文本保留 content 并提取链接', () => {
  const result = parseMagpieMcpSearchText('Check [Docs](https://docs.example.com) and https://news.example.com/.')
  assert.equal(result.content, 'Check [Docs](https://docs.example.com) and https://news.example.com/.')
  assert.deepEqual(result.sources, [
    { url: 'https://docs.example.com', title: 'Docs' },
    { url: 'https://news.example.com/' },
  ])
  assert.deepEqual(parseMagpieMcpSearchText('   '), { sources: [], truncated: false })
})

test('MagpieSearchProvider 在 MCP 模式下调用 /mcp/magpie/web-search 并传递 count 与鉴权头', async () => {
  let seenUrl = ''
  let seenHeaders: Record<string, string> = {}
  let seenBody: Record<string, unknown> = {}
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(input)
    seenHeaders = (init?.headers ?? {}) as Record<string, string>
    seenBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ type: 'text', text: '1. DeepSeek — https://www.deepseek.com\nAI research lab.' }],
          isError: false,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }) as typeof fetch

  const provider = new MagpieSearchProvider({
    id: 'dsh-magpie-connect',
    title: 'Magpie',
    fetchImpl,
    resolveSnapshot: () => ({
      endpoint: { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'gw-key' },
      search: { mode: 'mcp', model: '', maxUses: 5, timeoutMs: 10_000 },
    }),
  })

  assert.equal(provider.available(), true)
  assert.equal(await provider.ready(), true)
  const result = await provider.search({ query: 'deepseek', maxResults: 50 })
  assert.equal(seenUrl, `http://127.0.0.1:3425${MAGPIE_SEARCH_MCP_PATH}`)
  assert.equal(seenHeaders.authorization, 'Bearer gw-key')
  assert.match(seenHeaders['user-agent'] ?? '', /^deepseek-harness\//)
  // count 应被限幅到 Magpie 上限 20
  assert.deepEqual(seenBody.params, { name: 'web_search', arguments: { query: 'deepseek', count: 20 } })
  assert.deepEqual(result.sources, [
    { url: 'https://www.deepseek.com', title: 'DeepSeek', snippet: 'AI research lab.' },
  ])
})

test('MagpieSearchProvider 在 model 模式下请求 {baseUrl}/messages 并支持运行时切换模型', async () => {
  const seenRequests: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    seenRequests.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    })
    return new Response(
      JSON.stringify({
        content: [
          {
            type: 'web_search_tool_result',
            content: [{ type: 'web_search_result', url: 'https://example.org/hit', title: 'Hit', snippet: 'Snippet' }],
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }) as typeof fetch

  let snapshot: SearchRuntimeSnapshot = {
    endpoint: { baseUrl: 'https://gw.example.com/v2/', apiKey: 'sk-1' },
    search: { mode: 'model', model: 'codex/gpt-5.4-mini', maxUses: 3, timeoutMs: 10_000 },
  }
  const provider = new MagpieSearchProvider({
    id: 'dsh-magpie-connect',
    fetchImpl,
    resolveSnapshot: () => snapshot,
  })

  assert.equal(await provider.ready(), true)
  const first = await provider.search({ query: 'first query' })
  assert.equal(first.sources.length, 1)
  assert.equal(seenRequests[0]?.url, 'https://gw.example.com/v2/messages')
  assert.equal(seenRequests[0]?.headers.authorization, 'Bearer sk-1')
  assert.equal(seenRequests[0]?.headers['x-api-key'], 'sk-1')
  assert.equal(seenRequests[0]?.headers['anthropic-version'], '2023-06-01')
  assert.equal(seenRequests[0]?.body.model, 'codex/gpt-5.4-mini')
  assert.deepEqual(seenRequests[0]?.body.tools, [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }])

  // 切换模型后下一次搜索立即生效，无需重新注册 provider
  snapshot = {
    ...snapshot,
    search: { ...snapshot.search, model: 'anthropic/claude-sonnet-5' },
  }
  await provider.search({ query: 'second query' })
  assert.equal(seenRequests[1]?.body.model, 'anthropic/claude-sonnet-5')
})

test('MagpieSearchProvider 正确处理未配置凭据、缺模型、MCP 报错与取消/超时', async () => {
  // 缺 Key：available 为 true（结构合法），ready 为 false，调用抛 WEB_PROVIDER_CREDENTIAL_MISSING
  const noKey = new MagpieSearchProvider({
    id: 'dsh-magpie-connect',
    resolveSnapshot: () => ({
      endpoint: { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: '' },
      search: { mode: 'mcp', model: '', maxUses: 5, timeoutMs: 5_000 },
    }),
  })
  assert.equal(noKey.available(), true)
  assert.equal(await noKey.ready(), false)
  await assert.rejects(
    () => noKey.search({ query: 'test' }),
    (error: unknown) => error instanceof MagpieSearchError && error.code === 'WEB_PROVIDER_CREDENTIAL_MISSING',
  )

  // model 模式缺模型：ready 为 false，调用抛 WEB_PROVIDER_ERROR
  const noModel = new MagpieSearchProvider({
    id: 'dsh-magpie-connect',
    resolveSnapshot: () => ({
      endpoint: { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' },
      search: { mode: 'model', model: '   ', maxUses: 5, timeoutMs: 5_000 },
    }),
  })
  assert.equal(noModel.available(), true)
  assert.equal(await noModel.ready(), false)
  await assert.rejects(
    () => noModel.search({ query: 'test' }),
    (error: unknown) => error instanceof MagpieSearchError && error.code === 'WEB_PROVIDER_ERROR' && /search model/i.test(error.message),
  )

  // MCP 404 时应给出切换为指定模型模式的提示
  const mcp404 = new MagpieSearchProvider({
    id: 'dsh-magpie-connect',
    fetchImpl: (async () => new Response('not found', { status: 404 })) as typeof fetch,
    resolveSnapshot: () => ({
      endpoint: { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' },
      search: { mode: 'mcp', model: '', maxUses: 5, timeoutMs: 5_000 },
    }),
  })
  await assert.rejects(
    () => mcp404.search({ query: 'test' }),
    (error: unknown) => error instanceof MagpieSearchError && error.code === 'WEB_PROVIDER_ERROR' && /specific Magpie model/i.test(error.message),
  )

  // MCP 工具返回 isError: true 时透传错误信息
  const mcpToolErr = new MagpieSearchProvider({
    id: 'dsh-magpie-connect',
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { content: [{ type: 'text', text: 'magpie couldn’t search: no searcher configured' }], isError: true },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch,
    resolveSnapshot: () => ({
      endpoint: { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' },
      search: { mode: 'mcp', model: '', maxUses: 5, timeoutMs: 5_000 },
    }),
  })
  await assert.rejects(
    () => mcpToolErr.search({ query: 'test' }),
    (error: unknown) => error instanceof MagpieSearchError && error.code === 'WEB_PROVIDER_ERROR' && /no searcher configured/.test(error.message),
  )

  // 外部取消返回 WEB_ABORTED
  const ac = new AbortController()
  ac.abort(new Error('user canceled'))
  await assert.rejects(
    () => mcp404.search({ query: 'test' }, ac.signal),
    (error: unknown) => error instanceof MagpieSearchError && error.code === 'WEB_ABORTED',
  )

  // 超时返回 WEB_PROVIDER_ERROR
  const slow = new MagpieSearchProvider({
    id: 'dsh-magpie-connect',
    fetchImpl: (async (_input: string | URL | Request, init?: RequestInit) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })) as typeof fetch,
    resolveSnapshot: () => ({
      endpoint: { baseUrl: 'http://127.0.0.1:3425/v1', apiKey: 'k' },
      search: { mode: 'mcp', model: '', maxUses: 5, timeoutMs: 25 },
    }),
  })
  await assert.rejects(
    () => slow.search({ query: 'test' }),
    (error: unknown) => error instanceof MagpieSearchError && error.code === 'WEB_PROVIDER_ERROR' && /timed out/i.test(error.message),
  )
})
