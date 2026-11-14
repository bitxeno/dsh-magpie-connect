/**
 * The routing-trace fetcher: reads the gateway's own view of its routing —
 * the request ledger (`/v1/magpie/usage/requests`) and the accounts'
 * allowances (`/v1/magpie/quotas`) — and compresses both into the small
 * {@link TraceView} the composer popover shows.
 *
 * Both endpoints answer this machine and, while Magpie shares on the local
 * network, another machine too — but always with the gateway key, so the
 * fetch runs on the host, never in the browser (CORS would refuse the page,
 * and the key must not cross to it).
 *
 * `{gateway}` is the configured API base with its version segment removed:
 * `http://api.lan/v1` → `http://api.lan` — the popover contract's "base_url".
 */
import { type EffectiveEndpoint } from './settings.ts';
import type { TraceStatus, TraceView } from './trace-contract.ts';
/** Request rows one popover shows; the gateway returns newest first. */
export declare const TRACE_REQUEST_ROWS = 8;
/** Account rows one popover shows; the list scrolls past the cap. */
export declare const TRACE_ACCOUNT_ROWS = 14;
/** In-flight rows one popover shows; the own session's row is kept first. */
export declare const TRACE_ACTIVE_ROWS = 5;
/** How long one fetch may take before the popover shows "unreachable". */
export declare const TRACE_TIMEOUT_MS = 8000;
/**
 * The gateway base the trace endpoints hang off: the configured API base
 * with its trailing version segment (`/v1`, `/v1/`, `/v2`) removed. The
 * version is part of the API root, not of the gateway address, and the
 * `/v1/magpie/*` namespace lives on the address alone.
 * @param baseUrl - the configured versioned API root (`http://host:port/v1`).
 * @returns the base for `/v1/magpie/*` (origin plus any non-version prefix path), or `undefined` for values that never were URLs.
 */
export declare function deriveGatewayBase(baseUrl: string): string | undefined;
/**
 * Read one provider icon from Magpie Web through the stored Web Key. The
 * browser asks the plugin's same-origin `/api/magpie-icon` route instead of
 * loading a cross-origin image that would miss the Web cookie.
 */
export declare function fetchWebIcon(base: string, webKey: string, name: string, signal: AbortSignal): Promise<{
    body: ArrayBuffer;
    contentType: string;
}>;
/**
 * Fetch the full Web trace when a Web Key is configured, then add quotas;
 * otherwise fall back to the gateway-key-only ledger/concurrency view. The
 * session route is a final fallback if the full trace is unavailable.
 * A full-trace auth failure is shown beside the fallback data rather than
 * hiding the gateway-key view: the Web Key is optional and can be stale.
 * @param endpoint - effective API endpoint (page settings over patch config).
 * @param signal - caller lifetime; the popover aborts on close.
 * @param session - DSH session id to find its route in the full trace.
 * @param webKey - optional Magpie Web Key, stored server-side only.
 * @returns the compressed view, always with a status.
 */
export declare function fetchTraceView(endpoint: EffectiveEndpoint, signal: AbortSignal, session?: string, webKey?: string): Promise<TraceView>;
/** Narrow an unknown value onto the wire status list (client decode). */
export declare function asTraceStatus(value: unknown): TraceStatus;
