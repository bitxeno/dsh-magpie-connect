import { type DshMagpieConnectConfig } from './config.ts';
/**
 * dsh-magpie-connect DSH cordis plugin entry.
 *
 * Registers a DSH LlmAdapter streaming directly from the Magpie LAN gateway
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
}
export declare const name = "dsh-magpie-connect";
export declare const inject: readonly ["llm"];
/** Browser-facing REST root for the settings page (served under the shared /api channel). */
export declare const SETTINGS_API = "/api/magpie-settings";
export declare const MODELS_API = "/api/magpie-models";
export declare const TEST_API = "/api/magpie-test";
export declare function apply(ctx: PluginContext, config?: DshMagpieConnectConfig): {
    ready: Promise<{
        version: string;
    }>;
};
export { MagpieAdapter } from './adapter/magpie-adapter.ts';
export { ModelCatalog } from './adapter/catalog.ts';
export { SettingsStore, isConfigured, resolveEffectiveEndpoint } from './settings.ts';
export { resolveConfig, type DshMagpieConnectConfig, } from './config.ts';
