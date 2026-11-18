/**
 * Geometry for the routing popover's branch wires, out of the `.tsx` so
 * `node --test` can import it directly (Node runs `.ts` but not `.tsx`).
 *
 * Magpie draws a cubic S from the group header into each candidate card. The
 * wires live in a narrow gutter on the group's left edge, and every x in the
 * path is a constant: only the y of each card has to be measured.
 *
 * That constant gutter is the whole point. The popover is width-clamped by
 * its parent *after* these children have run their layout effects, so a
 * measurement taken here can describe a wider box than the one the SVG ends
 * up in. A viewBox spanning the full group width would then be stretched to
 * the clamped box, scaling every path and visibly sliding the wires sideways
 * once the corrected measurement landed. With the SVG pinned to
 * {@link WIRE_GUTTER} and its viewBox matching that box exactly, the scale is
 * 1:1 no matter when the parent's clamp arrives, so the wires cannot move.
 */
/** Width of the wire gutter on the group's left edge, in CSS pixels. */
export declare const WIRE_GUTTER = 34;
/** Where a wire leaves the group header (x, and the header's mid-height y). */
export declare const WIRE_X0 = 10;
/** Where a wire meets a candidate card's left edge. */
export declare const WIRE_X1 = 26;
/** The header's vertical centre, from the group's top edge. */
export declare const WIRE_Y0 = 16;
/** One drawn branch: its path plus the two states that tint it. */
export interface TraceWirePath {
    readonly d: string;
    readonly active: boolean;
    readonly live: boolean;
}
/** The wires of one routing group, sized to the box they were measured in. */
export interface TraceWireState {
    readonly width: number;
    readonly height: number;
    readonly paths: readonly TraceWirePath[];
}
/** The empty drawing: nothing measured yet, so nothing renders. */
export declare const NO_WIRES: TraceWireState;
/** A box in the group's own coordinate space (the subset the wires need). */
export interface WireBox {
    readonly top: number;
    readonly height: number;
}
/**
 * Build one group's wires from the group box and each card's box, both in
 * viewport coordinates (as `getBoundingClientRect` returns them).
 * @param group - the group container's box.
 * @param cards - one box per candidate row, in roster order.
 * @param activeIndex - the row holding the answer (or in flight), or -1.
 * @param outcomes - each row's outcome, in the same order as `cards`.
 * @returns the drawing; `width` is always {@link WIRE_GUTTER}, so the SVG
 *   never scales horizontally.
 */
export declare function buildWireState(group: WireBox, cards: readonly WireBox[], activeIndex: number, outcomes: readonly (string | undefined)[]): TraceWireState;
/**
 * Whether two wire states describe the same drawing. Callers keep the old
 * state when this is true: a fresh object every measure would re-render the
 * subtree on each resize tick, and re-rendering is what made the stale frame
 * visible in the first place.
 * @param a - the state already in React.
 * @param b - the freshly measured state.
 * @returns true when nothing visible changed.
 */
export declare function sameWires(a: TraceWireState, b: TraceWireState): boolean;
