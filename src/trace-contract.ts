/**
 * The routing-trace wire contract, shared by the host fetcher (`trace.ts`)
 * and the composer button (`client/trace-button.tsx`). Types only — the
 * client bundle imports them with `import type`, so no Host module ever
 * ships to the browser.
 *
 * The host compresses two gateway endpoints into this one small view:
 *
 * - `GET {gateway}/v1/magpie/usage/requests?limit=N&period=today` — the
 *   request ledger the Routing page draws (newest first), plus the caller
 *   key's totals for the period. Needs the gateway key; reaches another
 *   machine only while Magpie shares on the local network.
 * - `GET {gateway}/v1/magpie/quotas` — every account's allowance windows
 *   (used %, reset time), the account half of the same page.
 *
 * `{gateway}` is the configured API base with its version segment (`/v1`)
 * removed, exactly as the routing popover contract states.
 */

/** How the last fetch ended; drives the popover's hint row. */
export type TraceStatus = 'ok' | 'unconfigured' | 'unauthorized' | 'forbidden' | 'network' | 'unknown'

/** One recent request as the popover's top half shows it. */
export interface TraceRequestRow {
  /** The gateway's route id (stable row key). */
  readonly id: number
  /** When the request was recorded (RFC 3339). */
  readonly time: string
  /** The agent that sent it, as the ledger names it. */
  readonly agent: string
  /** The model (or routing group) the agent asked for; absent when none. */
  readonly requested?: string
  /** The model the reply said answered. */
  readonly served?: string
  /** The provider that took the request. */
  readonly provider?: string
  /** The provider account that served it. */
  readonly account?: string
  /** Total milliseconds, when the request is done. */
  readonly ms?: number
  /** Milliseconds to the first content. */
  readonly ttftMs?: number
  /** HTTP status the agent saw. */
  readonly status?: number
  /** The agent canceled the request before it was answered. */
  readonly canceled?: boolean
  /** What the request cost, when priced. */
  readonly cost?: number
}

/** One account's allowance, as the popover's bottom half shows it. */
export interface TraceAccountRow {
  readonly provider: string
  /** Stable provider id for matching a quota error to a trace candidate. */
  readonly providerId?: string
  /** The plan the account is on ('free', 'Pro', …). */
  readonly plan?: string
  /** The account holder, as the gateway names it (already masked when masking is on). */
  readonly user?: string
  /** The allowance window the numbers are of. */
  readonly windowName?: string
  /** Share of the allowance used, 0–100 rounded. */
  readonly usedPct?: number
  /** The gateway's own display of the counter ("346.47 / 350"), when it has one. */
  readonly display?: string
  /** Raw amount/limit/unit behind the display, when the window names them. */
  readonly amount?: number
  readonly limit?: number
  readonly unit?: string
  /** When the window resets (RFC 3339). */
  readonly resetsAt?: string
  /** Why the account cannot serve right now (e.g. an expired sign-in). */
  readonly error?: string
}

/** The period totals the header line shows. */
export interface TraceTotals {
  readonly requests: number
  readonly errors: number
  readonly retried: number
  readonly canceled: number
  /** What the period cost in plan credits, when the gateway counts them. */
  readonly credits?: number
}

/** A rest on a route candidate (`Rest` in Magpie's trace). */
export interface TraceRest {
  readonly why?: string
  readonly status?: number
  readonly until?: string
  readonly by?: string
  readonly failures?: number
  readonly model?: string
  readonly error?: string
  readonly rate?: boolean
}

/** A candidate account/member in this session's full routing decision. */
export interface TraceCandidate {
  readonly id: string
  readonly provider: string
  readonly kind?: string
  readonly name?: string
  readonly who?: string
  readonly icon?: string
  readonly preset?: string
  readonly plan?: string
  readonly model?: string
  readonly fixed?: string
  /** Nested routing-group path (outermost first), from Magpie's Weighed.via. */
  readonly via?: readonly string[]
  /** Innermost subgroup id, computed on the Host for compact grouping. */
  readonly subgroup?: string
  readonly usedPct?: number
  readonly amount?: number
  readonly limit?: number
  readonly unit?: string
  /** The allowance window the numbers are of ("Total credits", "Extra credits"). */
  readonly windowName?: string
  readonly renews?: readonly string[]
  readonly rest?: TraceRest
  readonly outcome: 'processing' | 'answered' | 'failed' | 'resting' | 'skipped' | 'available'
  readonly status?: number
  readonly fail?: string
  readonly error?: string
  readonly ms?: number
  readonly skipReason?: string
  readonly fallback?: boolean
  readonly free?: boolean
  readonly capped?: number
  readonly held?: boolean
  readonly heldBy?: string
  readonly unlisted?: boolean
  readonly barred?: boolean
  readonly noCredits?: boolean
  readonly unread?: string
  readonly noURL?: string
  readonly window?: number
}

/** A nested routing group inside the route's group (`GroupRef.subs`). */
export interface TraceSubGroup {
  readonly id: string
  readonly name: string
  readonly ref?: string
  readonly routing?: string
}

/** Routing group heading from the trace (`group` on a route). */
export interface TraceGroup {
  readonly id: string
  readonly name: string
  readonly ref?: string
  readonly routing?: string
  readonly members?: readonly string[]
  /** Nested groups in the group's way down. */
  readonly subs?: readonly TraceSubGroup[]
  /** Parallel to members: each member's subgroup path, "" for direct. */
  readonly via?: readonly string[]
}

/** One rendered routing-group card in the compact popover. */
export interface TraceRoutingSection {
  readonly name: string
  readonly ref: string
  readonly routing?: string
  /** Nesting depth: 0 is a parent-level section, 1 is a nested routing group. */
  readonly depth?: number
  /** Render candidates without a group header: parent-level direct models. */
  readonly hideHeader?: boolean
  readonly candidates: readonly TraceCandidate[]
}

/** The whole compressed view one popover fetch answers with. */
export interface TraceView {
  readonly status: TraceStatus
  /** Failure detail for the hint row; English, host-side. */
  readonly message?: string
  readonly totals?: TraceTotals
  readonly requests?: readonly TraceRequestRow[]
  readonly accounts?: readonly TraceAccountRow[]
  /**
   * The addressed session's latest routed request (`/v1/magpie/route`),
   * present only when the caller named a session and the gateway has routed
   * one for it. Absent (not null) when the gateway doesn't know the session.
   */
  readonly sessionRoute?: SessionRouteView
  /**
   * The trace row the popover renders: the addressed session's own latest
   * route when one is named and routed, otherwise the newest route in the
   * whole trace (the latest overall routing). Absent only when the Web trace
   * could not be loaded at all.
   */
  readonly sessionTrace?: SessionTraceView
  /** A link to the Magpie Web Routing page, derived by the Host (Web Key stays server-side). */
  readonly routingUrl?: string
  /** Why the screenshot-style full Web trace could not be loaded. */
  readonly webTraceError?: 'missing-key' | 'unauthorized' | 'forbidden' | 'unavailable'
  readonly webTraceMessage?: string
  /** The gateway's requests in flight right now (`/v1/magpie/concurrency`). */
  readonly active?: readonly ActiveRequestRow[]
  /** Whole-gateway in-flight count, waiting count and parked tool turns. */
  readonly concurrency?: { readonly requests: number; readonly waiting: number; readonly tools: number }
  /** When the host gathered this view (RFC 3339). */
  readonly fetchedAt: string
}

/** One request the gateway is serving right now. */
export interface ActiveRequestRow {
  /** The agent that asked. */
  readonly agent?: string
  /** The model it was routed to (once routing picked one). */
  readonly model?: string
  /** The provider serving it. */
  readonly provider?: string
  /** The session id it carries, when the client sent one. */
  readonly session?: string
  /** How long it has been in flight (ms, live). */
  readonly ms: number
  /** Where it stands: `slot`, `rpm`, `upstream`, `redact` — the gateway's own phase words. */
  readonly phase?: string
  /** True when this row is the popover's own session's request. */
  readonly own?: boolean
}

/** One try (account attempt) of the session's latest route. */
export interface SessionRouteTry {
  /** The model this try asked for, provider-prefixed. */
  readonly model?: string
  readonly done?: boolean
  readonly status?: number
  readonly ms?: number
  /** Why it failed, as the gateway words it. */
  readonly fail?: string
}

/** The session's latest routed request (`/v1/magpie/route?session=`). */
export interface SessionTraceView {
  readonly id: number
  readonly time?: string
  readonly model: string
  readonly group?: TraceGroup
  /** Group cards to render; when absent the whole trace is one section. */
  readonly sections?: readonly TraceRoutingSection[]
  readonly order: readonly TraceCandidate[]
  readonly left: readonly TraceCandidate[]
  readonly tries: readonly TraceCandidate[]
  readonly done: boolean
  readonly status?: number
  readonly error?: string
  readonly ms?: number
  readonly ttftMs?: number
}

/** The session's latest routed request (`/v1/magpie/route?session=`). */
export interface SessionRouteView {
  /** When the request was recorded (RFC 3339). */
  readonly time?: string
  /** The model (or routing group) the session asked for. */
  readonly asked?: string
  /** The model the last try went out at, provider-prefixed. */
  readonly model?: string
  /** The model the reply said answered. */
  readonly served?: string
  /** The routing group the session asked for, when it asked one. */
  readonly group?: string
  /** Every account attempt, in order. */
  readonly tries?: readonly SessionRouteTry[]
  readonly done?: boolean
  readonly status?: number
  readonly ms?: number
  /** Milliseconds to the first content. */
  readonly ttftMs?: number
  readonly error?: string
  /** The gateway's trace sequence number (for later long-polls). */
  readonly seq?: number
}
