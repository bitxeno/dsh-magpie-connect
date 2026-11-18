import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWireState,
  NO_WIRES,
  sameWires,
  WIRE_GUTTER,
  WIRE_X0,
  WIRE_X1,
  WIRE_Y0,
} from '../src/client/trace-wires.ts'

/** A box at a viewport position, the shape getBoundingClientRect returns. */
function box(top: number, height: number): { top: number; height: number } {
  return { top, height }
}

test('buildWireState pins the width to the gutter so the SVG never scales', () => {
  const state = buildWireState(box(100, 300), [box(150, 40), box(200, 40)], 0, ['answered', 'resting'])
  // The width must equal the SVG's own box, or the browser stretches the
  // viewBox and slides every wire sideways by the scale difference.
  assert.equal(state.width, WIRE_GUTTER)
  assert.equal(state.height, 300)
  assert.equal(state.paths.length, 2)
})

test('buildWireState meets each card at its mid-height inside the group', () => {
  const state = buildWireState(box(100, 300), [box(150, 40), box(220, 60)], -1, [])
  // Card one: 150 - 100 + 40/2 = 70. Card two: 220 - 100 + 60/2 = 150.
  assert.equal(state.paths[0]?.d, `M${WIRE_X0} ${WIRE_Y0} C18 ${WIRE_Y0} 18 70 ${WIRE_X1} 70`)
  assert.equal(state.paths[1]?.d, `M${WIRE_X0} ${WIRE_Y0} C18 ${WIRE_Y0} 18 150 ${WIRE_X1} 150`)
})

test('buildWireState marks the answered row active and a running one live', () => {
  const state = buildWireState(box(0, 200), [box(10, 20), box(40, 20), box(70, 20)], 1, ['resting', 'processing', 'skipped'])
  assert.deepEqual(state.paths.map(path => path.active), [false, true, false])
  assert.deepEqual(state.paths.map(path => path.live), [false, true, false])
})

test('buildWireState draws nothing when there are no cards', () => {
  const state = buildWireState(box(0, 100), [], -1, [])
  assert.deepEqual(state.paths, [])
  // The height still carries, so the gutter can render an empty (invisible) SVG.
  assert.equal(state.height, 100)
})

test('sameWires ignores an equal redraw but catches every visible change', () => {
  const group = box(100, 300)
  const cards = [box(150, 40)]
  const base = buildWireState(group, cards, 0, ['answered'])
  assert.equal(sameWires(base, buildWireState(group, cards, 0, ['answered'])), true)
  // A card moving down is a different drawing.
  assert.equal(sameWires(base, buildWireState(group, [box(160, 40)], 0, ['answered'])), false)
  // So is a different group height, or a row starting to run (which tints it).
  assert.equal(sameWires(base, buildWireState(box(100, 320), cards, 0, ['answered'])), false)
  assert.equal(sameWires(base, buildWireState(group, cards, 0, ['processing'])), false)
  assert.equal(sameWires(base, buildWireState(group, cards, -1, ['answered'])), false)
  assert.equal(sameWires(base, NO_WIRES), false)
  // An outcome that leaves the tint alone is not a redraw: only 'processing'
  // and the active row reach the path's two state flags.
  assert.equal(sameWires(base, buildWireState(group, cards, 0, ['resting'])), true)
})

test('NO_WIRES renders nothing until a measurement lands', () => {
  assert.equal(NO_WIRES.height, 0)
  assert.deepEqual(NO_WIRES.paths, [])
  assert.equal(sameWires(NO_WIRES, NO_WIRES), true)
})
