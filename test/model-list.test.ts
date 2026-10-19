import test from 'node:test'
import assert from 'node:assert/strict'
import {
  disableOne,
  enableOne,
  enabledAfterAdopt,
  initialPicked,
  toggleAllPicked,
  toggleAllWouldClear,
  type CandidateRow,
  type ModelRow,
} from '../src/client/model-visibility.ts'

/** One row with everything optional defaulted, so each test states only what it exercises. */
function row(id: string, enabled = true): ModelRow {
  return { id, displayName: id, image: false, responsesOnly: false, reasoning: false, efforts: [], enabled }
}

function candidate(id: string): CandidateRow {
  return { id, displayName: id, image: false, responsesOnly: false, reasoning: false, efforts: [] }
}

const offered = (models: readonly ModelRow[]): Set<string> =>
  new Set(models.filter((model) => model.enabled).map((model) => model.id))

test('initialPicked pre-ticks exactly what the picker already offers', () => {
  const models = [row('a'), row('b', false), row('c')]
  const picked = initialPicked([candidate('a'), candidate('b'), candidate('c')], offered(models))
  assert.deepEqual([...picked].sort(), ['a', 'c'])
  // A candidate the allowlist does not include starts unchecked — a fetch alone
  // must never add a model behind the user's back.
  assert.equal(picked.has('b'), false)
})

test('enabledAfterAdopt stores exactly the ticked candidates', () => {
  const candidates = [candidate('a'), candidate('b'), candidate('c')]
  assert.deepEqual(enabledAfterAdopt(candidates, new Set(['a', 'c'])), ['a', 'c'])
})

test('enabledAfterAdopt drops a model the gateway no longer lists', () => {
  // This is the whole point of the allowlist: membership is declared, so a model
  // that disappears from the directory simply stops being a candidate and can
  // never return on its own.
  const candidates = [candidate('zcode/a')]
  assert.deepEqual(enabledAfterAdopt(candidates, new Set(['zcode/a'])), ['zcode/a'])
  assert.deepEqual(enabledAfterAdopt(candidates, new Set()), [])
})

test('enabledAfterAdopt replaces the previous list rather than merging into it', () => {
  // Apply means "this selection is the list". A stale id the dialog cannot show
  // any more must not survive, or the stored document would grow entries that
  // can never take effect and that no UI could remove.
  const candidates = [candidate('a')]
  assert.deepEqual(enabledAfterAdopt(candidates, new Set(['a'])), ['a'])
  assert.deepEqual(enabledAfterAdopt(candidates, new Set()), [])
})

test('enabledAfterAdopt with nothing ticked stores an empty list, not inheritance', () => {
  // `[]` and `undefined` are different: the first offers nothing, the second
  // offers the whole directory. Ticking nothing must mean the former.
  assert.deepEqual(enabledAfterAdopt([candidate('a'), candidate('b')], new Set()), [])
})

test('enabledAfterAdopt does not mutate the set it was given', () => {
  const picked = new Set(['a'])
  enabledAfterAdopt([candidate('a'), candidate('b')], picked)
  assert.deepEqual([...picked], ['a'])
})

test('enableOne appends a model and is idempotent', () => {
  assert.deepEqual(enableOne([], 'a'), ['a'])
  assert.deepEqual(enableOne(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(enableOne(['a', 'b'], 'a'), ['a', 'b'])
})

test('enableOne does not mutate the array it was given', () => {
  const enabled = ['a']
  enableOne(enabled, 'b')
  assert.deepEqual(enabled, ['a'])
})

test('disableOne removes exactly the dropped model', () => {
  assert.deepEqual(disableOne(['a', 'b'], 'a'), ['b'])
  // Dropping a model that is not in the list changes nothing.
  assert.deepEqual(disableOne(['a'], 'z'), ['a'])
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

test('toggleAllPicked selects every visible candidate', () => {
  const shown = [candidate('a'), candidate('b')]
  assert.deepEqual([...toggleAllPicked(new Set(), shown)].sort(), ['a', 'b'])
})

test('toggleAllPicked with no visible candidates is a no-op', () => {
  const current = new Set(['a'])
  assert.deepEqual([...toggleAllPicked(current, [])], ['a'])
})

test('toggleAllWouldClear names the action toggleAllPicked performs', () => {
  const shown = [candidate('a'), candidate('b')]
  // Something can still be added, so the button says "select all" and adds.
  assert.equal(toggleAllWouldClear(shown, new Set()), false)
  assert.deepEqual([...toggleAllPicked(new Set(), shown)].sort(), ['a', 'b'])
  // Everything in view is already ticked, so the button says "deselect all".
  assert.equal(toggleAllWouldClear(shown, new Set(['a', 'b'])), true)
  assert.deepEqual([...toggleAllPicked(new Set(['a', 'b']), shown)], [])
})

test('disableOne takes effect against a row list that still says enabled', () => {
  // Regression: the card rendered rows from the server's `enabled` flag, so a
  // delete only disappeared after the next list re-read. The drafted allowlist
  // must win, and this is the pure step that makes the row vanish immediately.
  const rows = [row('a'), row('b')]          // both still flagged enabled by the server
  const drafted = disableOne(['a', 'b'], 'a')
  const visible = rows.filter((model) => drafted.includes(model.id)).map((model) => model.id)
  assert.deepEqual(visible, ['b'], 'the deleted row is gone without a re-read')
  // And the stale row flag alone would have kept it on screen:
  assert.deepEqual(rows.filter((model) => model.enabled).map((model) => model.id), ['a', 'b'])
})
