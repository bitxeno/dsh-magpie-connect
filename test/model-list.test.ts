import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hideOne,
  hiddenAfterAdopt,
  initialPicked,
  toggleAllPicked,
  type CandidateRow,
  type ModelRow,
} from '../src/client/model-visibility.ts'

/** One row with everything optional defaulted, so each test states only what it exercises. */
function row(id: string, hidden = false): ModelRow {
  return { id, displayName: id, image: false, responsesOnly: false, reasoning: false, efforts: [], hidden }
}

function candidate(id: string): CandidateRow {
  return { id, displayName: id, image: false, responsesOnly: false, reasoning: false, efforts: [] }
}

const visible = (models: readonly ModelRow[]): Set<string> =>
  new Set(models.filter((model) => !model.hidden).map((model) => model.id))

test('initialPicked pre-ticks exactly what the picker already offers', () => {
  const models = [row('a'), row('b', true), row('c')]
  const picked = initialPicked([candidate('a'), candidate('b'), candidate('c')], visible(models))
  assert.deepEqual([...picked].sort(), ['a', 'c'])
  // A candidate the picker does not offer yet starts unchecked — a fetch alone
  // must never turn a model on behind the user.
  assert.equal(picked.has('b'), false)
})

test('hiddenAfterAdopt hides only the candidates left unchecked', () => {
  const candidates = [candidate('a'), candidate('b'), candidate('c')]
  assert.deepEqual(hiddenAfterAdopt(candidates, new Set(['a', 'c'])), ['b'])
})

test('hiddenAfterAdopt drops ids the gateway did not offer', () => {
  // The saved hidden set is pruned to the live directory on write, so a stale
  // id must not survive an adopt: leaving it in would resurrect an entry the
  // settings page can no longer show or clear.
  const candidates = [candidate('live')]
  assert.deepEqual(hiddenAfterAdopt(candidates, new Set(['live'])), [])
  assert.deepEqual(hiddenAfterAdopt(candidates, new Set()), ['live'])
})

test('hiddenAfterAdopt with nothing picked hides every candidate', () => {
  const candidates = [candidate('a'), candidate('b')]
  assert.deepEqual(hiddenAfterAdopt(candidates, new Set()), ['a', 'b'])
})

test('hideOne appends a model and is idempotent', () => {
  assert.deepEqual(hideOne([], 'a'), ['a'])
  assert.deepEqual(hideOne(['a'], 'b'), ['a', 'b'])
  // Removing an already-hidden id must not duplicate it.
  assert.deepEqual(hideOne(['a', 'b'], 'a'), ['a', 'b'])
})

test('hideOne does not mutate the array it was given', () => {
  const hidden = ['a']
  hideOne(hidden, 'b')
  assert.deepEqual(hidden, ['a'])
})

test('toggleAllPicked selects every visible candidate, then clears them', () => {
  const shown = [candidate('a'), candidate('b')]
  const selected = toggleAllPicked(new Set(['z']), shown)
  assert.deepEqual([...selected].sort(), ['a', 'b', 'z'])
  const cleared = toggleAllPicked(selected, shown)
  assert.deepEqual([...cleared], ['z'])
})

test('toggleAllPicked only clears what the query shows', () => {
  const shown = [candidate('a')]
  // 'b' is checked but filtered out of view: clearing must not un-pick it.
  const cleared = toggleAllPicked(new Set(['a', 'b']), shown)
  assert.deepEqual([...cleared], ['b'])
})

test('toggleAllPicked with no visible candidates is a no-op', () => {
  const current = new Set(['a'])
  assert.deepEqual([...toggleAllPicked(current, [])], ['a'])
})
