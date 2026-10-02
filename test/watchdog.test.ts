import test from 'node:test'
import assert from 'node:assert/strict'
import { withStallTimeout } from '../src/adapter/watchdog.ts'
import type { PiEvent } from '../src/adapter/events.ts'

function startEvent(): PiEvent {
  return { type: 'start', partial: { content: [] } } as PiEvent
}

async function* fromList(events: PiEvent[]): AsyncGenerator<PiEvent> {
  for (const event of events) yield event
}

/** Never produces: models a silently stalled SSE connection. */
function hanging(): AsyncGenerator<PiEvent> {
  return (async function* () {
    await new Promise<never>(() => {})
    yield startEvent()
  })()
}

async function collect(
  events: AsyncIterable<PiEvent>,
  timeouts: { firstEventTimeoutMs: number; idleTimeoutMs: number },
  options: { model?: string; onTimeout?: () => void } = {},
): Promise<{ events: PiEvent[]; elapsedMs: number }> {
  const out: PiEvent[] = []
  const start = Date.now()
  for await (const event of withStallTimeout(events, timeouts, options)) out.push(event)
  return { events: out, elapsedMs: Date.now() - start }
}

test('a healthy stream passes through untouched', async () => {
  const input = [startEvent(), startEvent()]
  const { events } = await collect(fromList(input), { firstEventTimeoutMs: 1000, idleTimeoutMs: 1000 })
  assert.deepEqual(events, input)
})

test('a stream that never yields a first event fails fast with a timeout error', async () => {
  let aborted = 0
  const { events, elapsedMs } = await collect(hanging(), { firstEventTimeoutMs: 20, idleTimeoutMs: 20 }, { model: 'magpie-model', onTimeout: () => { aborted += 1 } })
  assert.equal(events.length, 1)
  assert.equal(events[0]?.type, 'error')
  const error = (events[0] as { error: { stopReason: string; errorMessage: string } }).error
  assert.equal(error.stopReason, 'error')
  assert.match(error.errorMessage, /timeout/i)
  assert.match(error.errorMessage, /magpie-model/)
  assert.equal(aborted, 1)
  assert.ok(elapsedMs < 2000, `should fail fast, took ${elapsedMs}ms`)
})

test('an idle stall after the first event fails fast, keeping what arrived', async () => {
  async function* stallAfterStart(): AsyncGenerator<PiEvent> {
    yield startEvent()
    await new Promise<never>(() => {})
  }
  const { events, elapsedMs } = await collect(stallAfterStart(), { firstEventTimeoutMs: 1000, idleTimeoutMs: 20 }, { model: 'magpie-model' })
  assert.equal(events.length, 2)
  assert.equal(events[0]?.type, 'start')
  assert.equal(events[1]?.type, 'error')
  assert.match((events[1] as { error: { errorMessage: string } }).error.errorMessage, /timeout/i)
  assert.ok(elapsedMs < 2000, `should fail fast, took ${elapsedMs}ms`)
})

test('a slow-but-alive stream is not cut off', async () => {
  async function* slow(): AsyncGenerator<PiEvent> {
    await new Promise((resolve) => setTimeout(resolve, 30))
    yield startEvent()
  }
  const { events } = await collect(slow(), { firstEventTimeoutMs: 1000, idleTimeoutMs: 1000 })
  assert.equal(events.length, 1)
})

test('non-positive timeouts disable the watchdog (old wait-forever behavior)', async () => {
  async function* slow(): AsyncGenerator<PiEvent> {
    await new Promise((resolve) => setTimeout(resolve, 30))
    yield startEvent()
  }
  const { events } = await collect(slow(), { firstEventTimeoutMs: 0, idleTimeoutMs: -1 })
  assert.equal(events.length, 1)
})
