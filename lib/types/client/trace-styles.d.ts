/**
 * Stylesheet for the routing popover's live "processing" border.
 *
 * The web server serves exactly one file per client plugin, so the keyframes,
 * the marching-dashes frame and the curved branch wires are injected once
 * with a stable id (HMR-safe). The dash effect mirrors Magpie's
 * `.rt-wires path.live`: `stroke-dasharray: 3 5` + a `stroke-dashoffset`
 * loop of one dash period. No literal colours: everything goes through the
 * shared `--dsw-alias-*` tokens so light/dark themes keep their own brand.
 */
/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export declare const TRACE_STYLE_ID = "dsh-magpie-connect-trace-style";
/** Inject the stylesheet once (stable id; HMR-safe). */
export declare function adoptTraceStyles(): void;
