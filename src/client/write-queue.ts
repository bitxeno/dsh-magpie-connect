/**
 * Serialize one value's writes so rapid edits cannot race or lose the last one.
 *
 * The model list autosaves: every remove and every dialog adoption posts the
 * hidden set. Clicking remove three times in a second must not fire three
 * overlapping requests whose responses land out of order — the last state the
 * user saw has to be the last state that reaches the disk.
 *
 * The policy is deliberately "one in flight, keep only the newest pending":
 * intermediate states are not worth uploading, and the final one always is.
 * @param write - performs one write for a value; its rejection is reported.
 * @returns a scheduler with `push`, `idle`, and a `status` reader.
 */
export function createWriteQueue<T>(
  write: (value: T) => Promise<void>,
  onSettled?: (outcome: { ok: true } | { ok: false; error: unknown }) => void,
): {
  push: (value: T) => void
  /** Resolves when nothing is in flight and nothing is queued. */
  idle: () => Promise<void>
  /** Whether a write is running or waiting. */
  pending: () => boolean
} {
  let inFlight: Promise<void> | undefined
  let queued: { value: T } | undefined
  let idleWaiters: Array<() => void> = []

  const settleIdle = (): void => {
    if (inFlight !== undefined || queued !== undefined) return
    const waiters = idleWaiters
    idleWaiters = []
    for (const waiter of waiters) waiter()
  }

  const drain = (): void => {
    const next = queued
    queued = undefined
    if (next === undefined) {
      settleIdle()
      return
    }
    const run = write(next.value)
    inFlight = run.then(
      () => {
        inFlight = undefined
        onSettled?.({ ok: true })
        drain()
      },
      (error: unknown) => {
        inFlight = undefined
        onSettled?.({ ok: false, error })
        drain()
      },
    )
  }

  return {
    push(value: T): void {
      // A newer value always supersedes an unstarted one.
      queued = { value }
      if (inFlight === undefined) drain()
    },
    idle(): Promise<void> {
      if (inFlight === undefined && queued === undefined) return Promise.resolve()
      return new Promise((resolve) => {
        idleWaiters.push(resolve)
      })
    },
    pending(): boolean {
      return inFlight !== undefined || queued !== undefined
    },
  }
}
