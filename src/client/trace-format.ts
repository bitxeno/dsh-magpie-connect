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

import type { TraceAccountRow } from '../trace-contract.ts'

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
 * Compress the wait until a quota window resets, word for word the way
 * Magpie's own page does it (`untilText` in its app.js): round to the
 * nearest unit, minutes below an hour, hours below two days, days past
 * that. The popover sits beside that page, so both must say the same
 * number — rounding each step up here instead made a reset 12 days and 8
 * hours away read "13 天" against Magpie's "12 天". Sub-minute waits read
 * as one minute rather than zero, since the popover refreshes more slowly
 * than that.
 * @param resetsAt - the reset instant (RFC 3339) or undefined.
 * @param now - the reference instant (epoch ms); defaults to the caller's clock.
 * @returns the countdown, or `undefined` when the date is absent or past.
 */
export function resetParts(resetsAt: string | undefined, now: number = Date.now()): ResetParts | undefined {
  if (resetsAt === undefined) return undefined
  const at = Date.parse(resetsAt)
  if (!Number.isFinite(at) || at <= now) return undefined
  const minutes = Math.max(1, Math.round((at - now) / 60_000))
  if (minutes < 60) return { n: minutes, unit: 'm' }
  const hours = Math.round(minutes / 60)
  if (hours < 48) return { n: hours, unit: 'h' }
  return { n: Math.round(hours / 24), unit: 'd' }
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

/** A counter rounded for display: at most two decimals, non-finite as absent. */
function roundAmount(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined
}

/** Which locale template words a candidate's usage. */
export type UsageTemplate = 'trace.candidate.amountPct' | 'trace.candidate.amount' | 'trace.candidate.used'

/** One candidate's usage line: the template to fill and its params. */
export interface UsageText {
  readonly template: UsageTemplate
  readonly params: Record<string, string | number>
}

/**
 * Word one candidate's usage. A counted window (an amount/limit pair) says
 * its figures *and* its share — Magpie's own page leads with the percent,
 * and the pair alone made a credits account the only row in the popover
 * without one. A window that reports only a share says just that.
 * @param facts - the candidate's counters; `unit` already localized.
 * @returns the template and params, or `undefined` when there is nothing to say.
 */
export function usageText(facts: {
  readonly amount?: number
  readonly limit?: number
  readonly unit?: string
  readonly usedPct?: number
}): UsageText | undefined {
  const amount = roundAmount(facts.amount)
  const limit = roundAmount(facts.limit)
  const usedPct = facts.usedPct
  const unit = facts.unit ?? ''
  if (amount !== undefined && limit !== undefined) {
    return usedPct !== undefined
      ? { template: 'trace.candidate.amountPct', params: { amount, limit, unit, n: usedPct } }
      : { template: 'trace.candidate.amount', params: { amount, limit, unit } }
  }
  return usedPct !== undefined ? { template: 'trace.candidate.used', params: { n: usedPct } } : undefined
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
