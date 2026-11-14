/**
 * Pure formatting for the routing popover's rows, out of the `.tsx` so
 * `node --test` can import them directly (Node runs `.ts` but not `.tsx`).
 *
 * The web Routing page's sentences are long ("限流 · 周六 11:09 恢复 · 还有
 * 13 小时"); the popover's contract is the compressed one: a duration that
 * fits after a percent, a percent without decimals, a model name without
 * its group when the group header already says it. Nothing here touches the
 * DOM or fetches — callers feed plain wire values and locale strings.
 */

import type { TraceAccountRow, TraceRequestRow, TraceTotals } from '../trace-contract.ts'

/** How a duration is worded: pieces a locale template fills in. */
export interface DurationParts {
  readonly n: number
  readonly unit: 'ms' | 's' | 'm' | 'h' | 'd'
}

/**
 * Compress a duration for a popover row: one significant unit, no decimals
 * above a second, minutes only inside the first hour, days past two days.
 * @param ms - duration in milliseconds; non-finite or negative reads as absent.
 * @returns the value and unit, or `undefined` when there is nothing to show.
 */
export function durationParts(ms: number | undefined): DurationParts | undefined {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return undefined
  if (ms < 1_000) return { n: Math.round(ms), unit: 'ms' }
  if (ms < 60_000) return { n: Math.round(ms / 1_000), unit: 's' }
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return { n: minutes, unit: 'm' }
  const hours = Math.round(minutes / 60)
  if (hours < 48) return { n: hours, unit: 'h' }
  return { n: Math.round(hours / 24), unit: 'd' }
}

/** How long until a reset is worded: pieces a locale template fills in. */
export type ResetParts = DurationParts

/**
 * Compress the wait until a quota window resets. Rounded *up* — "还有 13
 * 小时" must not drop to 0 while the hour is still running, and a day that
 * ends tomorrow stays "1 天". Sub-minute waits read as one minute: the
 * popover refreshes more slowly than that, so finer wording would lie.
 * @param resetsAt - the reset instant (RFC 3339) or undefined.
 * @param now - the reference instant (epoch ms); defaults to the caller's clock.
 * @returns the countdown, or `undefined` when the date is absent or past.
 */
export function resetParts(resetsAt: string | undefined, now: number = Date.now()): ResetParts | undefined {
  if (resetsAt === undefined) return undefined
  const at = Date.parse(resetsAt)
  if (!Number.isFinite(at) || at <= now) return undefined
  const ms = at - now
  const minutes = Math.ceil(ms / 60_000)
  if (minutes < 60) return { n: minutes, unit: 'm' }
  const hours = Math.ceil(minutes / 60)
  if (hours < 48) return { n: hours, unit: 'h' }
  return { n: Math.ceil(hours / 24), unit: 'd' }
}

/** One bar of the five-segment usage gauge; 0–4 filled. */
export const USAGE_BARS = 5

/**
 * Fill count for the usage gauge. 0% draws one dim segment (a row without a
 * bar reads as "no data"); 100% fills all five.
 * @param usedPct - share used, 0–100; absent reads as no data.
 * @returns segments to fill, 0–{@link USAGE_BARS}.
 */
export function usageBars(usedPct: number | undefined): number | undefined {
  if (usedPct === undefined || !Number.isFinite(usedPct)) return undefined
  const clamped = Math.min(100, Math.max(0, Math.round(usedPct)))
  return Math.max(0, Math.min(USAGE_BARS, Math.round((clamped / 100) * USAGE_BARS)))
}

/** Whether a usage share is near exhaustion (the red zone, ≥90%). */
export function isUsageCritical(usedPct: number | undefined): boolean {
  return usedPct !== undefined && Number.isFinite(usedPct) && usedPct >= 90
}

/** Which dot a request row draws: ok (green), failed (red), canceled (dim). */
export type RequestTone = 'ok' | 'failed' | 'canceled'

/** Map one request row onto its dot tone. */
export function requestTone(row: TraceRequestRow): RequestTone {
  if (row.canceled === true) return 'canceled'
  if (row.status === undefined) return 'failed'
  return row.status >= 200 && row.status < 400 ? 'ok' : 'failed'
}

/**
 * The one-line model label for a request row: "asked → served" only when the
 * gateway served another model than the one asked for; otherwise just the
 * asked name. Absent names collapse to the other side.
 * @param row - the request row.
 * @returns the label, or '' when the row names no model at all.
 */
export function requestModelLabel(row: TraceRequestRow): string {
  const asked = row.requested ?? ''
  const served = row.served ?? ''
  if (asked !== '' && served !== '' && asked !== served) return `${asked} → ${served}`
  return asked !== '' ? asked : served
}

/** Where a request was served, as one "provider · account" string ('' when unknown). */
export function requestPlaceLabel(row: TraceRequestRow): string {
  return [row.provider, row.account].filter((part) => part !== undefined && part !== '').join(' · ')
}

/** The header line's compressed counts, locale-ready. */
export interface TotalsParts {
  readonly requests: number
  readonly errors: number
  readonly retried: number
}

/** Pick the three numbers the header shows (canceled stays in the tooltip). */
export function totalsParts(totals: TraceTotals | undefined): TotalsParts | undefined {
  if (totals === undefined) return undefined
  return { requests: totals.requests, errors: totals.errors, retried: totals.retried }
}

/** One account row's compact pieces, ready for the locale templates. */
export interface AccountLine {
  readonly provider: string
  readonly plan?: string
  readonly user?: string
  readonly usedPct?: number
  readonly bars: number | undefined
  readonly critical: boolean
  readonly reset?: ResetParts
  /** True when the gateway reported the account unusable (no numbers to show). */
  readonly errored: boolean
}

/** Project a wire account row onto the popover line's pieces. */
export function accountLine(row: TraceAccountRow, now: number = Date.now()): AccountLine {
  return {
    provider: row.provider,
    ...(row.plan !== undefined ? { plan: row.plan } : {}),
    ...(row.user !== undefined ? { user: row.user } : {}),
    ...(row.usedPct !== undefined ? { usedPct: row.usedPct } : {}),
    bars: usageBars(row.usedPct),
    critical: isUsageCritical(row.usedPct),
    ...(resetParts(row.resetsAt, now) !== undefined ? { reset: resetParts(row.resetsAt, now) } : {}),
    errored: row.error !== undefined && row.usedPct === undefined,
  }
}

/** Mask one account holder: keep the name's head, drop anything mail-shaped. */
export function maskUser(user: string | undefined): string | undefined {
  if (user === undefined) return undefined
  const at = user.indexOf('@')
  if (at <= 0) return user
  const head = user.slice(0, Math.max(1, Math.min(at, 4)))
  return `${head}…`
}
