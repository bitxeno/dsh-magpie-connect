// src/index.ts
import { join as join4 } from "node:path";
import { writeFile as writeFile3 } from "node:fs/promises";

// src/adapter/catalog.ts
import { readFile, rename, rm, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
var KNOWN_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max"];
var EFFORT_ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
var EFFORT_LABELS = {
  none: { name: "None", description: "\u5173\u95ED\u601D\u8003\uFF0C\u76F4\u63A5\u56DE\u7B54" },
  minimal: { name: "Minimal", description: "\u6700\u5C11\u601D\u8003\uFF0C\u6700\u5FEB" },
  low: { name: "Low", description: "\u8F7B\u91CF\u601D\u8003\uFF0C\u9002\u5408\u7B80\u5355\u95EE\u7B54" },
  medium: { name: "Medium", description: "\u9ED8\u8BA4\u6863\u4F4D\uFF0C\u5747\u8861\u8D28\u91CF\u4E0E\u901F\u5EA6" },
  high: { name: "High", description: "\u6DF1\u5EA6\u601D\u8003\uFF0C\u9002\u5408\u590D\u6742\u7F16\u7801" },
  xhigh: { name: "Extra high", description: "\u8D85\u9AD8\u601D\u8003\u5F3A\u5EA6" },
  max: { name: "Max", description: "\u6700\u5F3A\u601D\u8003\uFF08pi-ai \u6863\u4F4D\uFF09\uFF0C\u6700\u6162" },
  ultra: { name: "Ultra", description: "\u6781\u9650\u601D\u8003\uFF08\u7F51\u5173\u76F4\u901A\uFF09\uFF0C\u6700\u6162\u6700\u8D35" }
};
function normalizeEffort(raw) {
  if (typeof raw !== "string") return void 0;
  const level = raw.trim().toLowerCase();
  return EFFORT_ORDER.includes(level) ? level : void 0;
}
function canonicalEfforts(values) {
  if (!Array.isArray(values)) return void 0;
  const out = [];
  for (const value of values) {
    const level = normalizeEffort(typeof value === "object" && value !== null ? value.effort ?? value : value);
    if (level !== void 0 && !out.includes(level)) out.push(level);
  }
  if (out.length === 0) return void 0;
  return EFFORT_ORDER.filter((level) => out.includes(level));
}
function effortsFor(efforts) {
  const allowed = new Set(efforts ?? []);
  return EFFORT_ORDER.filter((level) => allowed.has(level)).map((level) => {
    const label = EFFORT_LABELS[level] ?? { name: level, description: "" };
    return { id: level, name: label.name, description: label.description };
  });
}
function thinkingLevelMapFor(efforts) {
  const allowed = new Set(efforts ?? []);
  const map = { off: null };
  for (const level of KNOWN_EFFORTS) map[level] = allowed.has(level) ? level : null;
  return map;
}
function requiresResponsesApiEntry(nativeEndpoints) {
  const hasCompletions = nativeEndpoints.some((endpoint) => endpoint.includes("/chat/completions"));
  if (hasCompletions) return false;
  return nativeEndpoints.some((endpoint) => endpoint.includes("/responses"));
}
function modelApiForEntry(nativeEndpoints) {
  return requiresResponsesApiEntry(nativeEndpoints) ? "openai-responses" : "openai-completions";
}
function decodeModel(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const record = raw;
  const id = record.id;
  if (typeof id !== "string" || id.length === 0) return void 0;
  const num = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : void 0;
  const displayName = typeof record.display_name === "string" && record.display_name || typeof record.magpie_label === "string" && record.magpie_label || id;
  const contextWindow = num(record.context_window) ?? num(record.context_length) ?? num(record.max_input_tokens);
  const maxTokens = num(record.max_output_tokens);
  const modalities = record.modalities;
  const inputModalities = Array.isArray(modalities?.input) ? modalities.input.map(String).map((s) => s.toLowerCase()) : [];
  const image = inputModalities.includes("image");
  const nativeEndpoints = Array.isArray(record.native_endpoints) ? record.native_endpoints.filter((e) => typeof e === "string") : [];
  const reasoning = record.reasoning === true;
  const levels = record.supported_reasoning_levels;
  const efforts = Array.isArray(levels) ? canonicalEfforts(levels.map((entry) => entry?.effort ?? entry)) : void 0;
  return { id, displayName, ...contextWindow !== void 0 ? { contextWindow } : {}, ...maxTokens !== void 0 ? { maxTokens } : {}, image, nativeEndpoints, reasoning, ...efforts !== void 0 ? { efforts } : {} };
}
function decodeMagpieModels(data) {
  const result = /* @__PURE__ */ new Map();
  if (!data || typeof data !== "object") return result;
  const payload = data;
  if (!Array.isArray(payload.data)) return result;
  for (const raw of payload.data) {
    const entry = decodeModel(raw);
    if (entry && !result.has(entry.id)) result.set(entry.id, entry);
  }
  return result;
}
var staticMagpieModels = [
  { id: "group/auto-gpt-4-1", displayName: "GPT-4.1", contextWindow: 1047576, maxTokens: 32768, image: true, nativeEndpoints: [], reasoning: false },
  { id: "group/auto-gpt-6-luna", displayName: "GPT-6-Luna", contextWindow: 272e3, maxTokens: 128e3, image: true, nativeEndpoints: [], reasoning: true, efforts: ["low", "medium", "high", "xhigh", "max"] },
  { id: "vercel/xiaomi/mimo-v2.6-flash", displayName: "xiaomi/mimo-v2.6-flash", contextWindow: 1048576, maxTokens: 131072, image: true, nativeEndpoints: ["/v1/chat/completions"], reasoning: true },
  { id: "vercel/alibaba/qwen3.8-omni-flash", displayName: "alibaba/qwen3.8-omni-flash", contextWindow: 1e6, maxTokens: 131072, image: true, nativeEndpoints: ["/v1/chat/completions"], reasoning: true, efforts: ["none", "low", "medium", "xhigh"] },
  { id: "vercel/openai/gpt-5.4-nano", displayName: "openai/gpt-5.4-nano", contextWindow: 272e3, maxTokens: 128e3, image: true, nativeEndpoints: ["/v1/chat/completions"], reasoning: true, efforts: ["none", "low", "medium", "high", "xhigh"] },
  { id: "vercel/openai/gpt-4.1", displayName: "openai/gpt-4.1", contextWindow: 1047576, maxTokens: 32768, image: true, nativeEndpoints: ["/v1/chat/completions"], reasoning: false },
  { id: "vercel/google/gemini-2.5-flash-lite", displayName: "google/gemini-2.5-flash-lite", contextWindow: 1048576, maxTokens: 65536, image: true, nativeEndpoints: ["/v1/chat/completions"], reasoning: true, efforts: ["low", "medium", "high"] },
  { id: "opencode-zen/muse-spark-1.3-contributor-free", displayName: "Muse Spark 1.3 Free", contextWindow: 1048576, maxTokens: 131072, image: true, nativeEndpoints: ["/v1/responses"], reasoning: true, efforts: ["minimal", "low", "medium", "high", "xhigh"] },
  { id: "opencode-zen/jev-1.13-free", displayName: "jev-1.13-free", image: false, nativeEndpoints: ["/v1/chat/completions", "/v1/responses", "/v1/messages"], reasoning: false },
  { id: "opencode-zen/mimo-v2.6-flash-free", displayName: "MiMo-V2.6-Flash Free", contextWindow: 2e5, maxTokens: 32e3, image: true, nativeEndpoints: ["/v1/chat/completions", "/v1/responses", "/v1/messages"], reasoning: true },
  { id: "opencode-zen/space-bunny-free", displayName: "Space Bunny Free", contextWindow: 524288, maxTokens: 524288, image: true, nativeEndpoints: ["/v1/chat/completions", "/v1/responses", "/v1/messages"], reasoning: true, efforts: ["low", "medium", "high", "xhigh", "max"] },
  { id: "codex/gpt-6-luna", displayName: "GPT-6-Luna", contextWindow: 272e3, maxTokens: 128e3, image: true, nativeEndpoints: ["/v1/responses"], reasoning: true, efforts: ["low", "medium", "high", "xhigh", "max"] },
  { id: "codex/gpt-5.6-terra", displayName: "GPT-5.6-Terra", contextWindow: 272e3, maxTokens: 128e3, image: true, nativeEndpoints: ["/v1/responses"], reasoning: true, efforts: ["low", "medium", "high", "xhigh", "max", "ultra"] },
  { id: "codex/gpt-5.6-luna", displayName: "GPT-5.6-Luna", contextWindow: 272e3, maxTokens: 128e3, image: true, nativeEndpoints: ["/v1/responses"], reasoning: true, efforts: ["low", "medium", "high", "xhigh", "max"] },
  { id: "codex/gpt-5.5", displayName: "GPT-5.5", contextWindow: 272e3, maxTokens: 128e3, image: true, nativeEndpoints: ["/v1/responses"], reasoning: true, efforts: ["low", "medium", "high", "xhigh"] },
  { id: "copilot/gemini-3.8-flash", displayName: "Gemini 3.8 Flash", contextWindow: 1048576, maxTokens: 65536, image: true, nativeEndpoints: ["/v1/chat/completions"], reasoning: true, efforts: ["low", "medium", "high"] },
  { id: "copilot/grok-4.7", displayName: "grok-4.7", contextWindow: 5e5, maxTokens: 5e5, image: true, nativeEndpoints: ["/v1/responses"], reasoning: true, efforts: ["low", "medium", "high", "xhigh"] },
  { id: "copilot/gpt-4.1", displayName: "gpt-4.1", contextWindow: 1047576, maxTokens: 32768, image: true, nativeEndpoints: ["/v1/chat/completions", "/v1/responses", "/v1/messages"], reasoning: false },
  { id: "copilot/gpt-6-luna", displayName: "gpt-6-luna", contextWindow: 922e3, maxTokens: 128e3, image: true, nativeEndpoints: ["/v1/responses"], reasoning: true, efforts: ["none", "low", "medium", "high", "xhigh", "max"] },
  { id: "copilot/claude-sonnet-5.5", displayName: "claude-sonnet-5.5", contextWindow: 1e6, maxTokens: 128e3, image: true, nativeEndpoints: ["/v1/chat/completions", "/v1/messages"], reasoning: true, efforts: ["low", "medium", "high", "xhigh", "max"] },
  { id: "workbuddy-ai/hy4-preview-f", displayName: "hy4-preview-f", contextWindow: 1e6, maxTokens: 64e3, image: true, nativeEndpoints: ["/v1/chat/completions"], reasoning: true, efforts: ["high"] },
  { id: "workbuddy-ai/deepseek-v4.1-flash", displayName: "deepseek-v4.1-flash", contextWindow: 1e6, maxTokens: 128e3, image: true, nativeEndpoints: ["/v1/chat/completions"], reasoning: true, efforts: ["low", "high", "max"] }
];
var FETCH_TIMEOUT_MS = 3e4;
var ModelCatalog = class {
  #entries = /* @__PURE__ */ new Map();
  #hidden = /* @__PURE__ */ new Set();
  #updatedAt = 0;
  #lastError = "";
  #refreshSeconds;
  #cachePath;
  #baseUrl;
  #fetch;
  #now;
  #timer = null;
  #stopped = false;
  #onRefresh;
  #onInvalidate;
  #startupRetryMs;
  /**
   * Last announced exposed set. The picker caches its catalog read, so an
   * invalidation is only worth a Host event when the exposed ids really
   * moved — otherwise the refresh loop would emit every 5 minutes.
   */
  #announced = "";
  constructor(options = {}) {
    this.#refreshSeconds = options.refreshSeconds ?? 300;
    this.#cachePath = options.cachePath;
    this.#baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
    this.#fetch = options.fetchImpl ?? fetch;
    this.#now = options.now ?? Date.now;
    this.#onRefresh = options.onRefresh;
    this.#onInvalidate = options.onInvalidate;
    this.#startupRetryMs = options.startupRetryMs ?? 15e3;
  }
  /**
   * Start the refresh loop: immediate fetch, fast retries while the live
   * catalog is still empty (the first fetch often races the machine's
   * network coming up), then the normal cadence.
   */
  async start() {
    await this.refreshOnce();
    let attempts = 0;
    while (this.#entries.size === 0 && attempts < 4 && !this.#stopped) {
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, this.#startupRetryMs));
      if (this.#stopped) return;
      await this.refreshOnce();
    }
    if (this.#stopped) return;
    this.#timer = setInterval(() => {
      void this.refreshOnce();
    }, this.#refreshSeconds * 1e3);
    this.#timer.unref?.();
  }
  stop() {
    this.#stopped = true;
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }
  async refreshOnce() {
    await this.refreshModels();
    if (this.#onRefresh) {
      try {
        this.#onRefresh(this.snapshot(), this.#lastError);
      } catch {
      }
    }
    this.#announce();
  }
  /**
   * Announce the exposed set when it changed.
   *
   * DSH's browser-side model directory caches one `modelCatalog()` read per
   * Host generation and only re-reads it on `llm/adapters-updated`, so
   * in-memory catalog mutations (hidden models, a refresh that moved the
   * list) are otherwise invisible until restart. Firing the event on every
   * refresh would also work but wakes the whole picker every 5 minutes, so
   * the exposed ids are fingerprinted and only a real change is announced.
   */
  #announce() {
    const fingerprint = this.#fingerprint();
    if (fingerprint === this.#announced) return;
    this.#announced = fingerprint;
    if (!this.#onInvalidate) return;
    try {
      this.#onInvalidate();
    } catch {
    }
  }
  /** Stable fingerprint of the exposed set (ids + their capabilities). */
  #fingerprint() {
    const rows = this.list().map((id) => {
      const entry = this.#entryFor(id);
      return [
        id,
        entry?.displayName ?? "",
        entry?.image === true ? "img" : "-",
        entry?.reasoning === true ? "think" : "-",
        (entry?.efforts ?? []).join(","),
        String(entry?.contextWindow ?? 0),
        String(entry?.maxTokens ?? 0)
      ].join("|");
    });
    return rows.join("\n");
  }
  /** Whether a gateway origin is configured (empty baseUrl = not configured). */
  get configured() {
    return this.#baseUrl !== "";
  }
  async refreshModels() {
    if (!this.configured) {
      this.#lastError = "magpie gateway baseUrl is not configured \u2014 set it on the Magpie settings page";
      return;
    }
    try {
      const entries = await fetchMagpieModels(this.#baseUrl, this.#fetch);
      this.#entries = entries;
      this.#updatedAt = this.#now();
      this.#lastError = "";
      if (this.#cachePath) await saveModelsCache(this.#cachePath, entries, this.#now()).catch(() => {
      });
    } catch (err) {
      if (this.#cachePath && this.#entries.size === 0) {
        const cached = await loadModelsCache(this.#cachePath).catch(() => null);
        if (cached && cached.size > 0) {
          this.#entries = cached;
          this.#updatedAt = this.#updatedAt === 0 ? this.#now() : this.#updatedAt;
          return;
        }
      }
      this.#lastError = err instanceof Error ? err.message : String(err);
    }
  }
  getEntry(model) {
    return this.#entries.get(model);
  }
  /**
   * Replace the settings-page hidden set (models excluded from the picker).
   * Announces: hiding/showing models changes the exposed list, and DSH's
   * picker only re-reads it on `llm/adapters-updated`.
   */
  setHidden(ids) {
    const next = new Set(ids);
    if (next.size === this.#hidden.size && [...next].every((id) => this.#hidden.has(id))) return;
    this.#hidden = next;
    this.#announce();
  }
  /** Currently hidden model ids. */
  hidden() {
    return [...this.#hidden];
  }
  isHidden(model) {
    return this.#hidden.has(model);
  }
  /** Point the refresh loop at another gateway origin (settings page change). */
  setBaseUrl(baseUrl) {
    const origin = baseUrl.replace(/\/+$/, "");
    if (origin === this.#baseUrl) return;
    this.#baseUrl = origin;
    this.#entries = /* @__PURE__ */ new Map();
    this.#updatedAt = 0;
    this.#lastError = origin === "" ? "magpie gateway baseUrl is not configured \u2014 set it on the Magpie settings page" : "";
    this.#announce();
  }
  get baseUrl() {
    return this.#baseUrl;
  }
  decision(model) {
    if (!this.configured) return { allowed: false, source: "unconfigured", known: false };
    if (this.#hidden.has(model)) return { allowed: false, source: "hidden_by_settings", known: true };
    if (this.#entries.has(model)) return { allowed: true, source: "gateway", known: true };
    const fallback = staticMagpieModels.find((entry) => entry.id === model);
    if (fallback) return { allowed: true, source: "static_verified", known: false };
    return { allowed: false, source: this.#entries.size === 0 ? "gateway_pending" : "gateway_unknown", known: false };
  }
  /** Entry lookup: live map first, static snapshot while configured (never unconfigured). */
  #entryFor(model) {
    if (!this.configured) return void 0;
    return this.#entries.get(model) ?? staticMagpieModels.find((candidate) => candidate.id === model);
  }
  /**
   * Reasoning capability for one model id (DSH `resolveModel().reasoning`
   * + pi-ai `thinkingLevelMap` source of truth). Ladder-less thinking models
   * (reasoning without an effort list) think with upstream defaults — see
   * `thinks()` — and expose no picker.
   */
  reasoningFor(model) {
    const entry = this.#entryFor(model);
    const efforts = entry?.efforts;
    if (!entry?.reasoning) return void 0;
    if (efforts !== void 0 && efforts.length > 0) {
      const mid = efforts[Math.floor(efforts.length / 2)] ?? "medium";
      return { efforts: effortsFor(efforts), defaultEffort: efforts.includes("medium") ? "medium" : mid };
    }
    return void 0;
  }
  /** Whether the wire model may think (pi-ai `reasoning: true`). */
  thinks(model) {
    const entry = this.#entryFor(model);
    return entry?.reasoning ?? false;
  }
  /** Whether the model accepts image input. */
  supportsImage(model) {
    const entry = this.#entryFor(model);
    return entry?.image ?? false;
  }
  /** Whether one effort id is selectable for the model. */
  supportsEffort(model, effort) {
    const entry = this.#entryFor(model);
    if (!entry?.reasoning) return false;
    if (!entry.efforts || entry.efforts.length === 0) return true;
    return entry.efforts.includes(effort);
  }
  requiresResponsesApi(model) {
    const entry = this.#entryFor(model);
    if (!entry) return /muse-spark|codex\/|grok/i.test(model);
    return requiresResponsesApiEntry(entry.nativeEndpoints);
  }
  contextWindowFor(model) {
    return this.#entryFor(model)?.contextWindow ?? 262144;
  }
  maxTokensFor(model) {
    return this.#entryFor(model)?.maxTokens ?? 32768;
  }
  /** ids exposed to DSH: live gateway list minus hidden (empty while unconfigured). */
  list() {
    if (!this.configured) return [];
    if (this.#entries.size === 0) return staticMagpieModels.map((entry) => entry.id).filter((id) => !this.#hidden.has(id));
    return [...this.#entries.keys()].filter((id) => !this.#hidden.has(id)).sort();
  }
  /** Catalog health snapshot (pending/ready/stale + counts). */
  snapshot() {
    const age = this.#updatedAt === 0 ? Infinity : this.#now() - this.#updatedAt;
    const stale = this.#updatedAt !== 0 && age > 10 * 60 * 1e3;
    return {
      status: this.#updatedAt === 0 ? "pending" : stale ? "stale" : "ready",
      total: this.#entries.size,
      exposed: this.list().length,
      ...this.#updatedAt !== 0 ? { lastRefresh: new Date(this.#updatedAt).toISOString() } : {}
    };
  }
  get lastError() {
    return this.#lastError;
  }
};
async function withTimeout(run, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`models endpoint timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function fetchMagpieModels(baseUrl, fetchImpl, options = {}) {
  const response = await withTimeout(
    (signal) => fetchImpl(`${baseUrl.replace(/\/+$/, "")}/v1/models`, {
      headers: { accept: "application/json", ...options.headers ?? {} },
      signal
    }),
    options.timeoutMs ?? FETCH_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`models endpoint returned HTTP ${response.status}`);
  const payload = await response.json();
  const models = decodeMagpieModels(payload);
  if (models.size === 0) throw new Error("models endpoint returned an empty list");
  return models;
}
async function saveModelsCache(path, entries, now) {
  const cache = { updatedAt: now, entries: [...entries.values()] };
  const tmp = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(tmp, JSON.stringify(cache), "utf8");
  await rm(path, { force: true });
  await rename(tmp, path);
}
async function loadModelsCache(path) {
  const raw = JSON.parse(await readFile(path, "utf8"));
  if (Date.now() - raw.updatedAt > 7 * 24 * 60 * 60 * 1e3) {
    throw new Error("gateway cache too old");
  }
  return new Map(raw.entries.map((entry) => [entry.id, entry]));
}
function defaultCachePath(dataDir) {
  return join(dataDir, "magpie-models.json");
}

// src/adapter/magpie-adapter.ts
import { createProvider } from "@earendil-works/pi-ai";
import * as openaiCompletions from "@earendil-works/pi-ai/api/openai-completions";
import * as openaiResponses from "@earendil-works/pi-ai/api/openai-responses";

// src/adapter/events.ts
var CONTEXT_WINDOW_EXCEEDED = "CONTEXT_WINDOW_EXCEEDED";
var EMPTY_RESPONSE = "EMPTY_RESPONSE";
var QUOTA_EXCEEDED = "QUOTA_EXCEEDED";
function classifyError(text) {
  if (/\b(?:401|403)\b/.test(text)) return "AUTH";
  if (/insufficient|quota|billing/i.test(text)) return QUOTA_EXCEEDED;
  if (/\b429\b|rate.?limit/i.test(text)) return "RATE_LIMIT";
  if (/\b413\b|payload too large|request body too large/i.test(text)) return "INVALID_REQUEST";
  if (/\b400\b|invalid.?request/i.test(text)) return "INVALID_REQUEST";
  if (/\b5\d\d\b/.test(text)) return "SERVER";
  if (/\btime(?:d)?\s*out\b|timeout/i.test(text)) return "TIMEOUT";
  if (/\b(?:network|connection|socket|fetch)\b|\bECONN[A-Z]+\b|terminated|premature close/i.test(text)) return "TRANSPORT";
  return "UPSTREAM";
}
function isContextOverflow(message, contextWindow) {
  return message.stopReason === "stop" && message.usage.input > contextWindow;
}
function mapStopReason(message, contextWindow) {
  if (isContextOverflow(message, contextWindow) || message.stopReason === "error" && message.errorMessage !== void 0 && /context/i.test(message.errorMessage) && /exceed|window|length|token/i.test(message.errorMessage)) {
    return {
      kind: "error",
      failure: {
        message: message.errorMessage ?? `pi-ai detected context overflow for model "${message.model}"`,
        code: CONTEXT_WINDOW_EXCEEDED
      }
    };
  }
  switch (message.stopReason) {
    case "stop":
      if (message.content.length === 0) {
        return {
          kind: "error",
          failure: { message: `model "${message.model}" returned a completed response with no content`, code: EMPTY_RESPONSE }
        };
      }
      return { kind: "stop" };
    case "length":
      return { kind: "max-tokens" };
    case "toolUse":
      return { kind: "tool-calls" };
    case "aborted":
      return { kind: "aborted", failure: { message: message.errorMessage ?? "pi-ai stream aborted", code: "ABORTED" } };
    case "error":
      return {
        kind: "error",
        failure: { message: message.errorMessage ?? "pi-ai stream error", code: classifyError(message.errorMessage ?? "") }
      };
  }
}
function mapUsage(usage) {
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    ...usage.cacheRead > 0 ? { cacheReadTokens: usage.cacheRead } : {},
    ...usage.cacheWrite > 0 ? { cacheWriteTokens: usage.cacheWrite } : {}
  };
}
async function* toStreamChunks(events, contextWindow) {
  const toolIds = /* @__PURE__ */ new Map();
  for await (const event of events) {
    switch (event.type) {
      case "start":
        break;
      case "text_start":
        yield { type: "block-start", index: event.contentIndex, blockType: "text" };
        break;
      case "text_delta":
        yield { type: "text-delta", index: event.contentIndex, text: event.delta };
        break;
      case "text_end":
        yield { type: "block-end", index: event.contentIndex, block: { type: "text", text: event.content } };
        break;
      case "thinking_start":
        yield { type: "block-start", index: event.contentIndex, blockType: "reasoning" };
        break;
      case "thinking_delta":
        yield { type: "reasoning-delta", index: event.contentIndex, text: event.delta };
        break;
      case "thinking_end":
        yield { type: "block-end", index: event.contentIndex, block: { type: "reasoning", text: event.content } };
        break;
      case "toolcall_start": {
        const partial = event.partial.content[event.contentIndex];
        const id = partial?.type === "toolCall" ? partial.id ?? "" : "";
        const name2 = partial?.type === "toolCall" ? partial.name ?? "" : "";
        toolIds.set(event.contentIndex, { id, name: name2 });
        yield { type: "block-start", index: event.contentIndex, blockType: "tool-call" };
        break;
      }
      case "toolcall_delta": {
        const known = toolIds.get(event.contentIndex);
        yield {
          type: "tool-call-delta",
          index: event.contentIndex,
          id: known?.id ?? "",
          ...known?.name !== void 0 && known.name.length > 0 ? { name: known.name } : {},
          argumentsDelta: event.delta
        };
        break;
      }
      case "toolcall_end":
        yield {
          type: "block-end",
          index: event.contentIndex,
          block: {
            type: "tool-call",
            id: event.toolCall.id,
            name: event.toolCall.name,
            arguments: JSON.stringify(event.toolCall.arguments)
          }
        };
        break;
      case "done":
        yield { type: "usage", usage: mapUsage(event.message.usage) };
        yield { type: "finish", reason: mapStopReason(event.message, contextWindow) };
        return;
      case "error":
        yield { type: "usage", usage: mapUsage(event.error.usage) };
        yield { type: "finish", reason: mapStopReason(event.error, contextWindow) };
        return;
    }
  }
  throw new Error("dsh-magpie-connect: pi-ai event stream ended without done/error");
}

// src/adapter/messages.ts
var REQUEST_MAX_PIXELS = 2048 * 2048;
var REQUEST_MAX_BYTES = 1024 * 1024;
function zeroUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
  };
}
function parseArguments(raw) {
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { value: parsed };
  } catch {
    return { raw };
  }
}
function contentHasImage(messages) {
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === "image" && block.offloaded !== true) return true;
    }
  }
  return false;
}
function requestImageTarget(ref) {
  const pixels = ref.width * ref.height;
  if (!(pixels > REQUEST_MAX_PIXELS) || !(ref.width > 0 && ref.height > 0)) {
    return { width: ref.width, height: ref.height, maxBytes: REQUEST_MAX_BYTES };
  }
  const scale = Math.sqrt(REQUEST_MAX_PIXELS / pixels);
  return { width: Math.max(1, Math.floor(ref.width * scale)), height: Math.max(1, Math.floor(ref.height * scale)), maxBytes: REQUEST_MAX_BYTES };
}
function imageHandleText(ref, version) {
  const name2 = ref.name ?? `attachment ${String(ref.attachmentId).slice(0, 12)}`;
  return `Image ${name2}; request preview ${version.width}x${version.height}px.`;
}
function offloadedImageText(ref) {
  const name2 = ref.name ?? `attachment ${String(ref.attachmentId).slice(0, 12)}`;
  return `[image omitted (offloaded); ${name2}]`;
}
function toBase64(data) {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("base64");
}
async function prepareRequestImages(messages, attachments, signal) {
  const refs = /* @__PURE__ */ new Map();
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type !== "image") continue;
      const image = block;
      if (image.offloaded === true) continue;
      if (!refs.has(image.attachment.attachmentId)) refs.set(image.attachment.attachmentId, image.attachment);
    }
  }
  const versions = /* @__PURE__ */ new Map();
  await Promise.all(
    [...refs.values()].map(async (ref) => {
      const prepared = await attachments.readImageRequest(ref, requestImageTarget(ref), signal);
      versions.set(ref.attachmentId, {
        data: prepared.data,
        mediaType: prepared.mediaType,
        bytes: prepared.bytes,
        width: prepared.width,
        height: prepared.height
      });
    })
  );
  return versions;
}
function userContentWithImages(blocks, requestImages) {
  const content = [];
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        if (block.text.length > 0) content.push({ type: "text", text: block.text });
        break;
      case "image": {
        const image = block;
        if (image.offloaded === true) {
          content.push({ type: "text", text: offloadedImageText(image.attachment) });
          break;
        }
        const version = requestImages.get(image.attachment.attachmentId);
        if (!version) {
          content.push({ type: "text", text: offloadedImageText(image.attachment) });
          break;
        }
        content.push({ type: "text", text: imageHandleText(image.attachment, version) });
        content.push({ type: "image", data: toBase64(version.data), mimeType: version.mediaType });
        break;
      }
      case "file": {
        const file = block;
        content.push({ type: "text", text: `[file: ${file.attachment.name} (${file.attachment.bytes} bytes)]` });
        break;
      }
      case "tool-result":
        content.push({ type: "text", text: toolResultText(block.content) || "(no output)" });
        break;
      default:
        break;
    }
  }
  if (content.every((block) => block.type === "text")) return content.map((block) => block.text).join("");
  return content;
}
function toPiAssistant(message, providerId, api = "openai-completions") {
  const content = [];
  for (const block of message.content) {
    switch (block.type) {
      case "text":
        content.push({ type: "text", text: block.text });
        break;
      case "reasoning":
        content.push({ type: "thinking", thinking: block.text });
        break;
      case "tool-call": {
        const call = block;
        content.push({ type: "toolCall", id: call.id, name: call.name, arguments: parseArguments(call.arguments) });
        break;
      }
      case "image":
        throw new Error("dsh-magpie-connect: assistant image output cannot be replayed to the model");
      default:
        break;
    }
  }
  const source = message.source;
  return {
    role: "assistant",
    content,
    api,
    provider: source?.kind === "model" && typeof source.provider === "string" ? source.provider : providerId,
    model: source?.kind === "model" && typeof source.model === "string" ? source.model : providerId,
    usage: zeroUsage(),
    stopReason: content.some((block) => block.type === "toolCall") ? "toolUse" : "stop",
    timestamp: 0
  };
}
function flattenText(message) {
  return message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
}
function toolResultText(blocks) {
  return blocks.map((block) => block.type === "text" ? block.text : block.type === "tool-result" ? toolResultText(block.content) : "").join("");
}
function toolsOf(options) {
  const tools = options.tools?.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters }));
  return tools && tools.length > 0 ? tools : void 0;
}
function assistantApiFor(options, entryEndpoints) {
  void options;
  return modelApiForEntry(entryEndpoints);
}
function toPiContext(options, entryEndpoints = []) {
  const providerId = options.provider;
  const assistantApi = assistantApiFor(options, entryEndpoints);
  const toolNames = /* @__PURE__ */ new Map();
  const messages = [];
  for (const message of options.messages) {
    if (message.role === "system") {
      const text2 = flattenText(message);
      if (text2.length > 0) messages.push({ role: "user", content: text2, timestamp: 0 });
      continue;
    }
    if (message.role === "assistant") {
      const assistant = toPiAssistant(message, providerId, assistantApi);
      for (const block of assistant.content) {
        if (block.type === "toolCall") toolNames.set(block.id, block.name);
      }
      messages.push(assistant);
      continue;
    }
    if (message.role === "developer") continue;
    if (message.role === "tool") {
      const text2 = flattenText(message);
      messages.push({
        role: "toolResult",
        toolCallId: message.toolCallId ?? "",
        toolName: message.toolCallId ? toolNames.get(message.toolCallId) ?? "unknown" : "unknown",
        content: [{ type: "text", text: text2 || "(no output)" }],
        isError: message.isError ?? false,
        timestamp: 0
      });
      continue;
    }
    for (const block of message.content) {
      if (block.type === "image") {
        throw new Error("dsh-magpie-connect: image input requires the attachment service (use toPiContextWithImages)");
      }
      if (block.type === "file") {
        continue;
      }
    }
    const text = flattenText(message);
    const fileText = message.content.filter((block) => block.type === "file").map((block) => `[file: ${block.attachment.name}]`).join("\n");
    const combined = [text, fileText].filter((part) => part.length > 0).join("\n");
    const results = message.content.filter((block) => block.type === "tool-result");
    if (combined.length > 0 || results.length === 0) {
      messages.push({ role: "user", content: combined, timestamp: 0 });
    }
    for (const result of results) {
      messages.push({
        role: "toolResult",
        toolCallId: result.toolCallId,
        toolName: toolNames.get(result.toolCallId) ?? "unknown",
        content: [{ type: "text", text: toolResultText(result.content) || "(no output)" }],
        isError: result.isError ?? false,
        timestamp: 0
      });
    }
  }
  const context = { messages };
  if (typeof options.system === "string" && options.system.length > 0) context.systemPrompt = options.system;
  const tools = toolsOf(options);
  if (tools) context.tools = tools;
  return context;
}
async function toPiContextWithImages(options, attachments, entryEndpoints = []) {
  const providerId = options.provider;
  const assistantApi = assistantApiFor(options, entryEndpoints);
  const requestImages = await prepareRequestImages(options.messages, attachments, options.signal);
  const toolNames = /* @__PURE__ */ new Map();
  const messages = [];
  for (const message of options.messages) {
    if (message.role === "system") {
      const text = flattenText(message);
      if (text.length > 0) messages.push({ role: "user", content: text, timestamp: 0 });
      continue;
    }
    if (message.role === "assistant") {
      const assistant = toPiAssistant(message, providerId, assistantApi);
      for (const block of assistant.content) {
        if (block.type === "toolCall") toolNames.set(block.id, block.name);
      }
      messages.push(assistant);
      continue;
    }
    if (message.role === "developer") continue;
    if (message.role === "tool") {
      messages.push({
        role: "toolResult",
        toolCallId: message.toolCallId ?? "",
        toolName: message.toolCallId ? toolNames.get(message.toolCallId) ?? "unknown" : "unknown",
        content: userContentToBlocks(message.content, requestImages),
        isError: message.isError ?? false,
        timestamp: 0
      });
      continue;
    }
    const content = userContentWithImages(message.content, requestImages);
    const results = message.content.filter((block) => block.type === "tool-result");
    if (typeof content === "string" ? content.length > 0 || results.length === 0 : true) {
      messages.push({ role: "user", content, timestamp: 0 });
    } else if (typeof content === "string" && content.length === 0 && results.length === 0) {
      messages.push({ role: "user", content, timestamp: 0 });
    }
    for (const result of results) {
      messages.push({
        role: "toolResult",
        toolCallId: result.toolCallId,
        toolName: toolNames.get(result.toolCallId) ?? "unknown",
        content: userContentToBlocks(result.content, requestImages),
        isError: result.isError ?? false,
        timestamp: 0
      });
    }
  }
  const context = { messages };
  if (typeof options.system === "string" && options.system.length > 0) context.systemPrompt = options.system;
  const tools = toolsOf(options);
  if (tools) context.tools = tools;
  return context;
}
function userContentToBlocks(blocks, requestImages) {
  const converted = userContentWithImages(blocks, requestImages);
  if (typeof converted === "string") return [{ type: "text", text: converted || "(no output)" }];
  return converted.length > 0 ? converted : [{ type: "text", text: "(no output)" }];
}

// src/adapter/watchdog.ts
var TIMED_OUT = Symbol("watchdog-timed-out");
function raceTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
    const t = timer;
    t.unref?.();
  });
  const cleanup = () => clearTimeout(timer);
  return Promise.race([promise.then((value) => {
    cleanup();
    return value;
  }, (err) => {
    cleanup();
    throw err;
  }), timeout]);
}
function stallErrorEvent(model, waitMs, first) {
  const phase = first ? "waiting for the first upstream event" : "waiting for the next upstream event";
  return {
    type: "error",
    error: {
      api: "openai-completions",
      provider: "dsh-magpie-connect",
      model,
      content: [],
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
      stopReason: "error",
      // Must read as a timeout (events.ts classifies on /timeout/i -> TIMEOUT).
      errorMessage: `upstream stream timeout: no upstream events for ${Math.round(waitMs / 1e3)}s while ${phase} (model "${model}") \u2014 the stalled stream was aborted`,
      timestamp: Date.now()
    }
  };
}
async function* withStallTimeout(events, timeouts, options = {}) {
  const iterator = events[Symbol.asyncIterator]();
  try {
    let first = true;
    for (; ; ) {
      const waitMs = first ? timeouts.firstEventTimeoutMs : timeouts.idleTimeoutMs;
      if (!(waitMs > 0 && Number.isFinite(waitMs))) {
        const next2 = await iterator.next();
        if (next2.done) return;
        first = false;
        yield next2.value;
        continue;
      }
      const next = await raceTimeout(iterator.next(), waitMs);
      if (next === TIMED_OUT) {
        try {
          options.onTimeout?.();
        } catch {
        }
        yield stallErrorEvent(options.model ?? "unknown", waitMs, first);
        return;
      }
      if (next.done) return;
      first = false;
      yield next.value;
    }
  } finally {
    void Promise.resolve(iterator.return?.()).catch(() => {
    });
  }
}

// src/adapter/magpie-adapter.ts
var PROVIDER_ID = "dsh-magpie-connect";
var DEFAULT_DISPLAY_NAME = "magpie";
var DEFAULT_CONTEXT_WINDOW = 262144;
var DEFAULT_MAX_TOKENS = 32768;
var DEFAULT_API_KEY = "not-needed";
var DEFAULT_MAX_RETRIES = 2;
var DEFAULT_TIMEOUT_MS = 3e5;
var DEFAULT_FIRST_EVENT_TIMEOUT_MS = 9e4;
var DEFAULT_IDLE_TIMEOUT_MS = 6e4;
var STRENGTH_ORDER = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
function planReasoningEffort(requested, model, catalog) {
  if (typeof requested !== "string") return void 0;
  const level = requested.trim().toLowerCase();
  if (level === "") return void 0;
  const thinks = catalog.thinks?.(model) ?? false;
  if (!thinks) return void 0;
  const normalized = level === "off" ? "none" : level;
  const supports = (effort) => catalog.supportsEffort?.(model, effort) ?? false;
  const ladder = catalog.reasoningFor?.(model)?.efforts.map((effort) => effort.id);
  const ladderLess = ladder === void 0;
  if (normalized === "none") {
    return supports("none") ? "none" : void 0;
  }
  if (!STRENGTH_ORDER.includes(normalized)) return void 0;
  if (supports(normalized) || ladderLess) return normalized;
  const order = STRENGTH_ORDER;
  const index = order.indexOf(normalized);
  if (index !== -1) {
    for (let i = index + 1; i < order.length; i++) {
      const candidate = order[i];
      if (supports(candidate)) return candidate;
    }
    for (let i = index - 1; i >= 0; i--) {
      const candidate = order[i];
      if (supports(candidate)) return candidate;
    }
  }
  return void 0;
}
function toPiModel(providerId, baseUrl, id, catalog, contextWindow = DEFAULT_CONTEXT_WINDOW, maxTokens = DEFAULT_MAX_TOKENS) {
  const endpoints = catalog.getEntry?.(id)?.nativeEndpoints ?? [];
  const api = modelApiForEntry(endpoints);
  const entryThinks = catalog.thinks?.(id) ?? api === "openai-responses";
  const ladder = catalog.reasoningFor?.(id);
  const ladderIds = ladder?.efforts.map((effort) => effort.id);
  const resolvedContext = catalog.contextWindowFor?.(id) ?? contextWindow;
  const resolvedMax = catalog.maxTokensFor?.(id) ?? maxTokens;
  if (api === "openai-responses") {
    return {
      id,
      name: id,
      api,
      provider: providerId,
      baseUrl,
      reasoning: true,
      thinkingLevelMap: thinkingLevelMapFor(ladderIds),
      input: catalog.supportsImage?.(id) ?? true ? ["text", "image"] : ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: resolvedContext,
      maxTokens: resolvedMax
    };
  }
  const wire = {
    id,
    name: id,
    api,
    provider: providerId,
    baseUrl,
    reasoning: entryThinks,
    input: catalog.supportsImage?.(id) ?? false ? ["text", "image"] : ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: resolvedContext,
    maxTokens: resolvedMax
  };
  if (entryThinks) wire.thinkingLevelMap = thinkingLevelMapFor(ladderIds);
  return wire;
}
var MagpieAdapter = class {
  #catalog;
  #provider;
  #providerId;
  #displayName;
  /** Static fallback origin; the live settings page overrides per request. */
  #fallbackBaseUrl;
  #fallbackApiKey;
  #runtime;
  #maxRetries;
  #timeoutMs;
  #firstEventTimeoutMs;
  #idleTimeoutMs;
  #resolveAttachments;
  constructor(catalog, options = {}) {
    this.#catalog = catalog;
    this.#providerId = options.providerId ?? PROVIDER_ID;
    this.#displayName = options.displayName ?? (options.providerId ?? DEFAULT_DISPLAY_NAME);
    const origin = (options.magpieBaseUrl ?? options.baseUrl ?? "").replace(/\/+$/, "");
    this.#fallbackBaseUrl = origin === "" ? "" : `${origin}/v1`;
    this.#fallbackApiKey = options.apiKey ?? DEFAULT_API_KEY;
    this.#runtime = options.runtime;
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#firstEventTimeoutMs = options.firstEventTimeoutMs ?? DEFAULT_FIRST_EVENT_TIMEOUT_MS;
    this.#idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.#resolveAttachments = options.resolveAttachments;
    if (options.providerOverride !== void 0) {
      this.#provider = options.providerOverride;
      return;
    }
    this.#provider = createProvider({
      id: this.#providerId,
      name: this.#displayName,
      baseUrl: this.#fallbackBaseUrl,
      auth: {
        apiKey: {
          name: "Magpie LAN gateway",
          resolve: async () => ({ auth: { apiKey: this.#runtime?.apiKey() ?? this.#fallbackApiKey } })
        }
      },
      models: [],
      // Mixed-API provider: pi-ai dispatches on `model.api`, so completions
      // models ride /v1/chat/completions while responses-only models ride
      // /v1/responses through the same provider instance.
      api: {
        "openai-completions": openaiCompletions,
        "openai-responses": openaiResponses
      }
    });
  }
  providerInfo(provider) {
    return { id: provider, name: this.#displayName };
  }
  /**
   * dsh-llm calls this unconditionally at registration.
   * undefined = the host default retry policy.
   */
  providerRetryPolicy(_provider) {
    return void 0;
  }
  /** Advisory catalog for the DSH model picker (deduped; dsh-llm rejects duplicates). */
  listModels(provider) {
    const seen = /* @__PURE__ */ new Set();
    const models = [];
    for (const id of this.#catalog.list()) {
      if (seen.has(id)) continue;
      seen.add(id);
      const image = this.#catalog.supportsImage?.(id) ?? false;
      models.push({ provider, id, name: id, inputModalities: image ? ["text", "image"] : ["text"] });
    }
    return models;
  }
  resolveModel(provider, model) {
    const image = this.#catalog.supportsImage?.(model) ?? this.#catalog.requiresResponsesApi?.(model) ?? false;
    const ladder = this.#catalog.reasoningFor?.(model);
    return {
      provider,
      id: model,
      name: model,
      inputModalities: image ? ["text", "image"] : ["text"],
      context: { contextWindow: this.#catalog.contextWindowFor?.(model) ?? DEFAULT_CONTEXT_WINDOW },
      defaultMaxTokens: this.#catalog.maxTokensFor?.(model) ?? DEFAULT_MAX_TOKENS,
      ...ladder !== void 0 ? { reasoning: ladder } : {}
    };
  }
  async prepareCall(provider, model, _signal) {
    return {
      model: this.resolveModel(provider, model),
      stream: (options) => this.stream(options)
    };
  }
  /** Fail fast when no gateway origin is configured (picker stays empty too). */
  #requireOrigin() {
    const raw = this.#runtime?.baseUrl() ?? this.#fallbackBaseUrl.replace(/\/v1$/, "");
    const origin = raw.replace(/\/+$/, "");
    if (origin === "") {
      throw new Error("dsh-magpie-connect: Magpie gateway API URL is not configured \u2014 open Settings \u2192 Magpie and set it");
    }
    return origin;
  }
  /** Effective bearer key for this request. */
  #wireApiKey() {
    return this.#runtime?.apiKey() ?? this.#fallbackApiKey;
  }
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
  async *stream(options) {
    const origin = this.#requireOrigin();
    const endpoints = this.#catalog.getEntry?.(options.model)?.nativeEndpoints ?? [];
    const hasImage = contentHasImage(options.messages);
    if (hasImage && !(this.#catalog.supportsImage?.(options.model) ?? false)) {
      throw new Error(`dsh-magpie-connect: model "${options.model}" does not accept image input`);
    }
    const context = hasImage ? await this.#imageContext(options, endpoints) : toPiContext(options, endpoints);
    const model = toPiModel(this.#providerId, `${origin}/v1`, options.model, this.#catalog);
    const controller = new AbortController();
    const harnessSignal = options.signal;
    const onHarnessAbort = () => controller.abort();
    if (harnessSignal) {
      if (harnessSignal.aborted) controller.abort();
      else harnessSignal.addEventListener("abort", onHarnessAbort, { once: true });
    }
    try {
      const events = withStallTimeout(
        this.#eventsFor(options, context, model, controller.signal),
        { firstEventTimeoutMs: this.#firstEventTimeoutMs, idleTimeoutMs: this.#idleTimeoutMs },
        { model: options.model, onTimeout: () => controller.abort() }
      );
      yield* toStreamChunks(events, model.contextWindow);
    } finally {
      harnessSignal?.removeEventListener("abort", onHarnessAbort);
    }
  }
  async #imageContext(options, endpoints) {
    const attachments = this.#resolveAttachments?.();
    if (!attachments) {
      throw new Error("dsh-magpie-connect: image input requires the attachment service");
    }
    return toPiContextWithImages(options, attachments, endpoints);
  }
  #eventsFor(options, context, model, signal) {
    const reasoningEffort = planReasoningEffort(options.reasoningEffort, options.model, this.#catalog);
    return this.#provider.stream(model, context, {
      apiKey: this.#wireApiKey(),
      signal,
      maxRetries: this.#maxRetries,
      timeoutMs: this.#timeoutMs,
      temperature: options.temperature,
      maxTokens: options.maxTokens ?? model.maxTokens,
      ...reasoningEffort !== void 0 ? { reasoningEffort } : {}
    });
  }
  /** Expose the live catalog snapshot for diagnostics. */
  catalogStatus() {
    const list = this.#catalog.list();
    return { total: list.length, exposed: list.length };
  }
  decisionFor(model) {
    const decision = this.#catalog.decision(model);
    return { allowed: decision.allowed, source: decision.source };
  }
};

// src/config.ts
import { homedir } from "node:os";
import { join as join2 } from "node:path";
var defaults = {
  providerId: "dsh-magpie-connect",
  displayName: "magpie",
  baseUrl: "",
  apiKey: "",
  refreshSeconds: 300,
  maxRetries: 2,
  timeoutMs: 3e5,
  firstEventTimeoutMs: 9e4,
  idleTimeoutMs: 6e4
};
function resolveConfig(config = {}) {
  const providerId = config.providerId ?? defaults.providerId;
  return {
    ...defaults,
    ...config,
    providerId,
    displayName: config.displayName ?? (config.providerId ?? defaults.displayName),
    baseUrl: config.baseUrl ?? defaults.baseUrl,
    apiKey: config.apiKey ?? defaults.apiKey,
    dataDir: config.dataDir ?? join2(homedir(), ".dsh-magpie-connect")
  };
}

// src/settings.ts
import { readFile as readFile2, writeFile as writeFile2, mkdir as mkdir2, rename as rename2, rm as rm2 } from "node:fs/promises";
import { dirname as dirname2, join as join3 } from "node:path";
var SETTINGS_FILE = "settings.json";
function defaultSettingsPath(dataDir) {
  return join3(dataDir, SETTINGS_FILE);
}
function normalizeBaseUrl(raw) {
  if (typeof raw !== "string" || raw.trim() === "") throw new Error("dsh-magpie-connect: baseUrl must be a non-empty http(s) URL");
  const trimmed = raw.trim();
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`dsh-magpie-connect: baseUrl is not a valid URL: ${trimmed}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`dsh-magpie-connect: baseUrl must use http(s): ${trimmed}`);
  }
  return url.origin;
}
function normalizeHiddenModels(raw) {
  if (raw === void 0) return [];
  if (!Array.isArray(raw)) throw new Error("dsh-magpie-connect: hiddenModels must be an array of model ids");
  const out = [];
  for (const entry of raw) {
    if (typeof entry !== "string") throw new Error("dsh-magpie-connect: hiddenModels must be an array of model ids");
    const id = entry.trim();
    if (id !== "" && !out.includes(id)) out.push(id);
  }
  return out;
}
function normalizePageSettings(raw) {
  if (!raw || typeof raw !== "object") throw new Error("dsh-magpie-connect: settings payload must be an object");
  const record = raw;
  const out = {};
  if (record.baseUrl !== void 0) out.baseUrl = normalizeBaseUrl(record.baseUrl);
  if (record.apiKey !== void 0) {
    if (typeof record.apiKey !== "string" || record.apiKey.trim() === "") {
      throw new Error("dsh-magpie-connect: apiKey is required and must not be empty");
    }
    out.apiKey = record.apiKey.trim();
  }
  if (record.hiddenModels !== void 0) out.hiddenModels = normalizeHiddenModels(record.hiddenModels);
  return out;
}
function resolveEffectiveEndpoint(patch, page) {
  return {
    baseUrl: page.baseUrl ?? patch.baseUrl,
    apiKey: page.apiKey ?? patch.apiKey
  };
}
function isConfigured(endpoint) {
  return endpoint.baseUrl !== "" && endpoint.apiKey !== "";
}
var SettingsStore = class {
  #path;
  #settings = {};
  #listeners = /* @__PURE__ */ new Set();
  constructor(options = {}) {
    this.#path = options.path;
  }
  /** Load persisted settings (missing/corrupt file reads as empty, never throws). */
  async load() {
    if (!this.#path) return this.get();
    try {
      const raw = JSON.parse(await readFile2(this.#path, "utf8"));
      this.#settings = normalizePageSettings(raw);
    } catch {
      this.#settings = {};
    }
    return this.get();
  }
  get() {
    return { ...this.#settings, hiddenModels: [...this.#settings.hiddenModels ?? []] };
  }
  /** Merge a partial payload, persist, and notify listeners. */
  async save(partial) {
    const normalized = normalizePageSettings(partial);
    this.#settings = { ...this.#settings, ...normalized };
    await this.persist();
    this.#emit();
    return this.get();
  }
  /** Replace the whole document (used at startup after load). */
  replace(next) {
    this.#settings = { ...next, hiddenModels: [...next.hiddenModels ?? []] };
    this.#emit();
  }
  onChange(listener) {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
  async persist() {
    if (!this.#path) return;
    const tmp = `${this.#path}.${process.pid}.tmp`;
    await mkdir2(dirname2(this.#path), { recursive: true });
    await writeFile2(tmp, JSON.stringify(this.#settings, null, 2), "utf8");
    await rm2(this.#path, { force: true });
    await rename2(tmp, this.#path);
  }
  #emit() {
    for (const listener of [...this.#listeners]) {
      try {
        listener();
      } catch {
      }
    }
  }
};

// src/index.ts
var name = "dsh-magpie-connect";
var inject = ["llm"];
var SETTINGS_API = "/api/magpie-settings";
var MODELS_API = "/api/magpie-models";
var TEST_API = "/api/magpie-test";
var currentBackend = null;
var liveRouteSets = 0;
var routeDisposers = null;
function __resetSettingsRoutes() {
  currentBackend = null;
  liveRouteSets = 0;
  routeDisposers = null;
}
function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
var routeOk = (value) => jsonResponse(200, { ok: true, value });
var routeFail = (error) => jsonResponse(500, { ok: false, error: error instanceof Error ? error.message : String(error) });
async function readRouteBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
function buildModelRows(backend) {
  const { store, catalog } = backend;
  const hidden = new Set(store.get().hiddenModels ?? []);
  const ids = /* @__PURE__ */ new Set([...catalog.list(), ...hidden]);
  return [...ids].sort().map((id) => {
    const entry = catalog.getEntry(id);
    const endpoints = entry?.nativeEndpoints ?? [];
    const responsesOnly = endpoints.length > 0 ? !endpoints.some((endpoint) => endpoint.includes("/chat/completions")) && endpoints.some((endpoint) => endpoint.includes("/responses")) : false;
    return {
      id,
      displayName: entry?.displayName ?? id,
      ...entry?.contextWindow !== void 0 ? { contextWindow: entry.contextWindow } : {},
      ...entry?.maxTokens !== void 0 ? { maxTokens: entry.maxTokens } : {},
      image: entry?.image ?? false,
      responsesOnly,
      reasoning: entry?.reasoning ?? false,
      efforts: entry?.efforts ?? [],
      hidden: hidden.has(id)
    };
  });
}
function backendOrThrow() {
  if (!currentBackend) throw new Error("dsh-magpie-connect: settings backend not ready");
  return currentBackend;
}
async function handleSettingsGet() {
  try {
    const backend = backendOrThrow();
    const page = backend.store.get();
    const endpoint = resolveEffectiveEndpoint(backend.patchEndpoint, page);
    return routeOk({
      baseUrl: endpoint.baseUrl,
      apiKey: endpoint.apiKey,
      hiddenModels: page.hiddenModels ?? [],
      fromPage: page,
      fromPatch: backend.patchEndpoint
    });
  } catch (error) {
    return routeFail(error);
  }
}
async function handleSettingsPost(request) {
  try {
    const backend = backendOrThrow();
    const body = await readRouteBody(request);
    const saved = await backend.store.save(normalizePageSettings(body));
    backend.applyPageSettings();
    const endpoint = resolveEffectiveEndpoint(backend.patchEndpoint, saved);
    return routeOk({ baseUrl: endpoint.baseUrl, apiKey: endpoint.apiKey, hiddenModels: saved.hiddenModels ?? [] });
  } catch (error) {
    return routeFail(error);
  }
}
async function handleModelsGet() {
  try {
    const backend = backendOrThrow();
    return routeOk({ models: buildModelRows(backend), snapshot: backend.catalog.snapshot() });
  } catch (error) {
    return routeFail(error);
  }
}
async function handleTestPost(request) {
  try {
    const backend = backendOrThrow();
    const effective = backend.effective();
    const body = await readRouteBody(request);
    const origin = normalizeBaseUrl(body.baseUrl ?? effective.baseUrl);
    const rawKey = typeof body.apiKey === "string" ? body.apiKey : effective.apiKey;
    const key = rawKey.trim();
    if (key === "") throw new Error("dsh-magpie-connect: apiKey is required \u2014 fill it in before testing");
    const models = await fetchMagpieModels(origin, fetch, { headers: { authorization: `Bearer ${key}` } });
    return routeOk({ count: models.size, models: [...models.keys()].sort().slice(0, 50) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hinted = /HTTP 404/.test(message) && !/网关返回 404/.test(message) ? `${message}\uFF08\u7F51\u5173\u8FD4\u56DE 404\uFF1A\u591A\u4E3A API \u5730\u5740\u8DEF\u5F84\u4E0D\u5BF9\uFF0C\u6216\u8BE5 Key \u65E0\u6548/\u65E0\u6743\u8BBF\u95EE\uFF09` : message;
    return routeFail(hinted);
  }
}
function routeDefinitions() {
  return [
    {
      path: SETTINGS_API,
      methods: ["GET", "POST"],
      requestBody: "buffered",
      fetch: (request) => request.method === "POST" ? handleSettingsPost(request) : handleSettingsGet()
    },
    {
      path: MODELS_API,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: () => handleModelsGet()
    },
    {
      path: TEST_API,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: (request) => handleTestPost(request)
    }
  ];
}
function installSettingsRoutes(ctx, logger) {
  try {
    if (typeof ctx.inject !== "function") return;
    ctx.inject(["connection"], (cctx) => {
      const connection = cctx.connection;
      const register = connection?.fetch?.register;
      if (typeof register !== "function") {
        logger.warn("dsh-magpie-connect: connection fetch registry unavailable; settings page API disabled");
        return;
      }
      liveRouteSets += 1;
      try {
        if (routeDisposers === null) {
          const installed = [];
          try {
            for (const definition of routeDefinitions()) {
              try {
                installed.push(register(definition));
              } catch (error) {
                if (error instanceof Error && /already registered/.test(error.message)) {
                  logger.warn(`dsh-magpie-connect: ${definition.path} already registered by another generation; sharing it`);
                  continue;
                }
                throw error;
              }
            }
          } catch (error) {
            for (const dispose of installed.reverse()) {
              try {
                const result = dispose();
                if (result instanceof Promise) result.catch(() => {
                });
              } catch {
              }
            }
            throw error;
          }
          routeDisposers = installed;
        }
      } catch (error) {
        liveRouteSets -= 1;
        logger.warn(`dsh-magpie-connect: settings API unavailable: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
      return async () => {
        liveRouteSets -= 1;
        if (liveRouteSets <= 0) {
          liveRouteSets = 0;
          const owned = routeDisposers;
          routeDisposers = null;
          if (owned) {
            for (const dispose of owned.reverse()) await dispose();
          }
        }
      };
    });
  } catch (error) {
    logger.warn(`dsh-magpie-connect: settings API unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function apply(ctx, config = {}) {
  const logger = ctx.logger;
  const cfg = resolveConfig(config);
  const ready = Promise.resolve({ version: "adapter" });
  if (!ctx.llm || typeof ctx.llm.registerAdapter !== "function") {
    logger.error("dsh-magpie-connect: llm service unavailable; adapter cannot register");
    return { ready };
  }
  const dataDir = cfg.dataDir;
  const statusPath = join4(dataDir, "adapter-status.json");
  const writeStatus = (status, lastError) => {
    void writeFile3(
      statusPath,
      JSON.stringify({ ...status, lastError, writtenAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2),
      "utf8"
    ).catch(() => {
    });
  };
  const store = new SettingsStore({ path: defaultSettingsPath(dataDir) });
  const patchEndpoint = { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey };
  const effective = () => resolveEffectiveEndpoint(patchEndpoint, store.get());
  const announceTopology = () => {
    if (typeof ctx.emit !== "function") return;
    try {
      ctx.emit("llm/adapters-updated");
    } catch (error) {
      logger.warn(`dsh-magpie-connect: llm/adapters-updated emit failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const catalog = new ModelCatalog({
    baseUrl: effective().baseUrl,
    refreshSeconds: cfg.refreshSeconds,
    cachePath: defaultCachePath(dataDir),
    onRefresh: (status, lastError) => {
      writeStatus(status, lastError);
      if (lastError) logger.warn(`dsh-magpie-connect: catalog refresh issue: ${lastError}`);
    },
    onInvalidate: announceTopology
  });
  const applyPageSettings = () => {
    const page = store.get();
    const endpoint = resolveEffectiveEndpoint(patchEndpoint, page);
    const catalogOrigin = isConfigured(endpoint) ? endpoint.baseUrl.replace(/\/+$/, "") : "";
    if (catalog.baseUrl !== catalogOrigin) {
      catalog.setBaseUrl(catalogOrigin);
      if (catalogOrigin !== "") {
        void catalog.refreshOnce().catch((err) => {
          logger.warn(`dsh-magpie-connect: catalog refresh after endpoint change failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    }
    catalog.setHidden(page.hiddenModels ?? []);
  };
  const adapter = new MagpieAdapter(catalog, {
    providerId: cfg.providerId,
    displayName: cfg.displayName,
    magpieBaseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    maxRetries: cfg.maxRetries,
    timeoutMs: cfg.timeoutMs,
    firstEventTimeoutMs: cfg.firstEventTimeoutMs,
    idleTimeoutMs: cfg.idleTimeoutMs,
    runtime: {
      baseUrl: () => {
        const endpoint = effective();
        return isConfigured(endpoint) ? endpoint.baseUrl.replace(/\/+$/, "") : "";
      },
      apiKey: () => effective().apiKey
    },
    resolveAttachments: () => {
      try {
        const attachments = typeof ctx.get === "function" ? ctx.get("attachments") : void 0;
        return attachments && typeof attachments.readImageRequest === "function" ? attachments : void 0;
      } catch {
        return void 0;
      }
    }
  });
  store.onChange(applyPageSettings);
  ctx.llm.registerAdapter([cfg.providerId], adapter);
  logger.info(`dsh-magpie-connect: adapter registered for "${cfg.providerId}" (catalog warms up in background)`);
  void (async () => {
    await store.load();
    applyPageSettings();
    await catalog.start().catch((err) => {
      logger.error(`dsh-magpie-connect: catalog start failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  })().catch((err) => {
    logger.error(`dsh-magpie-connect: startup failed: ${err instanceof Error ? err.message : String(err)}`);
  });
  try {
    if (typeof ctx.inject === "function") {
      ctx.inject(["settings"], (settingsCtx) => {
        try {
          const scoped = settingsCtx;
          const fiber = ctx.fiber;
          scoped.effect?.(() => scoped.settings?.configure?.({ auto: false }, fiber), "dsh-magpie-connect: custom settings page");
        } catch {
        }
      });
    }
  } catch {
  }
  currentBackend = { store, catalog, patchEndpoint, effective, applyPageSettings };
  installSettingsRoutes(ctx, logger);
  const maybeEffect = ctx.effect;
  if (typeof maybeEffect === "function") {
    maybeEffect.call(ctx, () => () => {
      catalog.stop();
    });
  }
  return { ready };
}
export {
  MODELS_API,
  MagpieAdapter,
  ModelCatalog,
  SETTINGS_API,
  SettingsStore,
  TEST_API,
  __resetSettingsRoutes,
  apply,
  inject,
  isConfigured,
  name,
  resolveConfig,
  resolveEffectiveEndpoint
};
//# sourceMappingURL=index.js.map
