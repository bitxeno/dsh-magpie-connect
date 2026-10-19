import { ModelCatalog } from './adapter/catalog.ts';
import { type DshMagpieConnectConfig } from './config.ts';
import { SettingsStore } from './settings.ts';
/**
 * dsh-magpie-connect DSH cordis plugin entry.
 *
 * Registers a DSH LlmAdapter streaming directly from the Magpie gateway
 * (marketplace shape: no child process, no binary, no proxy). The model
 * catalog warms up in the background (live gateway list with disk cache +
 * static snapshot fallback).
 *
 * The Settings sidebar page (client half) talks to the REST routes below:
 * connection endpoint (baseUrl/apiKey) applies live without restart, and the
 * hidden-model list filters the picker immediately.
 *
 * dispose(): stop the catalog refresh loop. The cordis fiber disposal
 * guarantees this runs on plugin reload/unload and on DSH shutdown.
 */
export interface PluginContext {
    logger: {
        info(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        error(...args: unknown[]): void;
    };
    llm?: {
        registerAdapter(providers: string[], adapter: unknown): unknown;
    };
    get?(key: string): unknown;
    inject?(deps: string[], fn: (ctx: Record<string, unknown>) => unknown): unknown;
    effect?(fn: () => () => void): unknown;
    on?(event: string, listener: (...args: never[]) => unknown): () => void;
    /**
     * Cordis `ctx.emit` (mixed in from the events service). Used to publish
     * `llm/adapters-updated` when this plugin's own catalog moves, without
     * touching the adapter registry.
     */
    emit?(event: string, ...args: unknown[]): unknown;
}
export declare const name = "dsh-magpie-connect";
export declare const inject: readonly ["llm"];
/** Browser-facing REST root for the settings page (served under the shared /api channel). */
export declare const SETTINGS_API = "/api/magpie-settings";
export declare const MODELS_API = "/api/magpie-models";
export declare const TEST_API = "/api/magpie-test";
/**
 * Candidate discovery: asks the endpoint the form currently shows (including a
 * key typed but not yet saved) what it serves. The reply is candidates the
 * user picks from — never configuration written behind them.
 */
export declare const DISCOVER_API = "/api/magpie-discover";
/** Backend generation behind the shared settings routes (newest wins). */
export interface SettingsBackend {
    store: SettingsStore;
    catalog: ModelCatalog;
    patchEndpoint: {
        baseUrl: string;
        apiKey: string;
    };
    effective: () => {
        baseUrl: string;
        apiKey: string;
    };
    applyPageSettings: () => void;
}
interface ModelRow {
    id: string;
    displayName: string;
    contextWindow?: number;
    maxTokens?: number;
    image: boolean;
    responsesOnly: boolean;
    reasoning: boolean;
    efforts: string[];
    /** Whether the allowlist currently offers this model in the picker. */
    enabled: boolean;
    /**
     * What lists this id right now: `'gateway'` (the live directory), `'static'`
     * (only the built-in snapshot) or `'none'` (nothing does — a hidden id the
     * gateway has dropped). The page labels the last two so a stale row cannot be
     * mistaken for a model the gateway still serves. Candidates from the discover
     * route leave it unset: they come from the gateway by construction.
     */
    source?: 'gateway' | 'static' | 'none';
}
/** One discovered candidate: a {@link ModelRow} without this plugin's own allowlist flag. */
export type CandidateRow = Omit<ModelRow, 'enabled'>;
/** @internal Test hook: forget installed routes so the next apply reinstalls. */
export declare function __resetSettingsRoutes(): void;
export declare function apply(ctx: PluginContext, config?: DshMagpieConnectConfig): {
    ready: Promise<{
        version: string;
    }>;
};
export { MagpieAdapter } from './adapter/magpie-adapter.ts';
export { ModelCatalog } from './adapter/catalog.ts';
export { SettingsStore, isConfigured, resolveEffectiveEndpoint } from './settings.ts';
export { resolveConfig, type DshMagpieConnectConfig, } from './config.ts';
