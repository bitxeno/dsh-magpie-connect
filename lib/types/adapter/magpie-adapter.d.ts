import { ModelCatalog } from './catalog.ts';
import { type HarnessChunk, type PiEvent } from './events.ts';
import { type AttachmentStore, type HarnessGenerateOptions } from './messages.ts';
/**
 * Magpie LAN gateway adapter: registers as a DSH LlmAdapter and streams
 * directly from `{baseUrl}/v1` — chat completions for most models plus the
 * Responses API for responses-only models (Muse Spark / Codex / Grok lanes).
 *
 * Adapter contract: dsh-llm LlmAdapter (providerInfo/listModels/resolveModel/
 * prepareCall/stream) — structural, no host import.
 *
 * Images resolve through the harness attachment service; thinking levels come
 * from the gateway catalog and forward verbatim (including the `none`/`ultra`
 * extensions pi-ai does not model).
 */
/** Structural pi-ai provider surface the adapter consumes. */
export interface PiProviderLike {
    stream(model: unknown, context: unknown, options: unknown): AsyncIterable<PiEvent>;
    streamSimple(model: unknown, context: unknown, options: unknown): AsyncIterable<PiEvent>;
}
/** Live endpoint read per request so the settings page applies without restart. */
export interface RuntimeEndpoint {
    /** Gateway origin, e.g. `http://api.lan` (no trailing slash). */
    baseUrl(): string;
    /** Bearer key sent to the gateway. */
    apiKey(): string;
}
export declare const PROVIDER_ID = "dsh-magpie-connect";
/** Default picker label for the default route id. */
export declare const DEFAULT_DISPLAY_NAME = "magpie";
export interface MagpieModelInfo {
    id: string;
    name: string;
    contextWindow: number;
    maxTokens: number;
}
export interface CatalogLike {
    list(): string[];
    decision(model: string): {
        allowed: boolean;
        source: string;
        known: boolean;
    };
    getEntry?(model: string): {
        nativeEndpoints: string[];
    } | undefined;
    reasoningFor?(model: string): {
        efforts: Array<{
            id: string;
            name: string;
            description?: string;
        }>;
        defaultEffort: string;
    } | undefined;
    thinks?(model: string): boolean;
    supportsImage?(model: string): boolean;
    supportsEffort?(model: string, effort: string): boolean;
    requiresResponsesApi?(model: string): boolean;
    contextWindowFor?(model: string): number;
    maxTokensFor?(model: string): number;
}
/** Connection-setup retries (429/5xx with backoff, interruptible by abort). */
export declare const DEFAULT_MAX_RETRIES = 2;
/** Overall SDK request cap (replaces the OpenAI SDK 10 min default). */
export declare const DEFAULT_TIMEOUT_MS = 300000;
/** Max wait for the first upstream event (queueing happens here). */
export declare const DEFAULT_FIRST_EVENT_TIMEOUT_MS = 90000;
/** Max silence between upstream events once streaming. */
export declare const DEFAULT_IDLE_TIMEOUT_MS = 60000;
/**
 * Plan the wire `reasoning_effort` for one request. Returns the effort to
 * send via `provider.stream`, or undefined to omit the field (gateway
 * default applies).
 *
 * - `off` aliases `none` (explicitly disable thinking).
 * - `none` sends only when the model lists it; otherwise omitted.
 * - `ultra` sends when listed; otherwise degrades to the highest listed
 *   strength level (`max` → … → `minimal`).
 * - Known strength levels send verbatim when listed or when the model thinks
 *   without a ladder (gateway decides); otherwise clamped up-then-down to
 *   the nearest listed level so a stale remembered value never 400s.
 * - Unknown values and non-reasoning models omit.
 */
export declare function planReasoningEffort(requested: unknown, model: string, catalog: Pick<CatalogLike, 'thinks' | 'supportsEffort' | 'reasoningFor'>): string | undefined;
export declare class MagpieAdapter {
    #private;
    constructor(catalog: CatalogLike, options?: {
        magpieBaseUrl?: string;
        baseUrl?: string;
        providerOverride?: unknown;
        /** Route id registered into DSH (model `provider` field + pi-ai provider tag). */
        providerId?: string;
        /** Display name reported via providerInfo (model picker grouping label). */
        displayName?: string;
        /** Gateway credential (LAN needs none). */
        apiKey?: string;
        /**
         * Live endpoint read per request (settings page). Falls back to the
         * static `magpieBaseUrl`/`apiKey` options when absent.
         */
        runtime?: RuntimeEndpoint;
        /** Connection-setup retries for 429/5xx (default 2). */
        maxRetries?: number;
        /** Overall SDK request cap in ms (default 300000). */
        timeoutMs?: number;
        /** Stall watchdog: max wait for the first upstream event in ms (default 90000; <=0 disables). */
        firstEventTimeoutMs?: number;
        /** Stall watchdog: max silence between upstream events in ms (default 60000; <=0 disables). */
        idleTimeoutMs?: number;
        /** Harness attachment service for image bytes (wired in index.ts). */
        resolveAttachments?: () => AttachmentStore | undefined;
    });
    providerInfo(provider: string): {
        id: string;
        name: string;
    };
    /**
     * dsh-llm calls this unconditionally at registration.
     * undefined = the host default retry policy.
     */
    providerRetryPolicy(_provider: string): undefined;
    /** Advisory catalog for the DSH model picker (deduped; dsh-llm rejects duplicates). */
    listModels(provider: string): Array<{
        provider: string;
        id: string;
        name: string;
        inputModalities: string[];
    }>;
    resolveModel(provider: string, model: string): {
        provider: string;
        id: string;
        name: string;
        inputModalities: string[];
        context: {
            contextWindow: number;
        };
        defaultMaxTokens: number;
        reasoning?: {
            efforts: ReadonlyArray<{
                id: string;
                name: string;
                description?: string;
            }>;
            defaultEffort?: string;
        };
    };
    prepareCall(provider: string, model: string, _signal?: AbortSignal): Promise<{
        model: ReturnType<MagpieAdapter['resolveModel']>;
        stream: (options: HarnessGenerateOptions) => AsyncGenerator<HarnessChunk>;
    }>;
    /**
     * Stream one chat turn from the Magpie gateway: a single pi-ai stream,
     * translated to harness chunks verbatim. Upstream failures (rate limit,
     * auth, timeout, transport) arrive as classified finish reasons, and
     * turn-level retries stay owned by DSH.
     *
     * A stall watchdog races every upstream event against a timer: on expiry
     * the upstream is aborted and the turn ends fast with a TIMEOUT error
     * instead of hanging to the SDK/harness timeout.
     */
    stream(options: HarnessGenerateOptions): AsyncGenerator<HarnessChunk>;
    /** Expose the live catalog snapshot for diagnostics. */
    catalogStatus(): {
        total: number;
        exposed: number;
    };
    decisionFor(model: string): {
        allowed: boolean;
        source: string;
    };
}
/** Build the adapter over a live catalog. */
export declare function createMagpieAdapter(catalog: ModelCatalog): MagpieAdapter;
