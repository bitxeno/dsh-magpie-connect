import test from 'node:test'
import assert from 'node:assert/strict'
import { createWriteQueue } from '../src/client/write-queue.ts'

/** A write whose completion the test controls. */
function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void } {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('a single push writes immediately', async () => {
  const written: string[] = []
  const queue = createWriteQueue<string>(async (value) => {
    written.push(value)
  })
  queue.push('a')
  await queue.idle()
  assert.deepEqual(written, ['a'])
  assert.equal(queue.pending(), false)
})

test('writes never overlap: the next starts only after the previous settles', async () => {
  const gate = deferred()
  const written: string[] = []
  let concurrent = 0
  let maxConcurrent = 0
  const queue = createWriteQueue<string>(async (value) => {
    concurrent += 1
    maxConcurrent = Math.max(maxConcurrent, concurrent)
    if (value === 'a') await gate.promise
    written.push(value)
    concurrent -= 1
  })

  queue.push('a')
  queue.push('b')
  // 'b' must wait for 'a' rather than racing it: two in-flight writes whose
  // responses land out of order would leave the disk holding the older set.
  assert.deepEqual(written, [])
  gate.resolve()
  await queue.idle()
  assert.deepEqual(written, ['a', 'b'])
  assert.equal(maxConcurrent, 1)
})

test('superseded values are dropped, not queued up', async () => {
  const gate = deferred()
  const written: string[] = []
  const queue = createWriteQueue<string>(async (value) => {
    if (value === 'a') await gate.promise
    written.push(value)
  })

  queue.push('a')
  // Three edits while 'a' is in flight: only the newest is worth uploading,
  // and it must be the one that lands last.
  queue.push('b')
  queue.push('c')
  queue.push('d')
  gate.resolve()
  await queue.idle()
  assert.deepEqual(written, ['a', 'd'])
})

test('idle resolves only once everything has drained', async () => {
  const gate = deferred()
  const written: string[] = []
  const queue = createWriteQueue<string>(async (value) => {
    if (value === 'a') await gate.promise
    written.push(value)
  })
  queue.push('a')
  queue.push('b')

  let drained = false
  const waiting = queue.idle().then(() => {
    drained = true
  })
  await Promise.resolve()
  assert.equal(drained, false, 'still writing')
  gate.resolve()
  await waiting
  assert.equal(drained, true)
  assert.deepEqual(written, ['a', 'b'])
})

test('idle on an empty queue resolves immediately', async () => {
  const queue = createWriteQueue<string>(async () => {})
  await queue.idle()
  assert.equal(queue.pending(), false)
})

test('a failed write reports the failure and lets the next through', async () => {
  const outcomes: Array<{ ok: boolean }> = []
  const written: string[] = []
  const queue = createWriteQueue<string>(
    async (value) => {
      if (value === 'bad') throw new Error('rejected')
      written.push(value)
    },
    (outcome) => outcomes.push({ ok: outcome.ok }),
  )

  queue.push('bad')
  queue.push('good')
  await queue.idle()
  // A rejected write must not wedge the queue: the user's next edit still lands.
  assert.deepEqual(outcomes, [{ ok: false }, { ok: true }])
  assert.deepEqual(written, ['good'])
  assert.equal(queue.pending(), false)
})

test('pending reflects an in-flight or queued write', async () => {
  const gate = deferred()
  const queue = createWriteQueue<string>(async () => {
    await gate.promise
  })
  assert.equal(queue.pending(), false)
  queue.push('a')
  assert.equal(queue.pending(), true)
  gate.resolve()
  await queue.idle()
  assert.equal(queue.pending(), false)
})
