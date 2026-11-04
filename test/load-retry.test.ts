import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PENDING_RETRY_DELAY_MS,
  PENDING_RETRY_LIMIT,
  shouldRetryPending,
} from '../src/client/load-retry.ts'

test('a pending snapshot retries until the cap, then stops', () => {
  let attempts = 0
  assert.equal(shouldRetryPending({ status: 'pending' }, attempts), true)
  for (let round = 0; round < PENDING_RETRY_LIMIT; round += 1) {
    assert.equal(shouldRetryPending({ status: 'pending' }, attempts), true)
    attempts += 1
  }
  // At the cap the warm-up loop must yield, not keep polling forever.
  assert.equal(shouldRetryPending({ status: 'pending' }, attempts), false)
  assert.equal(shouldRetryPending({ status: 'pending' }, attempts + 5), false)
})

test('terminal statuses never retry', () => {
  for (const status of ['ready', 'stale', 'error', undefined]) {
    assert.equal(shouldRetryPending({ status }, 0), false, `status=${String(status)}`)
  }
  assert.equal(shouldRetryPending(undefined, 0), false)
})

test('the retry budget is small enough not to churn for tens of seconds', () => {
  // Regression guard: the bug was 20 rounds at 1 s that overwrote the form.
  const totalMs = PENDING_RETRY_LIMIT * PENDING_RETRY_DELAY_MS
  assert.ok(PENDING_RETRY_LIMIT <= 8, `limit ${PENDING_RETRY_LIMIT} is too many rounds`)
  assert.ok(totalMs <= 15_000, `warm-up window ${totalMs}ms is too long`)
  assert.ok(PENDING_RETRY_DELAY_MS >= 1000, 'polling faster than 1/s fights the typist')
})
