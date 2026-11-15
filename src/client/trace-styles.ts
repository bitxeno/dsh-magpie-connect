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
export const TRACE_STYLE_ID = 'dsh-magpie-connect-trace-style'

/** The injected stylesheet text. */
const cssText = `
@keyframes dsh-magpie-connect-trace-flow {
  to { stroke-dashoffset: -8; }
}

/* A pixel-sized SVG outline draws the animated dashed rounded border. Its
   viewBox matches the card's CSS pixels, so stroke width, corner radius and
   dash phase are not scaled or clipped at the corners. */
.dsh-magpie-connect-trace-busy-outline {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.dsh-magpie-connect-trace-busy-outline rect {
  fill: none;
  stroke: #00A6B0;
  stroke-width: 1.5px;
  stroke-dasharray: 3 5;
  stroke-linecap: round;
  animation: dsh-magpie-connect-trace-flow 0.7s linear infinite;
}

/* Magpie-style cubic S wires from the group header to each model card.
   The SVG has a pixel-sized viewBox, so paths are not scaled and keep their
   exact positions and stroke width. */
.dsh-magpie-connect-trace-wire {
  fill: none;
  stroke: var(--dsw-alias-border-l2, rgba(128,128,128,0.28));
  stroke-width: 1.5px;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dsh-magpie-connect-trace-wire.is-active {
  stroke: #00A6B0;
}
.dsh-magpie-connect-trace-wire.is-live {
  stroke-dasharray: 3 5;
  animation: dsh-magpie-connect-trace-flow 0.7s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .dsh-magpie-connect-trace-busy-outline rect,
  .dsh-magpie-connect-trace-wire.is-live { animation: none; }
}

/* The loading bird: magpie's own skeleton-bird wing flap while the routing
   view fetches its first answer. Wing origin matches magpie's
   (transform-origin 30px 19.8px in the 44x44 art); the body and tail
   stand still. */
@keyframes dsh-magpie-connect-bird-flap {
  from { transform: rotate(-22deg); }
  to { transform: rotate(18deg); }
}
[data-magpie-trace-bird] .dsh-magpie-connect-bird-wing {
  transform-box: view-box;
  transform-origin: 30px 19.8px;
  animation: dsh-magpie-connect-bird-flap 0.16s ease-in-out infinite alternate;
}
@media (prefers-reduced-motion: reduce) {
  [data-magpie-trace-bird] .dsh-magpie-connect-bird-wing { animation: none; }
}
`

/** Inject the stylesheet once (stable id; HMR-safe). */
export function adoptTraceStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(TRACE_STYLE_ID) !== null) return
  const style = document.createElement('style') as HTMLStyleElement
  style.id = TRACE_STYLE_ID
  style.textContent = cssText
  document.head.appendChild(style)
}
