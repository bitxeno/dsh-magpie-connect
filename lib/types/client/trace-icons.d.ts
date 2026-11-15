/**
 * The routing popover's icons: the plugin's Magpie mark for the button and
 * three dot/arrow glyphs the rows recolor through `currentColor`. Inline SVG
 * only — the web server serves one file per client plugin, so no separate
 * asset may exist.
 */
/** The Magpie bird, as the composer button draws it. */
export declare function TraceBirdIcon(): unknown;
/**
 * The Magpie bird in three clipped parts (body / tail / wing), as magpie's
 * own `.sk-bird` draws it while a view loads: the wing flaps (`sk-flap`),
 * the body and tail stand still. Same source art as {@link TraceBirdIcon};
 * the clip paths are magpie's own (44×44 viewBox).
 */
export declare function TraceBirdLoadingIcon(): unknown;
/** A status dot: a filled circle the row colors through `currentColor`. */
export declare function TraceDotIcon(): unknown;
/** Magpie's hollow dot for a candidate that is ready but not in use. */
export declare function TraceHollowDotIcon(): unknown;
/** Magpie's "one model fanning out to several providers" routing-group glyph. */
export declare function TraceFanIcon(): unknown;
/** Magpie's generic provider mark, used when a logo is absent or fails to load. */
export declare function TraceGenericIcon(): unknown;
/** The "open in a new tab" link glyph beside the routing title. */
export declare function TraceLinkIcon(): unknown;
/** The "asked → served" arrow between two model names. */
export declare function TraceArrowIcon(): unknown;
