/**
 * The routing-trace fetcher: reads the gateway's own view of its routing —
 * the request ledger (`/v1/magpie/usage/requests`) and the accounts'
 * allowances (`/v1/magpie/quotas`) — and compresses both into the small
 * {@link TraceView} the composer popover shows.
 *
 * Both endpoints answer this machine and, while Magpie shares on the local
 * network, another machine too — but always with the gateway key, so the
 * fetch runs on the host, never in the browser (CORS would refuse the page,
 * and the key must not cross to it).
 *
 * `{gateway}` is the configured API base with its version segment removed:
 * `http://api.lan/v1` → `http://api.lan` — the popover contract's "base_url".
 */

import {
  isConfigured,
  normalizeBaseUrl,
  type EffectiveEndpoint,
} from './settings.ts'
import type {
  ActiveRequestRow,
  SessionRouteTry,
  SessionRouteView,
  SessionTraceView,
  TraceAccountRow,
  TraceCandidate,
  TraceGroup,
  TraceRequestRow,
  TraceRest,
  TraceRoutingSection,
  TraceStatus,
  TraceSubGroup,
  TraceTotals,
  TraceView,
} from './trace-contract.ts'

/** Request rows one popover shows; the gateway returns newest first. */
export const TRACE_REQUEST_ROWS = 8

/** Account rows one popover shows; the list scrolls past the cap. */
export const TRACE_ACCOUNT_ROWS = 14

/** In-flight rows one popover shows; the own session's row is kept first. */
export const TRACE_ACTIVE_ROWS = 5

/** How long one fetch may take before the popover shows "unreachable". */
export const TRACE_TIMEOUT_MS = 8_000

/** The `period` the ledger is read for; today keeps the header counts current. */
const LEDGER_PERIOD = 'today'

/** Path the signed-in Magpie Web console serves beside its HTML. */
const WEB_TRACE_PATH = '/api/gateway/trace'

/** Allowed set so a raw value maps onto the wire status without widening it. */
const STATUS_KINDS: readonly TraceStatus[] = ['ok', 'unconfigured', 'unauthorized', 'forbidden', 'network', 'unknown']

/**
 * The gateway base the trace endpoints hang off: the configured API base
 * with its trailing version segment (`/v1`, `/v1/`, `/v2`) removed. The
 * version is part of the API root, not of the gateway address, and the
 * `/v1/magpie/*` namespace lives on the address alone.
 * @param baseUrl - the configured versioned API root (`http://host:port/v1`).
 * @returns the base for `/v1/magpie/*` (origin plus any non-version prefix path), or `undefined` for values that never were URLs.
 */
export function deriveGatewayBase(baseUrl: string): string | undefined {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    return undefined
  }
  const trimmed = url.pathname.replace(/\/+$/, '').replace(/\/v\d+$/i, '')
  return `${url.origin}${trimmed}`
}

/** One response of the two gateway endpoints, decoded loosely (fields optional). */
type LooseRecord = Record<string, unknown>

/** Read one finite number field. */
function num(record: LooseRecord, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Read one non-empty string field. */
function str(record: LooseRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Round a 0–100 share into whole percents, clamped. */
function pctOf(used: unknown): number | undefined {
  if (typeof used !== 'number' || !Number.isFinite(used)) return undefined
  return Math.min(100, Math.max(0, Math.round(used)))
}

/** Percent from an explicit amount/limit pair (windows the vendor counts by units). */
function pctOfParts(record: LooseRecord): number | undefined {
  const amount = num(record, 'amount')
  const limit = num(record, 'limit')
  if (amount === undefined || limit === undefined || limit <= 0) return undefined
  return pctOf((amount / limit) * 100)
}

/**
 * Classify one fetch failure. The gateway's 403 wording names the share
 * setting ("told to another machine only when magpie is shared…"), so the
 * popover's hint can say exactly what to turn on.
 */
function statusForStatusCode(code: number): TraceStatus {
  if (code === 401) return 'unauthorized'
  if (code === 403) return 'forbidden'
  if (code >= 500) return 'network'
  return 'unknown'
}

/** Fetch one Magpie Web endpoint, carrying its port-scoped web cookie. */
async function fetchWebJson(base: string, webKey: string, path: string, signal: AbortSignal): Promise<LooseRecord> {
  const url = new URL(base)
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  const response = await fetch(`${base}${path}`, {
    headers: { cookie: `magpie_web_${port}=${webKey}`, accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) {
    const error = new Error(`Magpie Web HTTP ${response.status} ${path}`) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
  return (await response.json()) as LooseRecord
}

/**
 * Magpie's normal Web UI port is 3430. Some installs reverse-proxy the Web
 * routes onto the API root; try that first, then the default Web port on the
 * same host. This keeps the setting to one Web Key while supporting the
 * split API (:80/:3425) + Web (:3430) layout too.
 */
function webBases(base: string): string[] {
  // In Magpie's split layout, the API endpoint (e.g. :80 or :3425) and Web
  // console (:3430) share a hostname. If the configured endpoint is already
  // on :3430, use it; otherwise try the supplied root first, then Web's port.
  const candidates: string[] = []
  try {
    const url = new URL(base)
    if (url.port === '3430') return [base]
    url.port = '3430'
    candidates.push(`${url.origin}${url.pathname.replace(/\/+$/, '')}`)
    candidates.push(base)
  } catch {
    return [base]
  }
  return [...new Set(candidates)]
}

/** Read full trace from the same API host, trying its Web port if split. */
async function fetchFullWebTrace(base: string, webKey: string, signal: AbortSignal): Promise<{ trace: LooseRecord; base: string }> {
  let lastError: unknown
  for (const candidate of webBases(base)) {
    try {
      const trace = await fetchWebJson(candidate, webKey, `${WEB_TRACE_PATH}?after=0`, signal)
      // The Web Console's traceJSON has no `object` field (unlike the
      // gateway's loopback /v1/magpie/trace); routes[] is the reliable shape.
      if (!Array.isArray(trace.routes)) {
        throw new Error('Magpie Web returned an unexpected trace shape')
      }
      return { trace, base: candidate }
    } catch (error) {
      if (isAbort(error)) throw error
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Magpie Web trace is unavailable')
}

/** The Routing page URL from the configured API root; no Web Key in the link. */
function routingUrlFor(base: string): string {
  return `${base.replace(/\/+$/, '')}/?view=routing`
}

/** Fetch one binary asset from Magpie Web, carrying its port-scoped Web cookie. */
async function fetchWebBinary(base: string, webKey: string, path: string, signal: AbortSignal): Promise<{ body: ArrayBuffer; contentType: string }> {
  const url = new URL(base)
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  const response = await fetch(`${base}${path}`, {
    headers: { cookie: `magpie_web_${port}=${webKey}`, accept: 'image/svg+xml,image/png,*/*' },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) {
    const error = new Error(`Magpie Web HTTP ${response.status} ${path}`) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get('content-type') ?? 'image/svg+xml',
  }
}

/** Magpie's png icon names; all other built-in icons are SVG. */
const PNG_ICONS = new Set([
  'crush', 'zcode', 'alma', 'hanako', 'cindy', 'lody', 'typesafe', 'atomcode',
  'snow', 'mlx-serve', 'mothx', 'zoo-code', 'kimi-code-desktop',
])

/**
 * Read one provider icon from Magpie Web through the stored Web Key. The
 * browser asks the plugin's same-origin `/api/magpie-icon` route instead of
 * loading a cross-origin image that would miss the Web cookie.
 */
export async function fetchWebIcon(
  base: string,
  webKey: string,
  name: string,
  signal: AbortSignal,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const safe = /^[A-Za-z0-9._~-]+$/.test(name) && !name.includes('..') ? name : 'generic'
  if (safe === 'generic') throw new Error('Magpie Web icon name is invalid')
  const ext = PNG_ICONS.has(safe) ? 'png' : 'svg'
  const path = `/icons/${safe}.${ext}`
  let lastError: unknown
  for (const candidate of webBases(base)) {
    try {
      return await fetchWebBinary(candidate, webKey, path, signal)
    } catch (error) {
      if (isAbort(error)) throw error
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Magpie Web icon is unavailable')
}

/** Fetch one gateway endpoint, mapping failures onto the shared status kind. */
async function fetchJson(base: string, apiKey: string, path: string, signal: AbortSignal): Promise<LooseRecord> {
  const response = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} ${path}`) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
  return (await response.json()) as LooseRecord
}

/**
 * Project one ledger row onto the wire shape. `req` is the routing group or
 * model the agent asked for (`auto/gpt-6-luna`), `served` the model that
 * answered; when they agree one name is enough, so the row stays one line.
 */
function toRequestRow(row: LooseRecord): TraceRequestRow | undefined {
  const id = num(row, 'route_id')
  const time = str(row, 't')
  if (id === undefined || time === undefined) return undefined
  const requested = str(row, 'req')
  const served = str(row, 'served')
  const provider = str(row, 'providerName')
  const account = str(row, 'providerAccount')
  const ms = num(row, 'ms')
  const ttftMs = num(row, 'ttft_ms')
  const status = num(row, 'status')
  const cost = num(row, 'cost')
  return {
    id,
    time,
    agent: str(row, 'agentName') ?? str(row, 'agent') ?? '?',
    ...(requested !== undefined ? { requested } : {}),
    ...(served !== undefined && served !== requested ? { served } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(account !== undefined ? { account } : {}),
    ...(ms !== undefined ? { ms } : {}),
    ...(ttftMs !== undefined ? { ttftMs } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(row.canceled === true ? { canceled: true } : {}),
    ...(cost !== undefined && cost !== 0 ? { cost } : {}),
  }
}

/**
 * Mask one account holder for the wire: keep the name's head, drop anything
 * mail- or phone-shaped. The gateway's own masking already runs when the
 * user turned it on; this is the popover's second line of defense, so a
 * full address never reaches the browser's DOM.
 */
function maskHolder(user: string | undefined): string | undefined {
  if (user === undefined) return undefined
  const at = user.indexOf('@')
  if (at <= 0) return user
  const head = user.slice(0, Math.max(1, Math.min(at, 4)))
  return `${head}…`
}

/**
 * The quota window the popover shows for one account: the first window with
 * a usable share (a `used` percent, or an amount/limit pair), falling back
 * to the first one that names its reset date.
 */
function pickWindow(windows: LooseRecord[]): LooseRecord | undefined {
  return (
    windows.find((entry) => num(entry, 'used') !== undefined || pctOfParts(entry) !== undefined) ??
    windows.find((entry) => str(entry, 'resetsAt') !== undefined) ??
    windows[0]
  )
}

/** Project one quota account onto the wire shape. */
function toAccountRow(account: LooseRecord): TraceAccountRow | undefined {
  const provider = str(account, 'name') ?? str(account, 'provider')
  if (provider === undefined) return undefined
  const user = maskHolder(str(account, 'user'))
  const base: TraceAccountRow = {
    provider,
    ...(str(account, 'provider') !== undefined ? { providerId: str(account, 'provider') } : {}),
    ...(str(account, 'plan') !== undefined ? { plan: str(account, 'plan') } : {}),
    ...(user !== undefined ? { user } : {}),
    ...(str(account, 'error') !== undefined ? { error: str(account, 'error') } : {}),
  }
  const windows = Array.isArray(account.windows) ? (account.windows as LooseRecord[]) : []
  const window = pickWindow(windows)
  if (window === undefined) return base
  const usedPct = pctOf(window.used) ?? pctOfParts(window)
  const windowName = str(window, 'name')
  const display = str(window, 'display')
  const resetsAt = str(window, 'resetsAt')
  const amount = num(window, 'amount')
  const limit = num(window, 'limit')
  const unit = str(window, 'unit')
  return {
    ...base,
    ...(windowName !== undefined ? { windowName } : {}),
    ...(usedPct !== undefined ? { usedPct } : {}),
    ...(display !== undefined ? { display } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(unit !== undefined ? { unit } : {}),
    ...(resetsAt !== undefined ? { resetsAt } : {}),
  }
}

/**
 * Project one in-flight request (`/v1/magpie/concurrency`'s `active`) onto
 * the wire shape, and mark the popover's own session's row so the client can
 * pin it to the top.
 */
function toActiveRow(entry: LooseRecord, session: string | undefined): ActiveRequestRow | undefined {
  const ms = num(entry, 'ms')
  if (ms === undefined) return undefined
  const rowSession = str(entry, 'session')
  const agent = str(entry, 'agent')
  const model = str(entry, 'model')
  const provider = str(entry, 'provider')
  const phase = str(entry, 'phase')
  return {
    ...(agent !== undefined ? { agent } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(rowSession !== undefined ? { session: rowSession } : {}),
    ms,
    ...(phase !== undefined ? { phase } : {}),
    ...(session !== undefined && rowSession !== undefined && rowSession === session ? { own: true } : {}),
  }
}

/** The whole-gateway concurrency summary, for the header line. */
function toConcurrency(data: LooseRecord): { requests: number; waiting: number; tools: number } {
  return {
    requests: num(data, 'requests') ?? 0,
    waiting: num(data, 'waiting') ?? 0,
    tools: num(data, 'tools') ?? 0,
  }
}

/** Project Magpie's Weighed or Try record onto a compact candidate. */
function toTraceCandidate(
  entry: LooseRecord,
  outcome: TraceCandidate['outcome'],
  restOverride?: TraceRest,
): TraceCandidate | undefined {
  const id = str(entry, 'id')
  const provider = str(entry, 'provider')
  if (id === undefined || provider === undefined) return undefined
  const used = num(entry, 'used')
  const renews = Array.isArray(entry.renews)
    ? (entry.renews as unknown[]).filter((value): value is string => typeof value === 'string')
    : []
  const via = Array.isArray(entry.via)
    ? (entry.via as unknown[]).filter((value): value is string => typeof value === 'string' && value !== '')
    : []
  const amount = num(entry, 'amount')
  const limit = num(entry, 'limit')
  const restRaw = restOverride ?? (entry.rest && typeof entry.rest === 'object' ? entry.rest as TraceRest : undefined)
  const status = num(entry, 'status')
  const ms = num(entry, 'ms')
  return {
    id,
    provider,
    ...(str(entry, 'kind') !== undefined ? { kind: str(entry, 'kind') } : {}),
    ...(str(entry, 'name') !== undefined ? { name: str(entry, 'name') } : {}),
    ...(str(entry, 'who') !== undefined ? { who: maskHolder(str(entry, 'who')) } : {}),
    ...(str(entry, 'icon') !== undefined ? { icon: str(entry, 'icon') } : {}),
    ...(str(entry, 'preset') !== undefined ? { preset: str(entry, 'preset') } : {}),
    ...(str(entry, 'plan') !== undefined ? { plan: str(entry, 'plan') } : {}),
    ...(str(entry, 'model') !== undefined ? { model: str(entry, 'model') } : {}),
    ...(str(entry, 'fixed') !== undefined ? { fixed: str(entry, 'fixed') } : {}),
    ...(via.length > 0 ? { via } : {}),
    ...(used !== undefined ? { usedPct: pctOf(used) } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(str(entry, 'unit') !== undefined ? { unit: str(entry, 'unit') } : {}),
    ...(renews.length > 0 ? { renews } : {}),
    ...(restRaw !== undefined ? { rest: restRaw } : {}),
    outcome,
    ...(status !== undefined ? { status } : {}),
    ...(str(entry, 'fail') !== undefined ? { fail: str(entry, 'fail') } : {}),
    ...(str(entry, 'error') !== undefined ? { error: str(entry, 'error') } : {}),
    ...(ms !== undefined ? { ms } : {}),
    ...(str(entry, 'leftWhy') !== undefined ? { skipReason: str(entry, 'leftWhy') } : {}),
    ...(entry.fallback === true ? { fallback: true } : {}),
    ...(entry.free === true ? { free: true } : {}),
    ...(num(entry, 'capped') !== undefined ? { capped: num(entry, 'capped') } : {}),
    ...(entry.held === true ? { held: true } : {}),
    ...(str(entry, 'heldBy') !== undefined ? { heldBy: str(entry, 'heldBy') } : {}),
    ...(entry.unlisted === true ? { unlisted: true } : {}),
    ...(entry.barred === true ? { barred: true } : {}),
    ...(entry.noCredits === true ? { noCredits: true } : {}),
    ...(str(entry, 'unread') !== undefined ? { unread: str(entry, 'unread') } : {}),
    ...(str(entry, 'noURL') !== undefined ? { noURL: str(entry, 'noURL') } : {}),
    ...(num(entry, 'window') !== undefined ? { window: num(entry, 'window') } : {}),
  }
}

/**
 * Compress the session's full route row from `/api/gateway/trace` and enrich
 * its candidates with quota errors where possible. The route itself carries
 * `Rest`, provider/account identity, order/left and each try's failure.
 */
function toSessionTrace(route: LooseRecord, accounts: readonly TraceAccountRow[]): SessionTraceView | undefined {
  const id = num(route, 'id')
  const model = str(route, 'model')
  if (id === undefined || model === undefined) return undefined
  const orderRaw = Array.isArray(route.order) ? route.order as LooseRecord[] : []
  const leftRaw = Array.isArray(route.left) ? route.left as LooseRecord[] : []
  const triesRaw = Array.isArray(route.tries) ? route.tries as LooseRecord[] : []
  const groupRaw = route.group !== null && typeof route.group === 'object' ? route.group as LooseRecord : undefined
  const groupMembers = groupRaw !== undefined && Array.isArray(groupRaw.members)
    ? (groupRaw.members as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  const groupVia = groupRaw !== undefined && Array.isArray(groupRaw.via)
    ? (groupRaw.via as unknown[]).map((x) => typeof x === 'string' ? x : '')
    : []
  const subsRaw = groupRaw !== undefined && Array.isArray(groupRaw.subs)
    ? groupRaw.subs as LooseRecord[]
    : []
  const subs: TraceSubGroup[] = subsRaw
    .filter((entry) => str(entry, 'id') !== undefined)
    .map((entry) => ({
      id: str(entry, 'id') ?? '',
      name: str(entry, 'name') ?? str(entry, 'id') ?? '',
      ...(str(entry, 'ref') !== undefined ? { ref: str(entry, 'ref') } : {}),
      ...(str(entry, 'routing') !== undefined ? { routing: str(entry, 'routing') } : {}),
    }))
  const group: TraceGroup | undefined = groupRaw !== undefined && str(groupRaw, 'id') !== undefined
    ? {
        id: str(groupRaw, 'id') ?? '',
        name: str(groupRaw, 'name') ?? str(groupRaw, 'id') ?? '',
        ...(str(groupRaw, 'ref') !== undefined ? { ref: str(groupRaw, 'ref') } : {}),
        ...(str(groupRaw, 'routing') !== undefined ? { routing: str(groupRaw, 'routing') } : {}),
        ...(groupMembers.length > 0 ? { members: groupMembers } : {}),
        ...(subs.length > 0 ? { subs } : {}),
        ...(groupVia.length > 0 ? { via: groupVia } : {}),
      }
    : undefined
  /**
   * The inner subgroup a candidate belongs to. Magpie puts the path on
   * `Weighed.via`, and also supplies `GroupRef.via` parallel to `members`.
   * A blank via is a direct member of the parent group — it must stay a
   * sibling of the nested routing groups, not inherit a previous subgroup.
   */
  const subgroupFor = (entry: LooseRecord): string => {
    const own = Array.isArray(entry.via)
      ? (entry.via as unknown[]).filter((x): x is string => typeof x === 'string' && x !== '')
      : []
    if (own.length > 0) return own[own.length - 1] ?? ''
    const provider = str(entry, 'provider') ?? ''
    const member = str(entry, 'model') ?? ''
    const fixed = str(entry, 'fixed')
    if (provider === '' || member === '') return ''
    const ref = `${provider}/${member}${fixed !== undefined ? `:${fixed}` : ''}`
    const idx = groupMembers.findIndex((x) => x === ref || x === `${provider}/${member}`)
    if (idx < 0) return ''
    const path = (groupVia[idx] ?? '').split('>').filter(Boolean)
    return path[path.length - 1] ?? ''
  }
  const seatKey = (entry: LooseRecord): string =>
    `${str(entry, 'id') ?? ''}\u0000${str(entry, 'model') ?? ''}\u0000${str(entry, 'fixed') ?? ''}`
  const triesBySeat = new Map<string, LooseRecord>()
  for (const tried of triesRaw) if (str(tried, 'id') !== undefined) triesBySeat.set(seatKey(tried), tried)
  const candidate = (entry: LooseRecord, kind: TraceCandidate['outcome']): TraceCandidate | undefined => {
    const tried = triesBySeat.get(seatKey(entry))
    const quota = accounts.find((account) =>
      account.providerId === str(entry, 'provider') &&
      ((account.user ?? '').toLowerCase() === maskHolder(str(entry, 'who'))?.toLowerCase() || account.user === undefined),
    )
    const quotaEnrichment: LooseRecord = {
      ...(quota?.usedPct !== undefined && num(entry, 'used') === undefined ? { used: quota.usedPct } : {}),
      ...(quota?.resetsAt !== undefined && !Array.isArray(entry.renews) ? { renews: [quota.resetsAt] } : {}),
      ...(quota?.amount !== undefined ? { amount: quota.amount } : {}),
      ...(quota?.limit !== undefined ? { limit: quota.limit } : {}),
      ...(quota?.unit !== undefined ? { unit: quota.unit } : {}),
    }
    const row = toTraceCandidate({ ...entry, ...quotaEnrichment }, kind, tried?.rest as TraceRest | undefined)
    if (row === undefined) return undefined
    const rest = tried?.rest ?? entry.rest
    const restValue = rest !== null && typeof rest === 'object' ? rest as LooseRecord : undefined
    const outcome: TraceCandidate['outcome'] = restValue !== undefined ? 'resting' : kind
    return {
      ...row,
      outcome,
      subgroup: subgroupFor(entry),
      ...(quota?.error !== undefined && row.error === undefined ? { error: quota.error } : {}),
      ...(restValue !== undefined ? { rest: {
        ...(str(restValue, 'why') !== undefined ? { why: str(restValue, 'why') } : {}),
        ...(num(restValue, 'status') !== undefined ? { status: num(restValue, 'status') } : {}),
        ...(str(restValue, 'until') !== undefined ? { until: str(restValue, 'until') } : {}),
        ...(str(restValue, 'by') !== undefined ? { by: str(restValue, 'by') } : {}),
        ...(num(restValue, 'failures') !== undefined ? { failures: num(restValue, 'failures') } : {}),
        ...(str(restValue, 'model') !== undefined ? { model: str(restValue, 'model') } : {}),
        ...(str(restValue, 'error') !== undefined ? { error: str(restValue, 'error') } : {}),
        ...(restValue.rate === true ? { rate: true } : {}),
      } } : {}),
    }
  }
  const orderSeats = new Set(orderRaw.map(seatKey))
  const orderCandidates = orderRaw.map((entry) => {
    const tried = triesBySeat.get(seatKey(entry))
    const done = tried?.done === true
    const status = num(tried ?? entry, 'status')
    const rest = tried?.rest ?? entry.rest
    const outcome: TraceCandidate['outcome'] = rest !== undefined && rest !== null ? 'resting'
      : tried === undefined ? 'available'
        : done ? (status !== undefined && status >= 200 && status < 400 ? 'answered' : 'failed')
          : 'processing'
    return candidate({ ...entry, ...(tried ?? {}), ...(status !== undefined ? { status } : {}) }, outcome)
  }).filter((value): value is TraceCandidate => value !== undefined)
  const tries = triesRaw.map((entry) => {
    const ordered = orderRaw.find((candidate) => seatKey(candidate) === seatKey(entry))
    const enriched = ordered !== undefined ? { ...ordered, ...entry } : entry
    const done = entry.done === true
    const status = num(entry, 'status')
    const rest = entry.rest ?? ordered?.rest
    const outcome: TraceCandidate['outcome'] = rest !== undefined && rest !== null ? 'resting'
      : done ? (status !== undefined && status >= 200 && status < 400 ? 'answered' : 'failed')
      : 'processing'
    return candidate(enriched, outcome)
  }).filter((value): value is TraceCandidate => value !== undefined)
  const left = leftRaw
    .filter((entry) => !orderSeats.has(seatKey(entry)))
    .map((entry) => {
      const skipReason = str(entry, 'leftWhy') ?? str(entry, 'heldBy')
        ?? (entry.held === true ? 'held' : entry.noCredits === true ? 'credits' : entry.unlisted === true ? 'unlisted' : entry.barred === true ? 'barred' : '')
      return candidate({ ...entry, ...(skipReason !== '' ? { leftWhy: skipReason } : {}) }, 'skipped')
    })
    .filter((value): value is TraceCandidate => value !== undefined)
  const allCandidates = [...orderCandidates, ...left]
  const bySubgroup = new Map<string, TraceCandidate[]>()
  const orderedKeys: string[] = []
  for (const row of allCandidates) {
    const key = row.subgroup ?? ''
    if (!bySubgroup.has(key)) orderedKeys.push(key)
    const list = bySubgroup.get(key) ?? []
    list.push(row)
    bySubgroup.set(key, list)
  }
  const sections: TraceRoutingSection[] = []
  for (const key of orderedKeys) {
    const rows = bySubgroup.get(key) ?? []
    if (rows.length === 0) continue
    if (key === '') {
      // Direct members of the parent routing group are siblings of nested
      // routing-group headings. Never fold them into the previous auto/* group.
      sections.push({
        name: group?.name ?? model,
        ref: group?.ref ?? model,
        ...(group?.routing !== undefined ? { routing: group.routing } : {}),
        depth: 0,
        hideHeader: subs.length > 0,
        candidates: rows.slice(0, 8),
      })
      continue
    }
    const sub = subs.find((entry) => entry.id === key)
    sections.push({
      name: sub?.name ?? key,
      ref: sub?.ref ?? `group/${key}`,
      ...(sub?.routing !== undefined ? { routing: sub.routing } : {}),
      depth: 1,
      candidates: rows.slice(0, 8),
    })
  }
  if (sections.length === 0) {
    sections.push({
      name: group?.name ?? model,
      ref: group?.ref ?? model,
      ...(group?.routing !== undefined ? { routing: group.routing } : {}),
      depth: 0,
      candidates: allCandidates.slice(0, 8),
    })
  }
  const ms = num(route, 'ms')
  const ttftMs = num(route, 'ttft')
  const status = num(route, 'status')
  return {
    id,
    ...(str(route, 'time') !== undefined ? { time: str(route, 'time') } : {}),
    model,
    ...(group !== undefined ? { group } : {}),
    ...(sections.length > 0 ? { sections } : {}),
    order: orderCandidates,
    left,
    tries,
    done: route.done === true,
    ...(status !== undefined ? { status } : {}),
    ...(str(route, 'error') !== undefined ? { error: str(route, 'error') } : {}),
    ...(ms !== undefined ? { ms } : {}),
    ...(ttftMs !== undefined ? { ttftMs } : {}),
  }
}

/** Whether one of the two fetches failed with a fetch-level error record. */
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/**
 * Project one session route (`/v1/magpie/route`) onto the wire shape. The
 * gateway returns `{"route":null}` for a session it has not routed yet, so
 * absence maps to `undefined`, not an empty object.
 */
function toSessionRoute(data: LooseRecord): SessionRouteView | undefined {
  const route = data.route
  if (route === null || route === undefined || typeof route !== 'object') return undefined
  const record = route as LooseRecord
  const triesRaw = Array.isArray(record.tries) ? (record.tries as LooseRecord[]) : []
  const tries: SessionRouteTry[] = triesRaw.map((entry) => {
    const ms = num(entry, 'ms')
    const status = num(entry, 'status')
    return {
      ...(str(entry, 'model') !== undefined ? { model: str(entry, 'model') } : {}),
      ...(entry.done === true ? { done: true } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(ms !== undefined ? { ms } : {}),
      ...(str(entry, 'fail') !== undefined ? { fail: str(entry, 'fail') } : {}),
    }
  })
  const ms = num(record, 'ms')
  const ttftMs = num(record, 'ttft_ms')
  const status = num(record, 'status')
  const seq = num(data, 'seq')
  return {
    ...(str(record, 'time') !== undefined ? { time: str(record, 'time') } : {}),
    ...(str(record, 'asked') !== undefined ? { asked: str(record, 'asked') } : {}),
    ...(str(record, 'model') !== undefined ? { model: str(record, 'model') } : {}),
    ...(str(record, 'served') !== undefined ? { served: str(record, 'served') } : {}),
    ...(str(record, 'group') !== undefined ? { group: str(record, 'group') } : {}),
    ...(tries.length > 0 ? { tries } : {}),
    ...(record.done === true ? { done: true } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(ms !== undefined ? { ms } : {}),
    ...(ttftMs !== undefined ? { ttftMs } : {}),
    ...(str(record, 'error') !== undefined ? { error: str(record, 'error') } : {}),
    ...(seq !== undefined ? { seq } : {}),
  }
}

/**
 * Fetch the full Web trace when a Web Key is configured, then add quotas;
 * otherwise fall back to the gateway-key-only ledger/concurrency view. The
 * session route is a final fallback if the full trace is unavailable.
 * A full-trace auth failure is shown beside the fallback data rather than
 * hiding the gateway-key view: the Web Key is optional and can be stale.
 * @param endpoint - effective API endpoint (page settings over patch config).
 * @param signal - caller lifetime; the popover aborts on close.
 * @param session - DSH session id to find its route in the full trace.
 * @param webKey - optional Magpie Web Key, stored server-side only.
 * @returns the compressed view, always with a status.
 */
export async function fetchTraceView(endpoint: EffectiveEndpoint, signal: AbortSignal, session?: string, webKey?: string): Promise<TraceView> {
  const fetchedAt = new Date().toISOString()
  let base: string | undefined
  try {
    base = deriveGatewayBase(normalizeBaseUrl(endpoint.baseUrl))
  } catch {
    base = undefined
  }
  const defaultRoutingUrl = base !== undefined && base !== '' ? routingUrlFor(base) : undefined
  if (!isConfigured(endpoint)) return { status: 'unconfigured', fetchedAt, ...(defaultRoutingUrl !== undefined ? { routingUrl: defaultRoutingUrl } : {}) }
  if (base === undefined || base === '') return { status: 'unconfigured', fetchedAt, ...(defaultRoutingUrl !== undefined ? { routingUrl: defaultRoutingUrl } : {}) }
  const key = endpoint.apiKey
  const fullWebTrace = webKey !== undefined && webKey.trim() !== ''
    ? fetchFullWebTrace(base, webKey.trim(), signal)
        .then((out) => ({ data: out.trace, base: out.base }))
        .catch((error: unknown) => ({ error }))
    : Promise.resolve(undefined)

  const usage = fetchJson(base, key, `/v1/magpie/usage/requests?limit=${TRACE_REQUEST_ROWS}&period=${LEDGER_PERIOD}`, signal)
    .then((data) => ({ data }))
    .catch((error: unknown) => ({ error }))
  const quotas = fetchJson(base, key, '/v1/magpie/quotas', signal)
    .then((data) => ({ data }))
    .catch((error: unknown) => ({ error }))
  const concurrency = fetchJson(base, key, '/v1/magpie/concurrency', signal)
    .then((data) => ({ data }))
    .catch((error: unknown) => ({ error }))
  const sessionRoute = session !== undefined && session !== ''
    ? fetchJson(base, key, `/v1/magpie/route?session=${encodeURIComponent(session)}`, signal)
        .then((data) => ({ data }))
        .catch((error: unknown) => ({ error }))
    : Promise.resolve(undefined)
  const [usageOut, quotasOut, concurrencyOut, routeOut, fullTraceOut] = await Promise.all([usage, quotas, concurrency, sessionRoute, fullWebTrace])

  const usageFailed = 'error' in usageOut
  const quotasFailed = 'error' in quotasOut
  if (usageFailed && quotasFailed) {
    // Both halves failed: one status kind, never a throw. An aborted popover
    // is not a failure worth a message — the caller is gone.
    const errors: unknown[] = [usageOut.error, quotasOut.error]
    if (errors.some(isAbort)) return { status: 'network', message: 'aborted', fetchedAt }
    const first = errors[0] as (Error & { statusCode?: number }) | undefined
    const kind = first !== undefined && typeof first.statusCode === 'number'
      ? statusForStatusCode(first.statusCode)
      : (first instanceof TypeError ? 'network' : 'unknown')
    return { status: kind, message: first instanceof Error ? first.message : undefined, fetchedAt }
  }

  const usageData = usageFailed ? {} : (usageOut.data as LooseRecord)
  const quotasData = quotasFailed ? {} : (quotasOut.data as LooseRecord)
  const concurrencyData = 'error' in concurrencyOut ? undefined : (concurrencyOut.data as LooseRecord)

  const totals: TraceTotals = {
    requests: num(usageData, 'calls') ?? 0,
    errors: num(usageData, 'errors') ?? 0,
    retried: num(usageData, 'retried') ?? 0,
    canceled: num(usageData, 'canceled') ?? 0,
    ...(num(usageData, 'credits') !== undefined ? { credits: num(usageData, 'credits') } : {}),
  }
  const rows = Array.isArray(usageData.rows) ? (usageData.rows as LooseRecord[]) : []
  const requests = rows.map(toRequestRow).filter((row): row is TraceRequestRow => row !== undefined)
  const accountsRaw = Array.isArray(quotasData.data) ? (quotasData.data as LooseRecord[]) : []
  const accounts = accountsRaw
    .map(toAccountRow)
    .filter((row): row is TraceAccountRow => row !== undefined)
    .slice(0, TRACE_ACCOUNT_ROWS)
  const activeRaw = concurrencyData !== undefined && Array.isArray(concurrencyData.active)
    ? (concurrencyData.active as LooseRecord[])
    : []
  // The popover's own session's request first, then the longest-running.
  const active = activeRaw
    .map((entry) => toActiveRow(entry, session))
    .filter((row): row is ActiveRequestRow => row !== undefined)
    .sort((a, b) => (b.own === true ? 1 : 0) - (a.own === true ? 1 : 0) || b.ms - a.ms)
    .slice(0, TRACE_ACTIVE_ROWS)

  const fullTraceData = fullTraceOut !== undefined && 'data' in fullTraceOut
    ? fullTraceOut.data as LooseRecord
    : undefined
  const routingUrl = defaultRoutingUrl
  const fullRoutes = fullTraceData !== undefined && Array.isArray(fullTraceData.routes)
    ? fullTraceData.routes as LooseRecord[]
    : []
  // Prefer the addressed session's own latest route. With no session — or a
  // session the gateway never routed — fall back to the newest route in the
  // whole trace, so the popover still shows the latest overall routing.
  const matched = session !== undefined
    ? [...fullRoutes].reverse().find((route) => str(route, 'session') === session)
    : undefined
  const matchedRoute = matched ?? (fullRoutes.length > 0 ? fullRoutes[fullRoutes.length - 1] : undefined)
  const sessionTrace = matchedRoute !== undefined ? toSessionTrace(matchedRoute, accounts) : undefined
  const traceFailure = fullTraceOut !== undefined && 'error' in fullTraceOut ? fullTraceOut.error : undefined
  const webTraceError: TraceView['webTraceError'] = webKey === undefined || webKey.trim() === ''
    ? 'missing-key'
    : traceFailure !== undefined
      ? (Number((traceFailure as Error & { statusCode?: number })?.statusCode) === 401 ? 'unauthorized'
        : Number((traceFailure as Error & { statusCode?: number })?.statusCode) === 403 ? 'forbidden' : 'unavailable')
      : undefined

  return {
    status: 'ok',
    fetchedAt,
    routingUrl,
    totals,
    ...(webTraceError !== undefined ? { webTraceError } : {}),
    ...(traceFailure instanceof Error ? { webTraceMessage: traceFailure.message } : {}),
    ...(requests.length > 0 ? { requests } : {}),
    ...(accounts.length > 0 ? { accounts } : {}),
    ...(concurrencyData !== undefined ? { concurrency: toConcurrency(concurrencyData) } : {}),
    ...(active.length > 0 ? { active } : {}),
    ...((routeOut !== undefined && 'data' in routeOut)
      ? { sessionRoute: toSessionRoute((routeOut as { data: LooseRecord }).data) }
      : {}),
    ...(sessionTrace !== undefined ? { sessionTrace } : {}),
  }
}

/** Narrow an unknown value onto the wire status list (client decode). */
export function asTraceStatus(value: unknown): TraceStatus {
  return STATUS_KINDS.includes(value as TraceStatus) ? (value as TraceStatus) : 'unknown'
}
