import test from 'node:test'
import assert from 'node:assert/strict'
import { isOwnNavRow } from '../src/client/nav-icon.ts'

test('isOwnNavRow matches the row whose text is our label', () => {
  assert.equal(isOwnNavRow('Magpie', 'Magpie'), true)
  assert.equal(isOwnNavRow('  Magpie  ', 'Magpie'), true)
  assert.equal(isOwnNavRow('Magpie 网关', 'Magpie 网关'), true)
})

test('isOwnNavRow ignores every other row', () => {
  assert.equal(isOwnNavRow('Models', 'Magpie'), false)
  assert.equal(isOwnNavRow('Account', 'Magpie'), false)
  assert.equal(isOwnNavRow('Magpie Extra', 'Magpie'), false)
  assert.equal(isOwnNavRow('', 'Magpie'), false)
})

test('an unresolved label matches nothing', () => {
  // A locale that has not resolved yet must not mark the whole nav: an empty
  // wanted label would otherwise equal every empty row text.
  assert.equal(isOwnNavRow('', ''), false)
  assert.equal(isOwnNavRow('   ', '   '), false)
  assert.equal(isOwnNavRow('Magpie', undefined), false)
  assert.equal(isOwnNavRow('Magpie', null), false)
})

test('a locale switch re-matches against the new label', () => {
  const row = 'Magpie 网关'
  assert.equal(isOwnNavRow(row, 'Magpie'), false, 'stale label no longer matches')
  assert.equal(isOwnNavRow(row, 'Magpie 网关'), true, 'new label matches')
})
