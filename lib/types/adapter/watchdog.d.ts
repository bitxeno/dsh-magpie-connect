/**
 * Stall watchdog for upstream event streams.
 *
 * pi-ai surfaces transport failures as `error` events, but a silently
 * stalled SSE connection (headers sent, then no bytes ever again) produces
 * *no* event at all: the consumer's `for await` blocks until the SDK-level
 * overall timeout or the harness timeout. This wrapper races every `next()`
 * against a timer and, on expiry, aborts the upstream (best effort, via
 * `onTimeout`) and yields a synthetic `error` event so the normal chunk
 * translation turns the stall into a fast `TIMEOUT` finish instead of a
 * minutes-long hang.
 *
 * Two phases: time-to-first-event (queueing happens here) and idle-between-
 * events (a healthy stream emits frequently). Either phase accepts a
 * non-positive value to disable its timer (wait forever, the old behavior).
 */
import type { PiEvent } from './events.ts';
export interface StallTimeouts {
    /** Max wait for the first upstream event (connection + queueing). */
    firstEventTimeoutMs: number;
    /** Max silence between two upstream events once streaming. */
    idleTimeoutMs: number;
}
export declare function withStallTimeout(events: AsyncIterable<PiEvent>, timeouts: StallTimeouts, options?: {
    model?: string;
    onTimeout?: () => void;
}): AsyncGenerator<PiEvent>;
