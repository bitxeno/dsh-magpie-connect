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
    /**
     * Versioned API root, e.g. `http://127.0.0.1:3425/v1`. The version is part of
     * the value, not something this plugin adds: a gateway that later serves
     * `/v2` or `/v3` is reached by changing this one string. Trailing slashes are
     * stripped; the path is kept.
     */
    baseUrl?: string;
    /**
     * Gateway credential. Required: an empty key leaves the plugin unconfigured
     * even though `baseUrl` has a default, so the picker stays empty until it is
     * set (both are required by `isConfigured`).
     */
    apiKey?: string;
    /**
     * Plugin state directory (status snapshot, settings file, catalog cache).
     * Defaults to `~/.dsh-magpie-connect`.
     */
    dataDir?: string;
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
    readonly baseUrl: "http://127.0.0.1:3425/v1";
    readonly apiKey: "";
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
    dataDir: string;
};
export declare function resolveConfig(config?: DshMagpieConnectConfig): ResolvedConfig;
