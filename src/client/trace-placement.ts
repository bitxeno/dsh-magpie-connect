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
export const POPUP_WIDTH = 320

/** Height cap of the popover in CSS pixels. */
export const POPUP_MAX_HEIGHT = 420

/** Distance between the button and the popover. */
export const POPUP_GAP = 8

/** Keep-out margin between the popover and the viewport edges. */
export const POPUP_MARGIN = 8

/** A box in viewport coordinates (a `DOMRect` subset). */
export interface Box {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/** The visible viewport: offset and size (a `visualViewport` subset). */
export interface ViewportBox extends Box {
  readonly width: number
  readonly height: number
}

/** How the popover is attached to the button. */
export type PopupSide = 'above' | 'below' | 'sheet'

/** The fitted popover box, as offsets relative to the anchor's box. */
export interface PopupPlacement {
  readonly side: PopupSide
  /** Left edge relative to the anchor's left edge. */
  readonly offsetLeft: number
  readonly width: number
  readonly maxHeight: number
  /** Top edge relative to the anchor's top edge (below only). */
  readonly offsetTop?: number
  /** Bottom edge relative to the anchor's bottom edge (above and sheet). */
  readonly offsetBottom?: number
}

/** Clamp `value` into `[min, max]`, preferring `min` when the range is empty. */
const clamp = (value: number, min: number, max: number): number =>
  max < min ? min : Math.min(Math.max(value, min), max)

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
export function computePopupPlacement(anchor: Box, clip: Box): PopupPlacement {
  const clipWidth = Math.max(0, clip.right - clip.left)
  const clipHeight = Math.max(0, clip.bottom - clip.top)
  const innerTop = clip.top + POPUP_MARGIN
  const innerBottom = clip.bottom - POPUP_MARGIN
  const aboveSpace = anchor.top - POPUP_GAP - innerTop
  const belowSpace = innerBottom - anchor.bottom - POPUP_GAP

  if (aboveSpace < POPUP_MARGIN && belowSpace < POPUP_MARGIN) {
    const width = Math.max(0, Math.min(POPUP_WIDTH, clipWidth - 2 * POPUP_MARGIN))
    const bottom = Math.max(innerTop, innerBottom)
    return {
      side: 'sheet',
      offsetLeft: clip.left + (clipWidth - width) / 2 - anchor.left,
      offsetBottom: anchor.bottom - bottom,
      width,
      maxHeight: Math.min(POPUP_MAX_HEIGHT, Math.max(0, bottom - innerTop)),
    }
  }

  const above = aboveSpace >= belowSpace
  const width = Math.max(0, Math.min(POPUP_WIDTH, clipWidth - 2 * POPUP_MARGIN))
  const left = clamp(
    anchor.right - width,
    clip.left + POPUP_MARGIN,
    clip.right - POPUP_MARGIN - width,
  )
  const wanted = Math.min(POPUP_MAX_HEIGHT, Math.max(0, above ? aboveSpace : belowSpace))
  if (above) {
    const bottom = Math.min(anchor.top - POPUP_GAP, innerBottom)
    const top = Math.max(bottom - wanted, innerTop)
    return {
      side: 'above',
      offsetLeft: left - anchor.left,
      offsetBottom: anchor.bottom - bottom,
      width,
      maxHeight: Math.max(0, bottom - top),
    }
  }
  const top = Math.max(anchor.bottom + POPUP_GAP, innerTop)
  const bottom = Math.min(top + wanted, innerBottom)
  return {
    side: 'below',
    offsetLeft: left - anchor.left,
    offsetTop: top - anchor.top,
    width,
    maxHeight: Math.max(0, bottom - top),
  }
}

/** The intersection of two boxes, or an empty box at `b`'s top-left. */
function intersectBoxes(a: Box, b: Box): Box {
  const top = Math.max(a.top, b.top)
  const left = Math.max(a.left, b.left)
  const right = Math.min(a.right, b.right)
  const bottom = Math.min(a.bottom, b.bottom)
  return { top, left, right: Math.max(left, right), bottom: Math.max(top, bottom) }
}

/**
 * The popover's clipping box: the visible viewport intersected with the
 * nearest scrolling ancestor. An absolutely positioned popover is clipped by
 * that ancestor, so fitting to the viewport alone still truncates it.
 * @param element - the popover's anchor wrapper.
 * @param viewport - the visible viewport.
 * @returns the box the popover must stay inside.
 */
export function clipBoxFor(element: Element, viewport: ViewportBox): Box {
  let box: Box = viewport
  let node = element.parentElement
  while (node !== null && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      const rect = node.getBoundingClientRect()
      box = intersectBoxes(viewport, { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom })
      break
    }
    node = node.parentElement
  }
  return box
}

/**
 * Read the visible viewport. `visualViewport` is authoritative on mobile: it
 * shrinks when the on-screen keyboard opens, while the layout viewport does
 * not.
 * @returns the visual viewport box, or the window's own size as a fallback.
 */
export function readViewport(): ViewportBox {
  const visual = window.visualViewport
  if (visual !== null && visual !== undefined) {
    return {
      top: visual.offsetTop,
      left: visual.offsetLeft,
      width: visual.width,
      height: visual.height,
      bottom: visual.offsetTop + visual.height,
      right: visual.offsetLeft + visual.width,
    }
  }
  return {
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    bottom: window.innerHeight,
    right: window.innerWidth,
  }
}

/** A `matchMedia`-shaped target, injected so the media helper stays testable. */
export interface MediaTarget {
  matchMedia?: (query: string) => { readonly matches: boolean }
}

/**
 * Whether the pointer is coarse (a finger). Touch devices get no hover: the
 * popover opens on tap instead, and stays until a tap outside closes it.
 * @param target - media-query source; defaults to the current window.
 * @returns true for touch-primary devices.
 */
export function prefersCoarsePointer(target?: MediaTarget): boolean {
  const matchMedia = (target ?? (typeof window === 'undefined' ? undefined : window))?.matchMedia
  if (typeof matchMedia !== 'function') return false
  return matchMedia('(pointer: coarse)').matches
}
