import test from 'node:test'
import assert from 'node:assert/strict'
import { sectionFor } from '../scripts/release-notes.mjs'

const DOC = '# 更新日志\n\n## v1.2.3\n\nA content\nmore lines\n\n## v1.3.0\n\nB content\n'

test('sectionFor extracts one version by its v-prefixed heading', () => {
  assert.equal(sectionFor(DOC, '1.2.3'), 'A content\nmore lines')
})

test('sectionFor matches a bare (no-v) heading', () => {
  assert.equal(sectionFor('# t\n\n## 2.0.0\n\nC\n', '2.0.0'), 'C')
})

test('sectionFor never prefix-matches: 1.2 does not take 1.2.3', () => {
  assert.equal(sectionFor(DOC, '1.2'), null)
})

test('sectionFor returns null for a missing version', () => {
  assert.equal(sectionFor(DOC, '3.0.0'), null)
})

test('sectionFor returns null for an empty section (heading followed by another heading)', () => {
  assert.equal(sectionFor('# t\n\n## 4.0.0\n\n## 5.0.0\n\nx\n', '4.0.0'), null)
})

test('sectionFor stops at the next heading, not end of file', () => {
  assert.equal(sectionFor(DOC, '1.3.0'), 'B content')
})
