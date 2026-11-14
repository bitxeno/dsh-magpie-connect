/**
 * Popup placement math for the routing popover — the same box-fitting the
 * reference picker uses, cut down to what a read-only panel needs.
 *
 * The popover is a plain absolutely-positioned sibling of the button (no
 * portal); its box is fitted to the visible viewport so a phone screen never
 * truncates it: the width shrinks to the free width, the edge stops at the
 * keep-out margin, and the panel opens on the roomier side of the button.
 * `visualViewport` is authoritative on mobile — it shrinks when the on-screen
 * keyboard opens, while `innerWidth`/`innerHeight` do not.
 *
 * Pure functions only; the component measures the anchor and feeds them here.
 */
/** Preferred popover width in CSS pixels. */
export declare const POPUP_WIDTH = 320;
/** Height cap of the popover in CSS pixels. */
export declare const POPUP_MAX_HEIGHT = 420;
/** Distance between the button and the popover. */
export declare const POPUP_GAP = 8;
/** Keep-out margin between the popover and the viewport edges. */
export declare const POPUP_MARGIN = 8;
/** A box in viewport coordinates (a `DOMRect` subset). */
export interface Box {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
}
/** The visible viewport: offset and size (a `visualViewport` subset). */
export interface ViewportBox extends Box {
    readonly width: number;
    readonly height: number;
}
/** How the popover is attached to the button. */
export type PopupSide = 'above' | 'below' | 'sheet';
/** The fitted popover box, as offsets relative to the anchor's box. */
export interface PopupPlacement {
    readonly side: PopupSide;
    /** Left edge relative to the anchor's left edge. */
    readonly offsetLeft: number;
    readonly width: number;
    readonly maxHeight: number;
    /** Top edge relative to the anchor's top edge (below only). */
    readonly offsetTop?: number;
    /** Bottom edge relative to the anchor's bottom edge (above and sheet). */
    readonly offsetBottom?: number;
}
/**
 * Fit the popover into the clipping box, opening on the roomier side of the
 * anchor. When neither side has usable room (a landscape phone, the keyboard
 * up) the popover becomes a bottom sheet centred in the box. The result is
 * always clamped inside the box, even when the anchor itself has scrolled out
 * of view.
 * @param anchor - the button's viewport-space box.
 * @param clip - the box the popover must stay inside (see {@link clipBoxFor}).
 * @returns the anchor-relative offsets, width, and height cap.
 */
export declare function computePopupPlacement(anchor: Box, clip: Box): PopupPlacement;
/**
 * The popover's clipping box: the visible viewport intersected with the
 * nearest scrolling ancestor. An absolutely positioned popover is clipped by
 * that ancestor, so fitting to the viewport alone still truncates it.
 * @param element - the popover's anchor wrapper.
 * @param viewport - the visible viewport.
 * @returns the box the popover must stay inside.
 */
export declare function clipBoxFor(element: Element, viewport: ViewportBox): Box;
/**
 * Read the visible viewport. `visualViewport` is authoritative on mobile: it
 * shrinks when the on-screen keyboard opens, while the layout viewport does
 * not.
 * @returns the visual viewport box, or the window's own size as a fallback.
 */
export declare function readViewport(): ViewportBox;
/** A `matchMedia`-shaped target, injected so the media helper stays testable. */
export interface MediaTarget {
    matchMedia?: (query: string) => {
        readonly matches: boolean;
    };
}
/**
 * Whether the pointer is coarse (a finger). Touch devices get no hover: the
 * popover opens on tap instead, and stays until a tap outside closes it.
 * @param target - media-query source; defaults to the current window.
 * @returns true for touch-primary devices.
 */
export declare function prefersCoarsePointer(target?: MediaTarget): boolean;
