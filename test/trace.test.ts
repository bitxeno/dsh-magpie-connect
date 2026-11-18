import test from 'node:test'
import assert from 'node:assert/strict'
import {
  __resetTraceCaches,
  deriveGatewayBase,
  fetchTraceView,
  fetchWebIcon,
  TRACE_ACCOUNT_ROWS,
} from '../src/trace.ts'
import {
  accountLine,
  durationParts,
  isUsageCritical,
  requestModelLabel,
  requestPlaceLabel,
  requestTone,
  resetParts,
  usageBars,
  isTotalWindowName,
  USAGE_BARS,
} from '../src/client/trace-format.ts'
import type { TraceAccountRow, TraceRequestRow } from '../src/trace-contract.ts'

function fakeFetch(routes: Record<string, unknown>, status = 200) {
  return (async (url: string | URL) => {
    const target = String(url)
    const key = Object.keys(routes).find((route) => target.includes(route))
    const body = key !== undefined ? routes[key] : undefined
    if (body instanceof Error) throw body
    if (body === undefined) return new Response(JSON.stringify({ error: 'no route' }), { status })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

const ledgerBody = {
  object: 'list',
  period: 'today',
  calls: 1019,
  errors: 1,
  retried: 3,
  canceled: 2,
  credits: 12.5,
  rows: [
    {
      route_id: 1794489378073,
      t: '2026-11-13T22:58:39+08:00',
      agent: 'OpenAI',
      agentName: 'OpenAI',
      provider: 'workbuddy',
      providerName: 'WorkBuddy',
      providerAccount: 'momo',
      model: 'deepseek-v4.1-flash',
      req: 'group/bot',
      served: 'deepseek-v4.1-flash',
      ms: 6690,
      ttft_ms: 1997,
      status: 200,
      cost: 0,
    },
    {
      route_id: 1794489378072,
      t: '2026-11-13T22:40:19+08:00',
      agent: 'magpie',
      agentName: 'magpie',
      ms: 1238,
      status: 401,
    },
  ],
}

const quotasBody = {
  data: [
    {
      provider: 'workbuddy',
      name: 'WorkBuddy',
      kind: 'subscription',
      plan: 'Free plan',
      user: 'momo',
      windows: [
        { name: 'Credits', used: 38.18, remaining: 61.82, resetsAt: '2026-11-30T00:00:00Z' },
        { name: 'Chat requests', used: 0, remaining: 100 },
      ],
    },
    {
      provider: 'codex',
      name: 'Codex',
      plan: 'free',
      user: 'someone@example.com',
      error: 'sign-in has expired',
      windows: [],
    },
    { name: 'DeepSeek', plan: undefined, user: undefined },
  ],
}

test('fetchWebIcon rejects unsafe names before fetching', async () => {
  const saved = globalThis.fetch
  let called = false
  globalThis.fetch = (async () => {
    called = true
    return new Response('<svg/>', { status: 200 })
  }) as typeof fetch
  try {
    await assert.rejects(
      () => fetchWebIcon('http://api.lan', 'web-key', '../secret', new AbortController().signal),
      /invalid/,
    )
    assert.equal(called, false)
  } finally {
    globalThis.fetch = saved
  }
})

test('deriveGatewayBase strips the version segment and keeps origin and prefixes', () => {
  assert.equal(deriveGatewayBase('http://api.lan/v1'), 'http://api.lan')
  assert.equal(deriveGatewayBase('http://api.lan/v1/'), 'http://api.lan')
  assert.equal(deriveGatewayBase('http://api.lan:3430/v1'), 'http://api.lan:3430')
  assert.equal(deriveGatewayBase('http://api.lan/v2'), 'http://api.lan')
  assert.equal(deriveGatewayBase('http://api.lan/gw/v1'), 'http://api.lan/gw')
  assert.equal(deriveGatewayBase('http://api.lan'), 'http://api.lan')
  assert.equal(deriveGatewayBase('not a url'), undefined)
})

test('fetchTraceView reports unconfigured without an endpoint', async () => {
  const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: '' }, new AbortController().signal)
  assert.equal(view.status, 'unconfigured')
  assert.equal(view.routingUrl, 'http://api.lan/?view=routing')
})

test('fetchTraceView compresses the ledger and the quotas into the wire view', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': ledgerBody,
    '/v1/magpie/quotas': quotasBody,
  })
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal)
    assert.equal(view.status, 'ok')
    assert.deepEqual(view.totals, { requests: 1019, errors: 1, retried: 3, canceled: 2, credits: 12.5 })
    assert.equal(view.requests?.length, 2)
    const first = view.requests?.[0]
    assert.equal(first?.agent, 'OpenAI')
    // served === requested collapses to the asked name alone.
    assert.equal(first?.requested, 'group/bot')
    assert.equal(first?.served, 'deepseek-v4.1-flash')
    assert.equal(first?.provider, 'WorkBuddy')
    assert.equal(first?.account, 'momo')
    assert.equal(first?.ms, 6690)
    assert.equal(first?.status, 200)
    const second = view.requests?.[1]
    assert.equal(second?.status, 401)
    assert.equal(second?.provider, undefined)
    const accounts = view.accounts ?? []
    assert.equal(accounts.length, 3)
    assert.equal(accounts[0]?.provider, 'WorkBuddy')
    assert.equal(accounts[0]?.usedPct, 38)
    assert.equal(accounts[0]?.plan, 'Free plan')
    // The holder never crosses the wire whole: the head only, tails dropped.
    assert.equal(accounts[0]?.user, 'momo')
    assert.equal(accounts[1]?.user, 'some…')
    assert.equal(accounts[1]?.error, 'sign-in has expired')
    assert.equal(accounts[1]?.usedPct, undefined)
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView keeps a partial view when one endpoint fails', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': ledgerBody,
    '/v1/magpie/quotas': Object.assign(new Error('HTTP 500'), { statusCode: 500 }),
  })
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal)
    assert.equal(view.status, 'ok')
    assert.equal(view.requests?.length, 2)
    assert.equal(view.accounts, undefined)
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView classifies a 403 from an unshared gateway', async () => {
  const saved = globalThis.fetch
  const refused = (async () => new Response(JSON.stringify({ error: { message: 'shared only' } }), { status: 403 })) as typeof fetch
  globalThis.fetch = refused
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal)
    assert.equal(view.status, 'forbidden')
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView caps account rows', async () => {
  const saved = globalThis.fetch
  const many = Array.from({ length: TRACE_ACCOUNT_ROWS + 5 }, (_, index) => ({
    name: `acc-${index}`,
    windows: [{ used: index }],
  }))
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': { rows: [], calls: 0, errors: 0, retried: 0, canceled: 0 },
    '/v1/magpie/quotas': { data: many },
  })
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal)
    assert.equal(view.accounts?.length, TRACE_ACCOUNT_ROWS)
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView reads the session route when a session is named', async () => {
  const saved = globalThis.fetch
  const askedUrls: string[] = []
  globalThis.fetch = (async (url: string | URL) => {
    askedUrls.push(String(url))
    if (String(url).includes('/v1/magpie/route')) {
      return new Response(JSON.stringify({
        session: 'dsh-1',
        seq: 660448,
        route: {
          id: 1,
          time: '2026-11-14T00:20:27+08:00',
          asked: 'workbuddy-ai/deepseek-v4.1-flash-sg',
          model: 'workbuddy-ai/deepseek-v4.1-flash-sg',
          served: 'deepseek-v4.1-flash-sg',
          tries: [{ model: 'workbuddy-ai/deepseek-v4.1-flash-sg', done: true, status: 200, ms: 1405 }],
          done: true,
          status: 200,
          ms: 1467,
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ rows: [], calls: 0, errors: 0, retried: 0, canceled: 0, data: [] }), { status: 200 })
  }) as typeof fetch
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-1')
    assert.ok(askedUrls.some((url) => url.includes('/v1/magpie/route?session=dsh-1')))
    assert.equal(view.sessionRoute?.asked, 'workbuddy-ai/deepseek-v4.1-flash-sg')
    assert.equal(view.sessionRoute?.served, 'deepseek-v4.1-flash-sg')
    assert.equal(view.sessionRoute?.ms, 1467)
    assert.equal(view.sessionRoute?.tries?.length, 1)
    assert.equal(view.sessionRoute?.tries?.[0]?.model, 'workbuddy-ai/deepseek-v4.1-flash-sg')
    assert.equal(view.sessionRoute?.seq, 660448)
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView omits the session route for an unknown session and without one', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': { rows: [], calls: 0, errors: 0, retried: 0, canceled: 0 },
    '/v1/magpie/quotas': { data: [] },
    '/v1/magpie/route': { session: 'x', seq: 0, route: null },
  })
  try {
    // Named but unrouted: the key stays absent, not an empty object.
    const named = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal, 'x')
    assert.equal(named.sessionRoute, undefined)
    // Unnamed: the route endpoint is never asked.
    const unnamed = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal)
    assert.equal(unnamed.sessionRoute, undefined)
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView reads in-flight requests and pins the own session first', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': { rows: [], calls: 0, errors: 0, retried: 0, canceled: 0 },
    '/v1/magpie/quotas': { data: [] },
    '/v1/magpie/concurrency': {
      object: 'concurrency',
      requests: 3,
      waiting: 1,
      tools: 0,
      active: [
        { id: 1, agent: 'OpenAI', model: 'zcode/GLM-5.3-Flash', provider: 'zcode', session: 'other', ms: 400, phase: 'upstream' },
        { id: 2, agent: 'OpenAI', model: 'workbuddy-ai/hy4free', provider: 'workbuddy-ai', session: 'dsh-1', ms: 900, phase: 'slot' },
        { id: 3, agent: 'magpie', ms: 60 },
      ],
    },
  })
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-1')
    assert.deepEqual(view.concurrency, { requests: 3, waiting: 1, tools: 0 })
    const active = view.active ?? []
    assert.equal(active.length, 3)
    // The own session's row comes first and is marked, whatever its age.
    assert.equal(active[0]?.own, true)
    assert.equal(active[0]?.session, 'dsh-1')
    // The rest order longest-running first.
    assert.equal(active[1]?.ms, 400)
    assert.equal(active[1]?.own, undefined)
    assert.equal(active[2]?.phase, undefined)
  } finally {
    globalThis.fetch = saved
  }
})



test('fetchTraceView keeps nested routing groups as separate compact sections', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': { rows: [], calls: 0, errors: 0, retried: 0, canceled: 0 },
    '/v1/magpie/quotas': { data: [] },
    '/api/gateway/trace': {
      seq: 10,
      routes: [{
        id: 7,
        time: '2026-11-14T13:50:00+08:00',
        session: 'dsh-1',
        model: 'group/bot',
        group: {
          id: 'bot',
          name: 'bot',
          ref: 'group/bot',
          routing: 'order',
          members: ['workbuddy/hy4free', 'workbuddy/deepseek-v4.1-flash', 'workbuddy-ai/hy4free', 'copilot/gpt-6-luna:max', 'codex/gpt-6-luna:max'],
          subs: [
            { id: 'auto-hy4free', ref: 'auto/hy4free', name: 'Hy4', routing: '' },
            { id: 'auto-gpt-6-luna', ref: 'auto/gpt-6-luna', name: 'GPT-6 Luna', routing: '' },
          ],
          via: ['auto-hy4free', '', 'auto-hy4free', 'auto-gpt-6-luna', 'auto-gpt-6-luna'],
        },
        order: [
          { id: 'workbuddy', provider: 'workbuddy', name: 'WorkBuddy', who: 'momo', plan: 'Free plan', model: 'hy4free', via: ['auto-hy4free'], used: 99, amount: 346, limit: 350, unit: 'credits' },
          { id: 'workbuddy', provider: 'workbuddy', name: 'WorkBuddy', who: 'momo', plan: 'Free plan', model: 'deepseek-v4.1-flash', used: 43, amount: 1682, limit: 3891, unit: 'credits' },
          { id: 'workbuddy-ai', provider: 'workbuddy-ai', name: 'WorkBuddy AI', who: 'solfinapp', plan: 'Free plan', model: 'hy4free', via: ['auto-hy4free'], used: 0, rest: { why: 'quota', by: 'resets', until: '2026-11-14T16:27:00+08:00', rate: true } },
          { id: 'copilot', provider: 'copilot', name: 'Copilot', who: 'cxfksword', plan: 'Pro', model: 'gpt-6-luna', fixed: 'max', via: ['auto-gpt-6-luna'], used: 46 },
        ],
        left: [{ id: 'codex', provider: 'codex', name: 'Codex', who: 'ventochen', plan: 'free', model: 'gpt-6-luna', fixed: 'max', via: ['auto-gpt-6-luna'], window: 272000 }],
        tries: [{ id: 'workbuddy', model: 'hy4free', status: 200, done: true, ms: 1234 }],
        done: true,
        status: 200,
        ms: 1300,
      }],
    },
  })
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-1', 'web-secret')
    assert.equal(view.status, 'ok')
    assert.equal(view.webTraceError, undefined)
    assert.equal(view.routingUrl, 'http://api.lan/?view=routing')
    assert.equal(view.sessionTrace?.group?.subs?.length, 2)
    const sections = view.sessionTrace?.sections ?? []
    assert.equal(sections.length, 3)
    assert.equal(sections[0]?.name, 'Hy4')
    assert.equal(sections[0]?.ref, 'auto/hy4free')
    assert.equal(sections[0]?.depth, 1)
    assert.equal(sections[0]?.candidates.length, 2)
    assert.equal(sections[0]?.candidates[0]?.outcome, 'answered')
    assert.equal(sections[0]?.candidates[1]?.outcome, 'resting')
    // Parent-level members stay their own headerless section, not under Hy4.
    assert.equal(sections[1]?.hideHeader, true)
    assert.equal(sections[1]?.depth, 0)
    assert.equal(sections[1]?.candidates.length, 1)
    assert.equal(sections[1]?.candidates[0]?.model, 'deepseek-v4.1-flash')
    assert.equal(sections[2]?.name, 'GPT-6 Luna')
    assert.equal(sections[2]?.ref, 'auto/gpt-6-luna')
    assert.equal(sections[2]?.depth, 1)
    assert.equal(sections[2]?.candidates[0]?.fixed, 'max')
    assert.equal(sections[2]?.candidates[1]?.window, 272000)
    assert.equal(view.sessionTrace?.order.length, 4)
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView reports Web Key failure without hiding the simplified view', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = (async (url: string | URL) => {
    const target = String(url)
    if (target.includes('/api/gateway/trace')) return new Response(JSON.stringify({ error: 'no cookie' }), { status: 401 })
    return new Response(JSON.stringify({ rows: [], calls: 0, errors: 0, retried: 0, canceled: 0, data: [] }), { status: 200 })
  }) as typeof fetch
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-1', 'bad-web-key')
    assert.equal(view.status, 'ok')
    assert.equal(view.webTraceError, 'unauthorized')
    assert.equal(view.sessionTrace, undefined)
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView falls back to the newest overall route without a session', async () => {
  const saved = globalThis.fetch
  const route = (id: number, session: string) => ({
    id,
    time: `2026-11-14T13:5${id}:00+08:00`,
    session,
    model: 'group/bot',
    group: { id: 'bot', name: 'bot', ref: 'group/bot', routing: 'order' },
    order: [{ id: 'workbuddy', provider: 'workbuddy', name: 'WorkBuddy', who: 'momo', model: 'hy4free', used: 20 }],
    tries: [{ id: 'workbuddy', model: 'hy4free', status: 200, done: true, ms: 900 }],
    done: true,
    status: 200,
    ms: 950,
  })
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': { rows: [], calls: 0, errors: 0, retried: 0, canceled: 0 },
    '/v1/magpie/quotas': { data: [] },
    '/api/gateway/trace': { seq: 3, routes: [route(1, 'session-a'), route(2, 'session-b')] },
  })
  try {
    // No session: the newest route in the whole trace stands in for it.
    const overall = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal, undefined, 'web-secret')
    assert.equal(overall.sessionTrace?.id, 2)
    // A named but unrouted session also falls back to the newest overall route.
    const unrouted = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-gone', 'web-secret')
    assert.equal(unrouted.sessionTrace?.id, 2)
    // A named, routed session still wins over the fallback.
    const named = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal, 'session-a', 'web-secret')
    assert.equal(named.sessionTrace?.id, 1)
  } finally {
    globalThis.fetch = saved
  }
})

test('durationParts compresses one significant unit', () => {
  assert.deepEqual(durationParts(820), { n: 820, unit: 'ms' })
  assert.deepEqual(durationParts(1997), { n: 2, unit: 's' })
  assert.deepEqual(durationParts(6690), { n: 7, unit: 's' })
  assert.deepEqual(durationParts(120_000), { n: 2, unit: 'm' })
  assert.deepEqual(durationParts(3 * 3600_000), { n: 3, unit: 'h' })
  assert.deepEqual(durationParts(72 * 3600_000), { n: 3, unit: 'd' })
  assert.equal(durationParts(undefined), undefined)
  assert.equal(durationParts(-1), undefined)
})

test('resetParts rounds up and drops past resets', () => {
  const now = Date.parse('2026-11-13T00:00:00Z')
  // Sub-minute waits read as one minute: the popover refreshes more slowly.
  assert.deepEqual(resetParts('2026-11-13T00:00:30Z', now), { n: 1, unit: 'm' })
  // 13 h 05 m rounds up to the hour: 14.
  assert.deepEqual(resetParts('2026-11-13T13:05:00Z', now), { n: 14, unit: 'h' })
  assert.deepEqual(resetParts('2026-11-14T12:00:00Z', now), { n: 36, unit: 'h' })
  assert.deepEqual(resetParts('2026-11-30T00:00:00Z', now), { n: 17, unit: 'd' })
  assert.equal(resetParts('2026-11-12T00:00:00Z', now), undefined)
  assert.equal(resetParts(undefined, now), undefined)
})

test('usageBars maps the share onto the gauge', () => {
  assert.equal(usageBars(0), 0)
  assert.equal(usageBars(38), 2)
  assert.equal(usageBars(90), 5)
  assert.equal(usageBars(100), USAGE_BARS)
  assert.equal(usageBars(undefined), undefined)
  assert.equal(isUsageCritical(89), false)
  assert.equal(isUsageCritical(90), true)
})

test('request helpers project rows onto one line each', () => {
  const ok: TraceRequestRow = { id: 1, time: 't', agent: 'OpenAI', requested: 'group/bot', served: 'deepseek-v4.1-flash', provider: 'WorkBuddy', account: 'momo', status: 200 }
  assert.deepEqual(requestTone(ok), 'ok')
  assert.equal(requestModelLabel(ok), 'group/bot → deepseek-v4.1-flash')
  assert.equal(requestPlaceLabel(ok), 'WorkBuddy · momo')
  const failed: TraceRequestRow = { id: 2, time: 't', agent: 'magpie', status: 401 }
  assert.deepEqual(requestTone(failed), 'failed')
  assert.equal(requestModelLabel(failed), '')
  assert.equal(requestPlaceLabel(failed), '')
  const canceled: TraceRequestRow = { id: 3, time: 't', agent: 'a', canceled: true, status: 499 }
  assert.deepEqual(requestTone(canceled), 'canceled')
})

test('accountLine flags the errored accounts instead of drawing numbers', () => {
  const now = Date.parse('2026-11-13T00:00:00Z')
  const healthy: TraceAccountRow = { provider: 'WorkBuddy', plan: 'Free', user: 'momo', usedPct: 38, resetsAt: '2026-11-30T00:00:00Z' }
  const line = accountLine(healthy, now)
  assert.equal(line.bars, 2)
  assert.equal(line.critical, false)
  assert.deepEqual(line.reset, { n: 17, unit: 'd' })
  assert.equal(line.errored, false)
  const errored: TraceAccountRow = { provider: 'Codex', error: 'expired' }
  const bad = accountLine(errored, now)
  assert.equal(bad.errored, true)
  assert.equal(bad.bars, undefined)
})

test('fetchTraceView picks the aggregate window when the vendor splits credits', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': { rows: [], calls: 0, errors: 0, retried: 0, canceled: 0 },
    '/v1/magpie/quotas': {
      data: [{
        provider: 'workbuddy',
        name: 'WorkBuddy',
        plan: 'Free plan',
        user: 'momo',
        windows: [
          { name: 'Credits', used: 100, remaining: 0, resetsAt: '2026-11-30T15:59:59Z', display: '500 / 500', amount: 500, limit: 500, unit: 'credits' },
          { name: 'Extra credits', used: 58.77, remaining: 41.23, display: '2110.61 / 3591', amount: 2110.61, limit: 3591, unit: 'credits' },
          { name: 'Total credits', used: 63.81, remaining: 36.19, resetsAt: '2026-11-30T15:59:59Z', display: '2610.61 / 4091', amount: 2610.61, limit: 4091, unit: 'credits' },
        ],
      }],
    },
  })
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal)
    const account = view.accounts?.[0]
    // The base allowance alone would read 100% beside a 2610 / 4091 total.
    assert.equal(account?.windowName, 'Total credits')
    assert.equal(account?.usedPct, 64)
    assert.equal(account?.amount, 2610.61)
    assert.equal(account?.limit, 4091)
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView never lets an unlimited window win the account row', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': { rows: [], calls: 0, errors: 0, retried: 0, canceled: 0 },
    '/v1/magpie/quotas': {
      data: [{
        provider: 'copilot',
        name: 'Copilot',
        plan: 'Pro',
        user: 'someone',
        windows: [
          { unlimited: true, name: 'Chat requests', used: 0, remaining: 100, display: 'Unlimited' },
          { name: 'Premium requests', used: 56.19, remaining: 43.81, resetsAt: '2026-12-01T00:00:00Z', display: '842.9 / 1500' },
        ],
      }],
    },
  })
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal)
    assert.equal(view.accounts?.[0]?.windowName, 'Premium requests')
    assert.equal(view.accounts?.[0]?.usedPct, 56)
  } finally {
    globalThis.fetch = saved
  }
})

test('a candidate gauge and its amount describe the same window', async () => {
  const saved = globalThis.fetch
  globalThis.fetch = fakeFetch({
    '/v1/magpie/usage/requests': { rows: [], calls: 0, errors: 0, retried: 0, canceled: 0 },
    // The quota read says 100% of the base allowance; the trace row weighs the
    // aggregate. The row's own numbers must win so the bar matches 2610/4091.
    '/v1/magpie/quotas': {
      data: [{
        provider: 'workbuddy',
        name: 'WorkBuddy',
        user: 'momo',
        windows: [
          { name: 'Credits', used: 100, remaining: 0, display: '500 / 500', amount: 500, limit: 500, unit: 'credits' },
          { name: 'Total credits', used: 63.81, remaining: 36.19, display: '2610.61 / 4091', amount: 2610.61, limit: 4091, unit: 'credits' },
        ],
      }],
    },
    '/api/gateway/trace': {
      seq: 5,
      routes: [{
        id: 9,
        time: '2026-11-17T10:56:00+08:00',
        session: 'dsh-1',
        model: 'group/bot',
        order: [{
          id: 'workbuddy', provider: 'workbuddy', name: 'WorkBuddy', who: 'momo',
          model: 'deepseek-v4.1-flash', used: 63.34, amount: 2591.44, limit: 4091, unit: 'credits',
        }],
        tries: [{ id: 'workbuddy', model: 'deepseek-v4.1-flash', status: 200, done: true, ms: 900 }],
        done: true,
        status: 200,
        ms: 950,
      }],
    },
  })
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-1', 'web-secret')
    const candidate = view.sessionTrace?.sections?.[0]?.candidates?.[0]
    // 63% is what 2591 / 4091 rounds to; the quota's 100% would contradict it.
    assert.equal(candidate?.usedPct, 63)
    assert.equal(candidate?.amount, 2591.44)
    assert.equal(candidate?.limit, 4091)
    // The limit identifies the window, so the aggregate's name travels with it.
    assert.equal(candidate?.windowName, 'Total credits')
  } finally {
    globalThis.fetch = saved
  }
})

test('isTotalWindowName spots the aggregate window only', () => {
  assert.equal(isTotalWindowName('Total credits'), true)
  assert.equal(isTotalWindowName('Grand total'), true)
  assert.equal(isTotalWindowName('  TOTAL credits '), true)
  // The parts of the aggregate are not the aggregate.
  assert.equal(isTotalWindowName('Credits'), false)
  assert.equal(isTotalWindowName('Extra credits'), false)
  assert.equal(isTotalWindowName('30 days'), false)
  assert.equal(isTotalWindowName(undefined), false)
})

/** A gateway-view reply with no data, for the endpoints that run alongside the web trace. */
function emptyGatewayBody(): Response {
  return new Response(JSON.stringify({ rows: [], calls: 0, errors: 0, retried: 0, canceled: 0, data: [] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** The cookie a request carries, from the plain-object headers this plugin sends. */
function cookieOf(init: RequestInit | undefined): string {
  return ((init?.headers ?? {}) as Record<string, string>).cookie ?? ''
}

test('fetchTraceView learns the Web cookie name behind a 443 reverse proxy', async () => {
  __resetTraceCaches()
  const saved = globalThis.fetch
  const signIns: string[] = []
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const target = String(url)
    // The sign-in link Magpie answers with its real cookie name (its listen port).
    if (target.includes('/?k=')) {
      signIns.push(target)
      return new Response('sign in', {
        status: 303,
        headers: { 'set-cookie': 'magpie_web_3426=web-secret; Path=/; HttpOnly; SameSite=Lax', location: '/' },
      })
    }
    if (target.includes('/api/gateway/trace')) {
      // The external port derivation (443) is refused; the listen-port name is accepted.
      if (cookieOf(init).includes('magpie_web_3426=')) {
        return new Response(JSON.stringify({
          seq: 1,
          routes: [{ id: 1, time: 't', session: 'dsh-1', model: 'group/bot', done: true, status: 200, ms: 5 }],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: 'no cookie' }), { status: 401 })
    }
    return emptyGatewayBody()
  }) as typeof fetch
  try {
    const first = await fetchTraceView({ baseUrl: 'https://magpie.example.com/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-1', 'web-secret')
    assert.equal(first.status, 'ok')
    assert.equal(first.webTraceError, undefined)
    assert.equal(first.sessionTrace?.id, 1)
    assert.equal(signIns.length, 1)
    // The learned name is cached: the next read goes straight to it, no sign-in.
    const second = await fetchTraceView({ baseUrl: 'https://magpie.example.com/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-1', 'web-secret')
    assert.equal(second.sessionTrace?.id, 1)
    assert.equal(signIns.length, 1)
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchWebIcon learns the Web cookie name behind a 443 reverse proxy', async () => {
  __resetTraceCaches()
  const saved = globalThis.fetch
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const target = String(url)
    if (target.includes('/?k=')) {
      return new Response('sign in', {
        status: 303,
        headers: { 'set-cookie': 'magpie_web_3426=web-secret; Path=/', location: '/' },
      })
    }
    if (target.includes('/icons/workbuddy.svg')) {
      if (cookieOf(init).includes('magpie_web_3426=')) {
        return new Response('<svg>ok</svg>', { status: 200, headers: { 'content-type': 'image/svg+xml' } })
      }
      return new Response('no', { status: 401 })
    }
    return new Response('no', { status: 404 })
  }) as typeof fetch
  try {
    const icon = await fetchWebIcon('https://magpie.example.com', 'web-secret', 'workbuddy', new AbortController().signal)
    assert.equal(icon.contentType, 'image/svg+xml')
    assert.equal(new TextDecoder().decode(icon.body), '<svg>ok</svg>')
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView tries the configured base before the :3430 fallback', async () => {
  __resetTraceCaches()
  const saved = globalThis.fetch
  const traceUrls: string[] = []
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const target = String(url)
    if (target.includes('/api/gateway/trace')) {
      traceUrls.push(target)
      if (cookieOf(init).includes('magpie_web_3426=')) {
        return new Response(JSON.stringify({ seq: 1, routes: [{ id: 1, time: 't', session: 'dsh-1', model: 'group/bot', done: true, status: 200, ms: 5 }] }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: 'no cookie' }), { status: 401 })
    }
    return emptyGatewayBody()
  }) as typeof fetch
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan:3426/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-1', 'web-secret')
    assert.equal(view.sessionTrace?.id, 1)
    // The answering base leads, so the black-hole-prone :3430 is never probed.
    assert.equal(traceUrls.length, 1)
    assert.ok(traceUrls[0]?.startsWith('http://api.lan:3426/'))
    assert.ok(!traceUrls.some((url) => url.includes(':3430')))
  } finally {
    globalThis.fetch = saved
  }
})

test('fetchTraceView still falls back to :3430 when the configured base has no Web routes', async () => {
  __resetTraceCaches()
  const saved = globalThis.fetch
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const target = String(url)
    if (target.includes(':3425/api/gateway/trace')) throw new TypeError('fetch failed')
    if (target.includes(':3430/api/gateway/trace')) {
      if (cookieOf(init).includes('magpie_web_3430=')) {
        return new Response(JSON.stringify({ seq: 1, routes: [{ id: 2, time: 't', session: 'dsh-1', model: 'group/bot', done: true, status: 200, ms: 5 }] }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: 'no cookie' }), { status: 401 })
    }
    return emptyGatewayBody()
  }) as typeof fetch
  try {
    const view = await fetchTraceView({ baseUrl: 'http://api.lan:3425/v1', apiKey: 'k' }, new AbortController().signal, 'dsh-1', 'web-secret')
    assert.equal(view.webTraceError, undefined)
    assert.equal(view.sessionTrace?.id, 2)
  } finally {
    globalThis.fetch = saved
  }
})
