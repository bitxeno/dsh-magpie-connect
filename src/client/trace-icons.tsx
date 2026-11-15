/**
 * The routing popover's icons: the plugin's Magpie mark for the button and
 * three dot/arrow glyphs the rows recolor through `currentColor`. Inline SVG
 * only — the web server serves one file per client plugin, so no separate
 * asset may exist.
 */

import { BIRD_PATH } from './nav-icon.ts'

/** The Magpie bird, as the composer button draws it. */
export function TraceBirdIcon(): unknown {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 44 44" fill="currentColor" aria-hidden="true" focusable="false">
      <path fillRule="evenodd" d={BIRD_PATH} />
    </svg>
  )
}

/**
 * The Magpie bird in three clipped parts (body / tail / wing), as magpie's
 * own `.sk-bird` draws it while a view loads: the wing flaps (`sk-flap`),
 * the body and tail stand still. Same source art as {@link TraceBirdIcon};
 * the clip paths are magpie's own (44×44 viewBox).
 */
export function TraceBirdLoadingIcon(): unknown {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 44 44" fill="currentColor" aria-hidden="true" focusable="false" data-magpie-trace-bird>
      <g clipPath="url(#dsh-magpie-connect-bird-body)">
        <path fillRule="evenodd" d={BIRD_PATH} />
      </g>
      <g className="dsh-magpie-connect-bird-tail" clipPath="url(#dsh-magpie-connect-bird-tail)">
        <path fillRule="evenodd" d={BIRD_PATH} />
      </g>
      <g className="dsh-magpie-connect-bird-wing" clipPath="url(#dsh-magpie-connect-bird-wing)">
        <path fillRule="evenodd" d={BIRD_PATH} />
      </g>
      <defs>
        <clipPath id="dsh-magpie-connect-bird-body">
          <path clipRule="evenodd" d="M16 0H44V44H0V26.4H10.6L13 24.2L16 19Z M29.8 18.3L26 19L22 21L17 23.5L14.6 24.7L10.6 26.4L6 29V32L9 31.5L12.5 32L16.4 31.8L19 31.4L24 28.8L28.5 24L30.6 21.4Z" />
        </clipPath>
        <clipPath id="dsh-magpie-connect-bird-tail">
          <path d="M0 0H17L17.2 19.6L14 25L10.6 26.4H0Z" />
        </clipPath>
        <clipPath id="dsh-magpie-connect-bird-wing">
          <path d="M29.8 18.3L26 19L22 21L17 23.5L14.6 24.7L10.6 26.4L6 29V32L9 31.5L12.5 32L16.4 31.8L19 31.4L24 28.8L28.5 24L30.6 21.4Z" />
        </clipPath>
      </defs>
    </svg>
  )
}

/** A status dot: a filled circle the row colors through `currentColor`. */
export function TraceDotIcon(): unknown {
  return (
    <svg width={8} height={8} viewBox="0 0 8 8" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx={4} cy={4} r={3.4} />
    </svg>
  )
}

/** Magpie's hollow dot for a candidate that is ready but not in use. */
export function TraceHollowDotIcon(): unknown {
  return (
    <svg width={8} height={8} viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" focusable="false">
      <circle cx={4} cy={4} r={3.25} />
    </svg>
  )
}

/** Magpie's "one model fanning out to several providers" routing-group glyph. */
export function TraceFanIcon(): unknown {
  const dot = (x: number, y: number): string => `M${x - 1.4} ${y}a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0`
  const path = [
    dot(2.9, 8), dot(13.1, 3.4), dot(13.1, 8), dot(13.1, 12.6),
    'M4.3 8h7.4',
    'M4.3 8c2.6 0 3.2-4.6 5.8-4.6h1.6',
    'M4.3 8c2.6 0 3.2 4.6 5.8 4.6h1.6',
  ].join(' ')
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  )
}

/** Magpie's generic provider mark, used when a logo is absent or fails to load. */
export function TraceGenericIcon(): unknown {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M8 2.2 13.2 5.1v5.8L8 13.8 2.8 10.9V5.1Z M8 8v5.8 M2.8 5.1 8 8l5.2-2.9" />
    </svg>
  )
}

/** The "open in a new tab" link glyph beside the routing title. */
export function TraceLinkIcon(): unknown {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" focusable="false">
      <path d="M4.5 1.5h6v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 1.5 5 7" strokeLinecap="round" />
      <path d="M8.5 9.2v1.3H1.5V3.5h1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** The "asked → served" arrow between two model names. */
export function TraceArrowIcon(): unknown {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" focusable="false">
      <path d="M1.5 5h7M6 2.5 8.5 5 6 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
