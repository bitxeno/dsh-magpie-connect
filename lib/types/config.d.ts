/**
 * Plugin configuration (cordis config object, injected via cordis.patch.yml).
 *
 * The adapter registers a DSH LlmAdapter streaming directly from the Magpie
 * LAN gateway (`{baseUrl}/v1`): chat completions for most models plus the
 * Responses API for responses-only models. No child process, no proxy/pool.
 * The LAN gateway needs no credential — `apiKey` defaults to a sentinel that
 * satisfies the pi-ai client without changing the wire.
 */
export interface DshMagpieConnectConfig {
    /**
     * Provider route id registered into DSH (the grouping key in the model
     * picker). Changing it after sessions already reference the old id will
     * orphan those model selections — prefer `displayName` for a cosmetic
     * rename.
     */
    providerId?: string;
    /**
     * Display name shown in the model picker for this provider.
     * Defaults to the explicit `providerId` when one is given,
     * otherwise to `'magpie'`.
     */
    displayName?: string;
    /** Gateway origin, e.g. `http://api.lan`. `/v1` is appended when missing. */
    baseUrl?: string;
    /** Gateway credential; LAN needs none. Sent as the Bearer key. */
    apiKey?: string;
    /** Model list refresh interval in seconds. */
    refreshSeconds?: number;
    /**
     * Connection-setup retries for transient upstream failures (429/5xx with
     * backoff). Turn-level retries stay owned by DSH.
     */
    maxRetries?: number;
    /** Overall upstream request cap in milliseconds. */
    timeoutMs?: number;
    /**
     * Stall watchdog: max wait for the first upstream event in milliseconds
     * (queueing happens here). Non-positive disables that phase.
     */
    firstEventTimeoutMs?: number;
    /**
     * Stall watchdog: max silence between upstream events in milliseconds.
     * Non-positive disables that phase.
     */
    idleTimeoutMs?: number;
}
export declare const defaults: {
    readonly providerId: "dsh-magpie-connect";
    readonly displayName: "magpie";
    readonly baseUrl: "http://api.lan";
    readonly apiKey: "not-needed";
    readonly refreshSeconds: 300;
    readonly maxRetries: 2;
    readonly timeoutMs: 300000;
    readonly firstEventTimeoutMs: 90000;
    readonly idleTimeoutMs: 60000;
};
export type ResolvedConfig = Required<Pick<DshMagpieConnectConfig, 'providerId' | 'refreshSeconds'>> & DshMagpieConnectConfig & {
    displayName: string;
    baseUrl: string;
    apiKey: string;
};
export declare function resolveConfig(config?: DshMagpieConnectConfig): ResolvedConfig;
