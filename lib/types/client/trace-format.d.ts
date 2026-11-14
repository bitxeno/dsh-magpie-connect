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
import type { TraceAccountRow, TraceRequestRow, TraceTotals } from '../trace-contract.ts';
/** How a duration is worded: pieces a locale template fills in. */
export interface DurationParts {
    readonly n: number;
    readonly unit: 'ms' | 's' | 'm' | 'h' | 'd';
}
/**
 * Compress a duration for a popover row: one significant unit, no decimals
 * above a second, minutes only inside the first hour, days past two days.
 * @param ms - duration in milliseconds; non-finite or negative reads as absent.
 * @returns the value and unit, or `undefined` when there is nothing to show.
 */
export declare function durationParts(ms: number | undefined): DurationParts | undefined;
/** How long until a reset is worded: pieces a locale template fills in. */
export type ResetParts = DurationParts;
/**
 * Compress the wait until a quota window resets. Rounded *up* — "还有 13
 * 小时" must not drop to 0 while the hour is still running, and a day that
 * ends tomorrow stays "1 天". Sub-minute waits read as one minute: the
 * popover refreshes more slowly than that, so finer wording would lie.
 * @param resetsAt - the reset instant (RFC 3339) or undefined.
 * @param now - the reference instant (epoch ms); defaults to the caller's clock.
 * @returns the countdown, or `undefined` when the date is absent or past.
 */
export declare function resetParts(resetsAt: string | undefined, now?: number): ResetParts | undefined;
/** One bar of the five-segment usage gauge; 0–4 filled. */
export declare const USAGE_BARS = 5;
/**
 * Fill count for the usage gauge. 0% draws one dim segment (a row without a
 * bar reads as "no data"); 100% fills all five.
 * @param usedPct - share used, 0–100; absent reads as no data.
 * @returns segments to fill, 0–{@link USAGE_BARS}.
 */
export declare function usageBars(usedPct: number | undefined): number | undefined;
/** Whether a usage share is near exhaustion (the red zone, ≥90%). */
export declare function isUsageCritical(usedPct: number | undefined): boolean;
/** Which dot a request row draws: ok (green), failed (red), canceled (dim). */
export type RequestTone = 'ok' | 'failed' | 'canceled';
/** Map one request row onto its dot tone. */
export declare function requestTone(row: TraceRequestRow): RequestTone;
/**
 * The one-line model label for a request row: "asked → served" only when the
 * gateway served another model than the one asked for; otherwise just the
 * asked name. Absent names collapse to the other side.
 * @param row - the request row.
 * @returns the label, or '' when the row names no model at all.
 */
export declare function requestModelLabel(row: TraceRequestRow): string;
/** Where a request was served, as one "provider · account" string ('' when unknown). */
export declare function requestPlaceLabel(row: TraceRequestRow): string;
/** The header line's compressed counts, locale-ready. */
export interface TotalsParts {
    readonly requests: number;
    readonly errors: number;
    readonly retried: number;
}
/** Pick the three numbers the header shows (canceled stays in the tooltip). */
export declare function totalsParts(totals: TraceTotals | undefined): TotalsParts | undefined;
/** One account row's compact pieces, ready for the locale templates. */
export interface AccountLine {
    readonly provider: string;
    readonly plan?: string;
    readonly user?: string;
    readonly usedPct?: number;
    readonly bars: number | undefined;
    readonly critical: boolean;
    readonly reset?: ResetParts;
    /** True when the gateway reported the account unusable (no numbers to show). */
    readonly errored: boolean;
}
/** Project a wire account row onto the popover line's pieces. */
export declare function accountLine(row: TraceAccountRow, now?: number): AccountLine;
/** Mask one account holder: keep the name's head, drop anything mail-shaped. */
export declare function maskUser(user: string | undefined): string | undefined;
