/**
 * Policy for the settings page's "catalog still warming up" re-read.
 *
 * The Host answers `GET /api/magpie-models` before its catalog has warmed, with
 * a `pending` snapshot. The page re-reads until it turns `ready`, but the first
 * version retried a *full* load (settings **and** models) every second for 20
 * rounds. Each round unconditionally wrote `baseUrl`/`apiKey` back from the
 * server, so a user editing the URL had their keystrokes overwritten about once
 * a second — the field looked like it "auto-typed" the stored value. Extracted
 * here so the policy is testable and the page cannot regress it.
 */
/** Status emitted by the catalog while no live directory has landed yet. */
export type SnapshotStatus = {
    status?: string;
} | undefined;
/**
 * Gap between pending re-reads. Long enough that a human typing is not fighting
 * the loop, short enough that a local warm-up (usually well under a second) is
 * caught on the first or second try.
 */
export declare const PENDING_RETRY_DELAY_MS = 1500;
/**
 * Cap on re-reads. 20 rounds (~20 s) was both noisy and pointless: a gateway
 * that is genuinely unreachable does not become reachable by polling, and the
 * directory has its own refresh loop. Six rounds span ~9 s — plenty for a cold
 * local catalog, far short of twenty seconds of churn.
 */
export declare const PENDING_RETRY_LIMIT = 6;
/**
 * Whether a pending snapshot still warrants another read.
 *
 * Only `pending` retries: `ready`/`stale`/`error` are terminal — `stale` means a
 * directory exists (re-reading would not change it), and `error` needs a user
 * action (fix the URL/key), not a spin.
 * @param snapshot - the catalog snapshot from the last models read.
 * @param attempts - how many retries have already been scheduled.
 * @param limit - maximum retries; defaults to {@link PENDING_RETRY_LIMIT}.
 */
export declare function shouldRetryPending(snapshot: SnapshotStatus, attempts: number, limit?: number): boolean;
