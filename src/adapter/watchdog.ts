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

import type { PiEvent } from './events.ts'

export interface StallTimeouts {
  /** Max wait for the first upstream event (connection + queueing). */
  firstEventTimeoutMs: number
  /** Max silence between two upstream events once streaming. */
  idleTimeoutMs: number
}

const TIMED_OUT: unique symbol = Symbol('watchdog-timed-out')

function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer!: ReturnType<typeof setTimeout>
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms)
    const t = timer as unknown as { unref?: () => void }
    t.unref?.()
  })
  const cleanup = (): void => clearTimeout(timer)
  return Promise.race([promise.then((value) => {
    cleanup()
    return value
  }, (err: unknown) => {
    cleanup()
    throw err
  }), timeout])
}

function stallErrorEvent(model: string, waitMs: number, first: boolean): PiEvent {
  const phase = first ? 'waiting for the first upstream event' : 'waiting for the next upstream event'
  return {
    type: 'error',
    error: {
      api: 'openai-completions',
      provider: 'dsh-magpie-connect',
      model,
      content: [],
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
      stopReason: 'error',
      // Must read as a timeout (events.ts classifies on /timeout/i -> TIMEOUT).
      errorMessage: `upstream stream timeout: no upstream events for ${Math.round(waitMs / 1000)}s while ${phase} (model "${model}") — the stalled stream was aborted`,
      timestamp: Date.now(),
    },
  } as PiEvent
}

export async function* withStallTimeout(
  events: AsyncIterable<PiEvent>,
  timeouts: StallTimeouts,
  options: { model?: string; onTimeout?: () => void } = {},
): AsyncGenerator<PiEvent> {
  const iterator = events[Symbol.asyncIterator]()
  try {
    let first = true
    for (;;) {
      const waitMs = first ? timeouts.firstEventTimeoutMs : timeouts.idleTimeoutMs
      if (!(waitMs > 0 && Number.isFinite(waitMs))) {
        const next = await iterator.next()
        if (next.done) return
        first = false
        yield next.value
        continue
      }
      const next = await raceTimeout(iterator.next(), waitMs)
      if (next === TIMED_OUT) {
        try {
          options.onTimeout?.()
        } catch {
          // Teardown must never mask the stall itself.
        }
        yield stallErrorEvent(options.model ?? 'unknown', waitMs, first)
        return
      }
      if (next.done) return
      first = false
      yield next.value
    }
  } finally {
    // Best-effort detach without awaiting: the upstream may be the very thing
    // that is stuck, so waiting for its return() could hang teardown too.
    void Promise.resolve(iterator.return?.()).catch(() => {})
  }
}
