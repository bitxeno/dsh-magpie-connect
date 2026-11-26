// src/index.ts
import { join as join4 } from "node:path";
import { writeFile as writeFile3 } from "node:fs/promises";

// src/adapter/catalog.ts
import { randomBytes } from "node:crypto";
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
var LABEL_GROUP_SEPARATOR = "\xB7";
function capitalizeGroup(group) {
  return group.length === 0 ? "" : group[0].toLocaleUpperCase() + group.slice(1);
}
function groupFromId(id) {
  const prefix = id.split("/", 1)[0]?.trim() ?? "";
  return capitalizeGroup(prefix);
}
function displayNameFor(raw) {
  const id = typeof raw.id === "string" ? raw.id : "";
  const name2 = typeof raw.display_name === "string" ? raw.display_name.trim() : "";
  if (name2 === "") return id;
  const label = typeof raw.magpie_label === "string" ? raw.magpie_label.trim() : "";
  const at = label.lastIndexOf(LABEL_GROUP_SEPARATOR);
  const parsedGroup = at >= 0 ? label.slice(at + 1).trim() : "";
  const idGroup = groupFromId(id);
  const routingPrefix = id.startsWith("auto/") || id.startsWith("group/");
  const group = routingPrefix ? idGroup : parsedGroup || idGroup;
  if (group === "") return id;
  return `${group}/${name2}`;
}
function decodeModel(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const record = raw;
  const id = record.id;
  if (typeof id !== "string" || id.length === 0) return void 0;
  const num2 = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : void 0;
  const displayName = displayNameFor(record);
  const contextWindow = num2(record.context_window) ?? num2(record.context_length) ?? num2(record.max_input_tokens);
  const maxTokens = num2(record.max_output_tokens);
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
var staticMagpieModelSeeds = [
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
var staticMagpieModels = staticMagpieModelSeeds.map((entry) => ({
  ...entry,
  displayName: displayNameFor({ id: entry.id, display_name: entry.displayName })
}));
var FETCH_TIMEOUT_MS = 3e4;
var ModelCatalog = class {
  #entries = /* @__PURE__ */ new Map();
  /**
   * Allowlist of model ids the picker offers. `null` = inherit the whole
   * directory (the default, and what a fresh install gets); a Set (possibly
   * empty) = exactly these ids. Mirrors DSH's own Models settings, where a
   * provider's `models` array replaces the catalog instead of filtering it.
   */
  #enabled = null;
  #updatedAt = 0;
  #lastError = "";
  #refreshSeconds;
  #cachePath;
  #baseUrl;
  #apiKey;
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
    this.#apiKey = options.apiKey ?? "";
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
      await new Promise((resolve2) => setTimeout(resolve2, this.#startupRetryMs));
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
  /** Whether a gateway API root is configured (empty baseUrl = not configured). */
  get configured() {
    return this.#baseUrl !== "";
  }
  /**
   * Auth header for every catalog fetch. The gateway guards `GET /models` with
   * the same Bearer key as inference, so omitting it is answered 401 — which
   * the refresh loop then reports as a "catalog issue" while the picker keeps
   * serving whatever it already had.
   */
  #authHeaders() {
    return this.#apiKey === "" ? {} : { authorization: `Bearer ${this.#apiKey}` };
  }
  /**
   * Adopt a directory the settings page just read from the gateway.
   *
   * The fetch dialog asks the endpoint the form shows and gets the freshest
   * answer the session will see; the background refresh loop may be minutes
   * behind, or silently failing on a 401. Without this, a model the gateway has
   * dropped stays in the local directory — and therefore in the picker and the
   * settings list — until the next *successful* refresh, which may never come.
   *
   * Whole-set replacement, never a merge: the reply is the gateway's entire
   * catalog, so anything it no longer lists is gone. Empty input is refused
   * rather than treated as "nothing served", because a bad endpoint or a
   * transient failure must not blank the picker.
   * @param entries - the decoded gateway directory just fetched.
   * @returns whether the directory was adopted.
   */
  adoptDirectory(entries) {
    if (entries.size === 0) return false;
    this.#entries = new Map(entries);
    this.#updatedAt = this.#now();
    this.#lastError = "";
    if (this.#cachePath) void saveModelsCache(this.#cachePath, entries, this.#now()).catch(() => {
    });
    this.#announce();
    return true;
  }
  async refreshModels() {
    if (!this.configured) {
      this.#lastError = "magpie gateway API URL or key is not configured \u2014 set both on the Magpie settings page";
      return;
    }
    try {
      const entries = await fetchMagpieModels(this.#baseUrl, this.#fetch, { headers: this.#authHeaders() });
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
   * Replace the settings-page allowlist (`null` = inherit the whole directory).
   * Announces: the exposed set changes, and DSH's picker only re-reads it on
   * `llm/adapters-updated`.
   * @param ids - the allowed model ids, or `null` to inherit.
   */
  setEnabled(ids) {
    const next = ids === null ? null : new Set(ids);
    if (this.#sameSet(next)) return;
    this.#enabled = next;
    this.#announce();
  }
  /** The allowlist as stored: `null` when inheriting. */
  enabled() {
    return this.#enabled === null ? null : [...this.#enabled];
  }
  #sameSet(next) {
    const current = this.#enabled;
    if (next === null || current === null) return next === current;
    return next.size === current.size && [...next].every((id) => current.has(id));
  }
  /** Whether the picker offers one id under the current allowlist. */
  #offers(model) {
    return this.#enabled === null || this.#enabled.has(model);
  }
  /**
   * Where one model id comes from right now: the live directory, the built-in
   * snapshot, or nothing. The settings page labels its rows with this so a
   * model the gateway stopped listing is not mistaken for one it still serves.
   * @param model - the id to classify.
   * @returns `'gateway'`, `'static'`, or `'none'`.
   */
  sourceFor(model) {
    if (this.#entries.has(model)) return "gateway";
    if (this.configured && staticMagpieModels.some((entry) => entry.id === model)) return "static";
    return "none";
  }
  isEnabled(model) {
    return this.#offers(model);
  }
  /**
   * Point the refresh loop at another API root or credential (settings page
   * change).
   *
   * The key is part of the identity here, not just the URL: the gateway's
   * `GET /models` is key-guarded, so a key-only edit — the common case of
   * pasting a fresh key — must re-read the directory too. When only the key
   * moves the live entries are kept and merely re-fetched; when the root
   * moves they are dropped, because they describe a different gateway.
   * @param baseUrl - the versioned API root ('' = unconfigured).
   * @param apiKey - the gateway credential sent as a Bearer header.
   */
  setEndpoint(baseUrl, apiKey) {
    const root = baseUrl.replace(/\/+$/, "");
    const key = apiKey;
    if (root === this.#baseUrl && key === this.#apiKey) return;
    const rootChanged = root !== this.#baseUrl;
    this.#baseUrl = root;
    this.#apiKey = key;
    if (rootChanged) {
      this.#entries = /* @__PURE__ */ new Map();
      this.#updatedAt = 0;
    }
    this.#lastError = root === "" ? "magpie gateway API URL or key is not configured \u2014 set both on the Magpie settings page" : "";
    this.#announce();
  }
  /** Point the refresh loop at another API root (keeps the current key). */
  setBaseUrl(baseUrl) {
    this.setEndpoint(baseUrl, this.#apiKey);
  }
  get baseUrl() {
    return this.#baseUrl;
  }
  get apiKey() {
    return this.#apiKey;
  }
  decision(model) {
    if (!this.configured) return { allowed: false, source: "unconfigured", known: false };
    if (!this.#offers(model)) return { allowed: false, source: "not_enabled_by_settings", known: true };
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
  /**
   * Every id the directory knows right now, ignoring the allowlist: the live
   * gateway list, else the cached copy, else the built-in snapshot.
   *
   * This is what the settings page renders (each row then says whether the
   * allowlist offers it) and what the one-time migration intersects against.
   */
  directory() {
    if (!this.configured) return [];
    if (this.#entries.size === 0) return staticMagpieModels.map((entry) => entry.id);
    return [...this.#entries.keys()].sort();
  }
  /** ids exposed to DSH: the directory filtered by the allowlist (empty while unconfigured). */
  list() {
    if (!this.configured) return [];
    if (this.#entries.size === 0) return staticMagpieModels.map((entry) => entry.id).filter((id) => this.#offers(id));
    return [...this.#entries.keys()].filter((id) => this.#offers(id)).sort();
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
    (signal) => fetchImpl(`${baseUrl.replace(/\/+$/, "")}/models`, {
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
var MODELS_CACHE_VERSION = 3;
async function saveModelsCache(path, entries, now) {
  const cache = { version: MODELS_CACHE_VERSION, updatedAt: now, entries: [...entries.values()] };
  const tmp = `${path}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(tmp, JSON.stringify(cache), { encoding: "utf8", mode: 384, flag: "wx" });
    await rename(tmp, path);
  } finally {
    await rm(tmp, { force: true }).catch(() => {
    });
  }
}
async function loadModelsCache(path) {
  const raw = JSON.parse(await readFile(path, "utf8"));
  if (Date.now() - raw.updatedAt > 7 * 24 * 60 * 60 * 1e3) {
    throw new Error("gateway cache too old");
  }
  const legacy = raw.version !== MODELS_CACHE_VERSION;
  return new Map(raw.entries.map((entry) => {
    const relabeled = legacy ? { ...entry, displayName: entry.id } : entry;
    return [entry.id, relabeled];
  }));
}
function defaultCachePath(dataDir) {
  return join(dataDir, "magpie-models.json");
}

// src/homeDir.ts
import { homedir } from "node:os";
import { join as join2, resolve } from "node:path";
function resolveDshHome(configured, env = process.env) {
  if (typeof configured === "string" && configured.trim() !== "") return resolve(configured);
  const fromEnv = env.DSH_HOME;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") return resolve(fromEnv);
  return join2(homedir(), ".dsh");
}
function dshHomePath(...segments) {
  return join2(resolveDshHome(), ...segments);
}
function legacyDataDir() {
  return join2(homedir(), ".dsh-magpie-connect");
}

// src/adapter/magpie-adapter.ts
import { createProvider } from "@earendil-works/pi-ai";
import * as openaiCompletions from "@earendil-works/pi-ai/api/openai-completions";
import * as openaiResponses from "@earendil-works/pi-ai/api/openai-responses";

// src/adapter/events.ts
var CONTEXT_WINDOW_EXCEEDED = "CONTEXT_WINDOW_EXCEEDED";
var EMPTY_RESPONSE = "EMPTY_RESPONSE";
var QUOTA_EXCEEDED = "QUOTA_EXCEEDED";
var QUOTA_EXHAUSTED_PATTERN = /insufficient|quota|billing|free\s+usage\s+limit|usage\s+limit\s+(?:reached|exceeded)|usage_limit_exceeded|out\s+of\s+(?:its\s+)?allowance|FreeUsageLimitError|QuotaExceededError/i;
function classifyError(text) {
  if (/\b(?:401|403)\b/.test(text)) return "AUTH";
  if (QUOTA_EXHAUSTED_PATTERN.test(text)) return QUOTA_EXCEEDED;
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
  const timeout = new Promise((resolve2) => {
    timer = setTimeout(() => resolve2(TIMED_OUT), ms);
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
var DEFAULT_DISPLAY_NAME = "Magpie";
var DEFAULT_CONTEXT_WINDOW = 262144;
var DEFAULT_MAX_TOKENS = 32768;
function requestDefaultMaxTokens(contextWindow, outputLimit) {
  const room = Math.max(1, Math.floor(contextWindow / 4), Math.floor(contextWindow / 2) - 65536);
  return Math.min(outputLimit, room);
}
var DEFAULT_API_KEY = "not-needed";
var DEFAULT_MAX_RETRIES = 2;
var DEFAULT_TIMEOUT_MS = 3e5;
var DEFAULT_FIRST_EVENT_TIMEOUT_MS = 9e4;
var DEFAULT_IDLE_TIMEOUT_MS = 6e4;
var STRENGTH_ORDER = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
var DSH_USER_AGENT = "deepseek-harness/0.2.2-rc.1 (+https://github.com/deepseek-ai/deepseek-harness)";
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
  /** Static fallback API root; the live settings page overrides per request. */
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
    this.#fallbackBaseUrl = (options.magpieBaseUrl ?? options.baseUrl ?? "").replace(/\/+$/, "");
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
          name: "Magpie gateway",
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
  /**
   * Per-route visual-token pricing for the token meter (`/compact` calls
   * this unconditionally via `ctx.llm.imageRequestPricing`). The gateway
   * charges no separate visual tokens (pi-ai cost is 0), so like the host
   * base-class default we declare no per-route pricing.
   */
  imageRequestPricing(_provider, _model) {
    return void 0;
  }
  /**
   * Picker label: the catalog's `<group>/<display_name>` label
   * (e.g. "Codex/GPT-6-Luna"); the group comes from `magpie_label` or falls
   * back to the capitalized first id segment. The id itself stays the route id
   * (`codex/gpt-6-luna`) for requests and session history.
   */
  #labelFor(id) {
    const label = this.#catalog.getEntry?.(id)?.displayName;
    return typeof label === "string" && label.trim() !== "" ? label : id;
  }
  /** Advisory catalog for the DSH model picker (deduped; dsh-llm rejects duplicates). */
  listModels(provider) {
    const seen = /* @__PURE__ */ new Set();
    const models = [];
    for (const id of this.#catalog.list()) {
      if (seen.has(id)) continue;
      seen.add(id);
      const image = this.#catalog.supportsImage?.(id) ?? false;
      models.push({ provider, id, name: this.#labelFor(id), inputModalities: image ? ["text", "image"] : ["text"] });
    }
    return models;
  }
  resolveModel(provider, model) {
    const image = this.#catalog.supportsImage?.(model) ?? this.#catalog.requiresResponsesApi?.(model) ?? false;
    const ladder = this.#catalog.reasoningFor?.(model);
    const contextWindow = this.#catalog.contextWindowFor?.(model) ?? DEFAULT_CONTEXT_WINDOW;
    return {
      provider,
      id: model,
      name: this.#labelFor(model),
      inputModalities: image ? ["text", "image"] : ["text"],
      context: { contextWindow },
      defaultMaxTokens: requestDefaultMaxTokens(contextWindow, this.#catalog.maxTokensFor?.(model) ?? DEFAULT_MAX_TOKENS),
      ...ladder !== void 0 ? { reasoning: ladder } : {}
    };
  }
  async prepareCall(provider, model, _signal) {
    return {
      model: this.resolveModel(provider, model),
      stream: (options) => this.stream(options)
    };
  }
  /**
   * Fail fast when no gateway API URL is configured (picker stays empty too).
   * @returns the versioned API root, trailing slash stripped.
   */
  #requireBaseUrl() {
    const raw = this.#runtime?.baseUrl() ?? this.#fallbackBaseUrl;
    const baseUrl = raw.replace(/\/+$/, "");
    if (baseUrl === "") {
      throw new Error("dsh-magpie-connect: Magpie gateway API URL or key is not configured \u2014 open Settings \u2192 Magpie and fill in both");
    }
    return baseUrl;
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
    const baseUrl = this.#requireBaseUrl();
    const endpoints = this.#catalog.getEntry?.(options.model)?.nativeEndpoints ?? [];
    const hasImage = contentHasImage(options.messages);
    if (hasImage && !(this.#catalog.supportsImage?.(options.model) ?? false)) {
      throw new Error(`dsh-magpie-connect: model "${options.model}" does not accept image input`);
    }
    const context = hasImage ? await this.#imageContext(options, endpoints) : toPiContext(options, endpoints);
    const model = toPiModel(this.#providerId, baseUrl, options.model, this.#catalog);
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
    const sessionId = typeof options.sessionId === "string" ? options.sessionId : void 0;
    return this.#provider.stream(model, context, {
      apiKey: this.#wireApiKey(),
      signal,
      maxRetries: this.#maxRetries,
      timeoutMs: this.#timeoutMs,
      temperature: options.temperature,
      maxTokens: options.maxTokens ?? requestDefaultMaxTokens(model.contextWindow, model.maxTokens),
      ...reasoningEffort !== void 0 ? { reasoningEffort } : {},
      headers: {
        "user-agent": DSH_USER_AGENT,
        // The session id rides the same header Magpie's `/v1/magpie/route`
        // reads (`x-session-id`, one of its recognized session headers): with
        // it the gateway tags each request's routing with the DSH session, so
        // the composer's routing popover can show this session's latest route.
        // Official dsh-llm adapters do the same (`x-deepseek-harness-session-id`,
        // which Magpie also reads; the generic name keeps third-party gateways
        // out of DSH's private namespace).
        ...sessionId !== void 0 ? { "x-session-id": sessionId } : {},
        // DSH marks compaction requests with a header, not its prompt
        // (`dshCompacts` in magpie): "only the mark says so". The official
        // adapters send it when `purpose` is compaction.
        ...options.purpose === "compaction" ? { "x-deepseek-harness-compact": "1" } : {}
      }
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
var defaults = {
  providerId: "dsh-magpie-connect",
  displayName: "Magpie",
  baseUrl: "http://127.0.0.1:3425/v1",
  apiKey: "",
  refreshSeconds: 300,
  maxRetries: 2,
  timeoutMs: 3e5,
  firstEventTimeoutMs: 9e4,
  idleTimeoutMs: 6e4,
  searchMode: "mcp",
  searchModel: "",
  searchMaxUses: 5,
  searchTimeoutMs: 12e4,
  mcpToolCallTimeoutMs: 12e4,
  mcpAgent: ""
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
    dataDir: config.dataDir ?? dshHomePath("storages", "magpie-connect"),
    searchMode: config.searchMode === "model" ? "model" : defaults.searchMode,
    searchModel: typeof config.searchModel === "string" ? config.searchModel.trim() : defaults.searchModel,
    searchMaxUses: typeof config.searchMaxUses === "number" && Number.isInteger(config.searchMaxUses) && config.searchMaxUses > 0 ? config.searchMaxUses : defaults.searchMaxUses,
    searchTimeoutMs: typeof config.searchTimeoutMs === "number" && Number.isFinite(config.searchTimeoutMs) && config.searchTimeoutMs > 0 ? Math.floor(config.searchTimeoutMs) : defaults.searchTimeoutMs,
    mcpToolCallTimeoutMs: typeof config.mcpToolCallTimeoutMs === "number" && Number.isFinite(config.mcpToolCallTimeoutMs) && config.mcpToolCallTimeoutMs > 0 ? Math.floor(config.mcpToolCallTimeoutMs) : defaults.mcpToolCallTimeoutMs,
    // Normalized in mcp.ts; here keep the raw string so '' (all-apps) survives.
    mcpAgent: typeof config.mcpAgent === "string" ? config.mcpAgent : defaults.mcpAgent
  };
}

// src/settings.ts
import { randomBytes as randomBytes2 } from "node:crypto";
import { chmod, readFile as readFile2, writeFile as writeFile2, mkdir as mkdir2, rename as rename2, rm as rm2 } from "node:fs/promises";
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
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
function normalizeEnabledModels(raw) {
  if (raw === void 0) return [];
  if (!Array.isArray(raw)) throw new Error("dsh-magpie-connect: enabledModels must be an array of model ids");
  const out = [];
  for (const entry of raw) {
    if (typeof entry !== "string") throw new Error("dsh-magpie-connect: enabledModels must be an array of model ids");
    const id = entry.trim();
    if (id !== "" && !out.includes(id)) out.push(id);
  }
  return out;
}
function normalizeSearchMode(raw) {
  if (raw === "mcp" || raw === "model") return raw;
  throw new Error('dsh-magpie-connect: searchMode must be "mcp" or "model"');
}
function normalizeSearchMaxUses(raw) {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 20) {
    throw new Error("dsh-magpie-connect: searchMaxUses must be an integer between 1 and 20");
  }
  return raw;
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
  if (record.webKey !== void 0) {
    if (typeof record.webKey !== "string" || record.webKey.trim() === "") {
      throw new Error("dsh-magpie-connect: webKey must be a non-empty string when supplied");
    }
    out.webKey = record.webKey.trim();
  }
  if (record.enabledModels !== void 0) out.enabledModels = normalizeEnabledModels(record.enabledModels);
  if (record.showComposerIcon !== void 0) {
    if (typeof record.showComposerIcon !== "boolean") {
      throw new Error("dsh-magpie-connect: showComposerIcon must be a boolean");
    }
    out.showComposerIcon = record.showComposerIcon;
  }
  if (record.mcpEnabled !== void 0) {
    if (typeof record.mcpEnabled !== "boolean") {
      throw new Error("dsh-magpie-connect: mcpEnabled must be a boolean");
    }
    out.mcpEnabled = record.mcpEnabled;
  }
  if (record.searchMode !== void 0) out.searchMode = normalizeSearchMode(record.searchMode);
  if (record.searchModel !== void 0) {
    if (typeof record.searchModel !== "string") {
      throw new Error("dsh-magpie-connect: searchModel must be a string");
    }
    out.searchModel = record.searchModel.trim();
  }
  if (record.searchMaxUses !== void 0) out.searchMaxUses = normalizeSearchMaxUses(record.searchMaxUses);
  if (record.migratedFromHiddenModels === true) out.migratedFromHiddenModels = true;
  return out;
}
function cloneSettings(source) {
  return {
    ...source,
    ...source.enabledModels === void 0 ? {} : { enabledModels: [...source.enabledModels] }
  };
}
function migrateLegacySettings(raw, known) {
  if (!raw || typeof raw !== "object") return { settings: {}, migrated: false };
  const record = raw;
  const legacy = record.hiddenModels;
  if (record.migratedFromHiddenModels === true || !Array.isArray(legacy)) {
    return { settings: normalizePageSettings(raw), migrated: false };
  }
  const hidden = new Set(legacy.filter((entry) => typeof entry === "string").map((entry) => entry.trim()).filter((entry) => entry !== ""));
  const base = { ...record, migratedFromHiddenModels: true };
  delete base.hiddenModels;
  if (known !== void 0) base.enabledModels = known.filter((id) => !hidden.has(id));
  const settings = normalizePageSettings(base);
  return { settings, migrated: true };
}
function resolveEffectiveEndpoint(patch, page) {
  return {
    baseUrl: page.baseUrl ?? patch.baseUrl,
    apiKey: page.apiKey ?? patch.apiKey
  };
}
function resolveEffectiveSearchSettings(patch, page) {
  return {
    mode: page.searchMode ?? patch.mode,
    model: page.searchModel ?? patch.model,
    maxUses: page.searchMaxUses ?? patch.maxUses
  };
}
function isConfigured(endpoint) {
  return endpoint.baseUrl !== "" && endpoint.apiKey !== "";
}
var SettingsStore = class {
  #path;
  /**
   * Pre-0.5 settings file (`~/.dsh-magpie-connect/settings.json`), or
   * `undefined` when no read-through-and-migrate is wanted (an explicit
   * `dataDir` means the user owns the path — never fall back, never delete).
   *
   * Read-only until the first successful write: settings are only moved to the
   * new location when the user saves something, so an upgrade that changes no
   * setting touches no file at all.
   */
  #legacyPath;
  /** True while the live state came from {@link #legacyPath}, not {@link #path}. */
  #legacySource = false;
  /**
   * Set when the settings file exists but could not be read/parsed at startup.
   * Blocks a partial save (e.g. the model-list autosave that posts only
   * `enabledModels`) from writing the empty in-memory state over a file whose
   * credentials we simply failed to load — that is how a key silently vanished.
   */
  #loadFailed = false;
  #settings = {};
  /** Serializes writes: one persist in flight, so two generations cannot interleave. */
  #writeChain = Promise.resolve();
  #listeners = /* @__PURE__ */ new Set();
  /**
   * Whether the state directory is the plugin's own (`$DSH_HOME/storages/…`),
   * in which case its permissions are tightened to `0700`. An explicit
   * `dataDir` belongs to the user, so it is never chmod-ed behind their back.
   * The settings file itself is repaired to `0600` either way: it holds a
   * credential.
   */
  #privateDir;
  constructor(options = {}) {
    this.#path = options.path;
    this.#legacyPath = options.legacyPath;
    this.#privateDir = options.privateDir ?? false;
  }
  /**
   * Tighten permissions on a file this store owns, best-effort.
   *
   * Never throws: the file may live on a read-only mount, a non-POSIX
   * filesystem, or a platform where `chmod` is a no-op. A permission repair
   * must never make otherwise-readable settings unreadable.
   */
  async #chmodQuietly(path, mode) {
    await chmod(path, mode).catch(() => {
    });
  }
  /**
   * Read one settings file, distinguishing "absent" from "unreadable".
   *
   * Returns the raw parsed document (`raw`) untouched so the legacy
   * `hiddenModels` conversion can still see that field; validation happens in
   * {@link read}. `exists: true` with `raw: undefined` means the file is there
   * but could not be read or parsed — callers must not mistake that for "no
   * configuration", or a later save would persist the blank state over a
   * perfectly good file.
   * @param path - file to read; `undefined` yields `{ exists: false }`.
   */
  async #readFile(path) {
    if (!path) return { exists: false };
    let text;
    try {
      text = await readFile2(path, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return { exists: false };
      return { exists: true, error };
    }
    await this.#chmodQuietly(path, 384);
    if (this.#privateDir) await this.#chmodQuietly(dirname2(path), 448);
    try {
      return { exists: true, raw: JSON.parse(text) };
    } catch (error) {
      return { exists: true, error };
    }
  }
  /**
   * Locate the document to use: new location first, then the pre-0.5 file.
   *
   * A file that exists but is unreadable is returned as-is (`exists: true`,
   * `raw: undefined`) so callers can flag it instead of mistaking it for
   * "no configuration". A present-but-corrupt NEW file is authoritative and
   * does not fall back to the legacy one — that could resurrect stale
   * credentials over a deliberately replaced file.
   */
  async #resolveRaw() {
    const fromNew = await this.#readFile(this.#path);
    if (fromNew.raw !== void 0) return fromNew;
    if (fromNew.exists) return fromNew;
    const fromOld = await this.#readFile(this.#legacyPath);
    if (fromOld.raw !== void 0) {
      this.#legacySource = true;
      return fromOld;
    }
    return fromOld;
  }
  /**
   * Read and normalize the persisted document without touching memory or disk.
   *
   * New location first; when it is absent, fall back **read-only** to the
   * pre-0.5 file so an upgrade shows the user's saved endpoint immediately.
   *
   * A file that is *present but unreadable* is NOT treated as "no
   * configuration": it sets {@link #loadFailed} (blocking a later partial save
   * from overwriting it with the blank state) and still returns `{}` so callers
   * have something to render.
   */
  async read() {
    const resolved = await this.#resolveRaw();
    if (resolved.raw !== void 0) {
      try {
        return normalizePageSettings(resolved.raw);
      } catch {
        this.#loadFailed = true;
        return {};
      }
    }
    if (resolved.exists) this.#loadFailed = true;
    return {};
  }
  /**
   * Load persisted settings, running the one-time `hiddenModels` ->
   * `enabledModels` conversion.
   *
   * The rewrite is attempted at startup rather than lazily so the file on disk
   * matches what the running process believes; a failed write is not fatal
   * (the in-memory result is still correct), and the migration marker makes a
   * retry idempotent.
   * @param known - ids the old blacklist rules would have offered, used to
   *   compute the allowlist; omitted when the directory is not known yet.
   */
  async load(known) {
    if (!this.#path) return this.get();
    const resolved = await this.#resolveRaw();
    if (resolved.raw === void 0) {
      if (resolved.exists) this.#loadFailed = true;
      this.#settings = {};
      return this.get();
    }
    const { settings, migrated } = migrateLegacySettings(resolved.raw, known);
    this.#settings = settings;
    if (migrated) await this.persist().catch(() => {
    });
    return this.get();
  }
  /**
   * Adopt a document already read and normalized by {@link read}, then run the
   * legacy conversion against the directory that is now warm.
   *
   * This is the startup path: `read` -> `applyPageSettings` (so the catalog
   * knows the user's endpoint) -> `catalog.start` (so the directory is real) ->
   * `hydrate` (so a legacy file converts against the live gateway).
   * @param raw - the normalized document from {@link read}.
   * @param known - ids the old blacklist rules would have offered.
   */
  async hydrate(raw, known) {
    const { settings, migrated } = migrateLegacySettings(raw, known);
    this.#settings = settings;
    if (migrated) await this.persist().catch(() => {
    });
    this.#emit();
    return this.get();
  }
  get() {
    return cloneSettings(this.#settings);
  }
  /** Merge a partial payload, persist, and notify listeners. */
  async save(partial) {
    const normalized = normalizePageSettings(partial);
    if (this.#loadFailed && normalized.baseUrl === void 0 && normalized.apiKey === void 0) {
      throw new Error(
        "dsh-magpie-connect: settings file was unreadable; refusing to overwrite it with a partial save \u2014 reload the settings page or restore settings.json"
      );
    }
    this.#settings = { ...this.#settings, ...normalized };
    await this.persist();
    if (normalized.baseUrl !== void 0 && normalized.apiKey !== void 0) this.#loadFailed = false;
    this.#emit();
    return this.get();
  }
  /** Replace the whole document (used at startup after load). */
  replace(next) {
    this.#settings = cloneSettings(next);
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
    this.#writeChain = this.#writeChain.then(
      () => this.#writeNow(),
      () => this.#writeNow()
    );
    await this.#writeChain;
  }
  /**
   * Write the current state to {@link #path} atomically, then clean up the
   * pre-0.5 file if this generation had read from it.
   *
   * The temp file is a random-suffixed sibling opened with `wx` and renamed
   * over the target — no `rm` beforehand (that opened a window where the file
   * did not exist and a concurrent read saw an empty document), and a random
   * suffix so two generations in one process cannot share a temp name.
   */
  async #writeNow() {
    const target = this.#path;
    if (!target) return;
    const dir = dirname2(target);
    await mkdir2(dir, { recursive: true, ...this.#privateDir ? { mode: 448 } : {} });
    if (this.#privateDir) await this.#chmodQuietly(dir, 448);
    const tmp = `${target}.${process.pid}.${randomBytes2(6).toString("hex")}.tmp`;
    try {
      await writeFile2(tmp, JSON.stringify(this.#settings, null, 2), { encoding: "utf8", mode: 384, flag: "wx" });
      await rename2(tmp, target);
    } finally {
      await rm2(tmp, { force: true }).catch(() => {
      });
    }
    if (this.#legacySource && this.#legacyPath) {
      await rm2(this.#legacyPath, { force: true }).then(() => {
        this.#legacySource = false;
      }).catch(() => {
      });
    }
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

// src/trace.ts
var TRACE_ACCOUNT_ROWS = 14;
var TRACE_ACTIVE_ROWS = 5;
var TRACE_TIMEOUT_MS = 8e3;
var WEB_TRACE_PATH = "/api/gateway/trace";
function deriveGatewayBase(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return void 0;
  }
  const trimmed = url.pathname.replace(/\/+$/, "").replace(/\/v\d+$/i, "");
  return `${url.origin}${trimmed}`;
}
function num(record, key) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function str(record, key) {
  const value = record[key];
  return typeof value === "string" && value !== "" ? value : void 0;
}
function pctOf(used) {
  if (typeof used !== "number" || !Number.isFinite(used)) return void 0;
  return Math.min(100, Math.max(0, Math.round(used)));
}
function pctOfParts(record) {
  const amount = num(record, "amount");
  const limit = num(record, "limit");
  if (amount === void 0 || limit === void 0 || limit <= 0) return void 0;
  return pctOf(amount / limit * 100);
}
function statusForStatusCode(code) {
  if (code === 401) return "unauthorized";
  if (code === 403) return "forbidden";
  if (code >= 500) return "network";
  return "unknown";
}
var WEB_PROBE_TIMEOUT_MS = 1500;
var WEB_COOKIE_FALLBACK_PORTS = ["3430", "443", "80"];
function guessedWebCookie(base) {
  try {
    const url = new URL(base);
    return `magpie_web_${url.port || (url.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return "magpie_web_3430";
  }
}
var webCookieNames = /* @__PURE__ */ new Map();
var webBasesResolved = /* @__PURE__ */ new Map();
async function discoverWebCookieName(base, webKey, signal) {
  try {
    const response = await fetch(`${base.replace(/\/+$/, "")}/?k=${encodeURIComponent(webKey)}`, {
      redirect: "manual",
      cache: "no-store",
      signal
    });
    const match = /magpie_web_[A-Za-z0-9._-]+/.exec(response.headers.get("set-cookie") ?? "");
    return match?.[0];
  } catch {
    return void 0;
  }
}
async function fetchWebResponse(base, webKey, path, accept, signal) {
  const tried = [];
  const attempt = (name2) => {
    tried.push(name2);
    return fetch(`${base}${path}`, {
      headers: { cookie: `${name2}=${webKey}`, accept },
      cache: "no-store",
      signal
    });
  };
  const cached = webCookieNames.get(base);
  let response = await attempt(cached ?? guessedWebCookie(base));
  if (response.status === 401) {
    const discovered = await discoverWebCookieName(base, webKey, signal);
    if (discovered !== void 0 && !tried.includes(discovered)) {
      response = await attempt(discovered);
    }
    if (response.status === 401) {
      for (const port of WEB_COOKIE_FALLBACK_PORTS) {
        const name2 = `magpie_web_${port}`;
        if (tried.includes(name2)) continue;
        response = await attempt(name2);
        if (response.status !== 401) break;
      }
    }
  }
  if (response.ok) {
    const winner = tried[tried.length - 1];
    if (winner !== void 0) webCookieNames.set(base, winner);
  }
  return response;
}
async function fetchWebJson(base, webKey, path, signal) {
  const response = await fetchWebResponse(base, webKey, path, "application/json", signal);
  if (!response.ok) {
    const error = new Error(`Magpie Web HTTP ${response.status} ${path}`);
    error.statusCode = response.status;
    throw error;
  }
  return await response.json();
}
function webBases(base) {
  const candidates = [base];
  try {
    const url = new URL(base);
    if (url.port !== "3430") {
      url.port = "3430";
      candidates.push(`${url.origin}${url.pathname.replace(/\/+$/, "")}`);
    }
  } catch {
    return [base];
  }
  return [...new Set(candidates)];
}
function orderedWebBases(base) {
  const bases = webBases(base);
  const known = webBasesResolved.get(base);
  return known !== void 0 && bases.includes(known) ? [known, ...bases.filter((b) => b !== known)] : bases;
}
function webTrySignal(signal, index) {
  if (index === 0) return signal;
  const budget = AbortSignal.timeout(WEB_PROBE_TIMEOUT_MS);
  return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, budget]) : budget;
}
async function fetchFullWebTrace(base, webKey, signal) {
  let lastError;
  for (const [index, candidate] of orderedWebBases(base).entries()) {
    try {
      const trace = await fetchWebJson(candidate, webKey, `${WEB_TRACE_PATH}?after=0`, webTrySignal(signal, index));
      if (!Array.isArray(trace.routes)) {
        throw new Error("Magpie Web returned an unexpected trace shape");
      }
      webBasesResolved.set(base, candidate);
      return { trace, base: candidate };
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Magpie Web trace is unavailable");
}
function routingUrlFor(base) {
  return `${base.replace(/\/+$/, "")}/?view=routing`;
}
async function fetchWebBinary(base, webKey, path, signal) {
  const response = await fetchWebResponse(base, webKey, path, "image/svg+xml,image/png,*/*", signal);
  if (!response.ok) {
    const error = new Error(`Magpie Web HTTP ${response.status} ${path}`);
    error.statusCode = response.status;
    throw error;
  }
  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "image/svg+xml"
  };
}
var PNG_ICONS = /* @__PURE__ */ new Set([
  "crush",
  "zcode",
  "alma",
  "hanako",
  "cindy",
  "lody",
  "typesafe",
  "atomcode",
  "snow",
  "mlx-serve",
  "mothx",
  "zoo-code",
  "kimi-code-desktop"
]);
async function fetchWebIcon(base, webKey, name2, signal) {
  const safe = /^[A-Za-z0-9._~-]+$/.test(name2) && !name2.includes("..") ? name2 : "generic";
  if (safe === "generic") throw new Error("Magpie Web icon name is invalid");
  const ext = PNG_ICONS.has(safe) ? "png" : "svg";
  const path = `/icons/${safe}.${ext}`;
  let lastError;
  for (const [index, candidate] of orderedWebBases(base).entries()) {
    try {
      const icon = await fetchWebBinary(candidate, webKey, path, webTrySignal(signal, index));
      webBasesResolved.set(base, candidate);
      return icon;
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Magpie Web icon is unavailable");
}
async function fetchJson(base, apiKey, path, signal) {
  const response = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
    cache: "no-store",
    signal
  });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} ${path}`);
    error.statusCode = response.status;
    throw error;
  }
  return await response.json();
}
function maskHolder(user) {
  if (user === void 0) return void 0;
  const at = user.indexOf("@");
  if (at <= 0) return user;
  const head = user.slice(0, Math.max(1, Math.min(at, 4)));
  return `${head}\u2026`;
}
function isTotalWindow(entry) {
  return /^(grand\s+)?total\b/i.test((str(entry, "name") ?? "").trim());
}
function hasShare(entry) {
  return num(entry, "used") !== void 0 || pctOfParts(entry) !== void 0;
}
function pickWindow(windows) {
  const usable = windows.filter((entry) => entry.unlimited !== true && hasShare(entry));
  const counted = windows.filter((entry) => entry.unlimited !== true);
  return usable.find(isTotalWindow) ?? usable[0] ?? counted.find((entry) => str(entry, "resetsAt") !== void 0) ?? counted[0] ?? windows[0];
}
function toAccountRow(account) {
  const provider = str(account, "name") ?? str(account, "provider");
  if (provider === void 0) return void 0;
  const user = maskHolder(str(account, "user"));
  const base = {
    provider,
    ...str(account, "provider") !== void 0 ? { providerId: str(account, "provider") } : {},
    ...str(account, "plan") !== void 0 ? { plan: str(account, "plan") } : {},
    ...user !== void 0 ? { user } : {},
    ...str(account, "error") !== void 0 ? { error: str(account, "error") } : {}
  };
  const windows = Array.isArray(account.windows) ? account.windows : [];
  const window = pickWindow(windows);
  if (window === void 0) return base;
  const usedPct = pctOf(window.used) ?? pctOfParts(window);
  const windowName = str(window, "name");
  const display = str(window, "display");
  const resetsAt = str(window, "resetsAt");
  const amount = num(window, "amount");
  const limit = num(window, "limit");
  const unit = str(window, "unit");
  return {
    ...base,
    ...windowName !== void 0 ? { windowName } : {},
    ...usedPct !== void 0 ? { usedPct } : {},
    ...display !== void 0 ? { display } : {},
    ...amount !== void 0 ? { amount } : {},
    ...limit !== void 0 ? { limit } : {},
    ...unit !== void 0 ? { unit } : {},
    ...resetsAt !== void 0 ? { resetsAt } : {}
  };
}
function toActiveRow(entry, session) {
  const ms = num(entry, "ms");
  if (ms === void 0) return void 0;
  const rowSession = str(entry, "session");
  const agent = str(entry, "agent");
  const model = str(entry, "model");
  const provider = str(entry, "provider");
  const phase = str(entry, "phase");
  return {
    ...agent !== void 0 ? { agent } : {},
    ...model !== void 0 ? { model } : {},
    ...provider !== void 0 ? { provider } : {},
    ...rowSession !== void 0 ? { session: rowSession } : {},
    ms,
    ...phase !== void 0 ? { phase } : {},
    ...session !== void 0 && rowSession !== void 0 && rowSession === session ? { own: true } : {}
  };
}
function toConcurrency(data) {
  return {
    requests: num(data, "requests") ?? 0,
    waiting: num(data, "waiting") ?? 0,
    tools: num(data, "tools") ?? 0
  };
}
function toTraceCandidate(entry, outcome, restOverride) {
  const id = str(entry, "id");
  const provider = str(entry, "provider");
  if (id === void 0 || provider === void 0) return void 0;
  const used = num(entry, "used");
  const renews = Array.isArray(entry.renews) ? entry.renews.filter((value) => typeof value === "string") : [];
  const via = Array.isArray(entry.via) ? entry.via.filter((value) => typeof value === "string" && value !== "") : [];
  const amount = num(entry, "amount");
  const limit = num(entry, "limit");
  const partsPct = pctOfParts(entry);
  const usedPct = amount !== void 0 && limit !== void 0 && limit > 0 ? partsPct ?? pctOf(used) : pctOf(used);
  const restRaw = restOverride ?? (entry.rest && typeof entry.rest === "object" ? entry.rest : void 0);
  const status = num(entry, "status");
  const ms = num(entry, "ms");
  return {
    id,
    provider,
    ...str(entry, "kind") !== void 0 ? { kind: str(entry, "kind") } : {},
    ...str(entry, "name") !== void 0 ? { name: str(entry, "name") } : {},
    ...str(entry, "who") !== void 0 ? { who: maskHolder(str(entry, "who")) } : {},
    ...str(entry, "icon") !== void 0 ? { icon: str(entry, "icon") } : {},
    ...str(entry, "preset") !== void 0 ? { preset: str(entry, "preset") } : {},
    ...str(entry, "plan") !== void 0 ? { plan: str(entry, "plan") } : {},
    ...str(entry, "model") !== void 0 ? { model: str(entry, "model") } : {},
    ...str(entry, "fixed") !== void 0 ? { fixed: str(entry, "fixed") } : {},
    ...via.length > 0 ? { via } : {},
    ...usedPct !== void 0 ? { usedPct } : {},
    ...amount !== void 0 ? { amount } : {},
    ...limit !== void 0 ? { limit } : {},
    ...str(entry, "unit") !== void 0 ? { unit: str(entry, "unit") } : {},
    ...str(entry, "windowName") !== void 0 ? { windowName: str(entry, "windowName") } : {},
    ...renews.length > 0 ? { renews } : {},
    ...restRaw !== void 0 ? { rest: restRaw } : {},
    outcome,
    ...status !== void 0 ? { status } : {},
    ...str(entry, "fail") !== void 0 ? { fail: str(entry, "fail") } : {},
    ...str(entry, "error") !== void 0 ? { error: str(entry, "error") } : {},
    ...ms !== void 0 ? { ms } : {},
    ...str(entry, "leftWhy") !== void 0 ? { skipReason: str(entry, "leftWhy") } : {},
    ...entry.fallback === true ? { fallback: true } : {},
    ...entry.free === true ? { free: true } : {},
    ...num(entry, "capped") !== void 0 ? { capped: num(entry, "capped") } : {},
    ...entry.held === true ? { held: true } : {},
    ...str(entry, "heldBy") !== void 0 ? { heldBy: str(entry, "heldBy") } : {},
    ...entry.unlisted === true ? { unlisted: true } : {},
    ...entry.barred === true ? { barred: true } : {},
    ...entry.noCredits === true ? { noCredits: true } : {},
    ...str(entry, "unread") !== void 0 ? { unread: str(entry, "unread") } : {},
    ...str(entry, "noURL") !== void 0 ? { noURL: str(entry, "noURL") } : {},
    ...num(entry, "window") !== void 0 ? { window: num(entry, "window") } : {}
  };
}
function toSessionTrace(route, accounts) {
  const id = num(route, "id");
  const model = str(route, "model");
  if (id === void 0 || model === void 0) return void 0;
  const orderRaw = Array.isArray(route.order) ? route.order : [];
  const leftRaw = Array.isArray(route.left) ? route.left : [];
  const triesRaw = Array.isArray(route.tries) ? route.tries : [];
  const groupRaw = route.group !== null && typeof route.group === "object" ? route.group : void 0;
  const groupMembers = groupRaw !== void 0 && Array.isArray(groupRaw.members) ? groupRaw.members.filter((x) => typeof x === "string") : [];
  const groupVia = groupRaw !== void 0 && Array.isArray(groupRaw.via) ? groupRaw.via.map((x) => typeof x === "string" ? x : "") : [];
  const subsRaw = groupRaw !== void 0 && Array.isArray(groupRaw.subs) ? groupRaw.subs : [];
  const subs = subsRaw.filter((entry) => str(entry, "id") !== void 0).map((entry) => ({
    id: str(entry, "id") ?? "",
    name: str(entry, "name") ?? str(entry, "id") ?? "",
    ...str(entry, "ref") !== void 0 ? { ref: str(entry, "ref") } : {},
    ...str(entry, "routing") !== void 0 ? { routing: str(entry, "routing") } : {}
  }));
  const group = groupRaw !== void 0 && str(groupRaw, "id") !== void 0 ? {
    id: str(groupRaw, "id") ?? "",
    name: str(groupRaw, "name") ?? str(groupRaw, "id") ?? "",
    ...str(groupRaw, "ref") !== void 0 ? { ref: str(groupRaw, "ref") } : {},
    ...str(groupRaw, "routing") !== void 0 ? { routing: str(groupRaw, "routing") } : {},
    ...groupMembers.length > 0 ? { members: groupMembers } : {},
    ...subs.length > 0 ? { subs } : {},
    ...groupVia.length > 0 ? { via: groupVia } : {}
  } : void 0;
  const subgroupFor = (entry) => {
    const own = Array.isArray(entry.via) ? entry.via.filter((x) => typeof x === "string" && x !== "") : [];
    if (own.length > 0) return own[own.length - 1] ?? "";
    const provider = str(entry, "provider") ?? "";
    const member = str(entry, "model") ?? "";
    const fixed = str(entry, "fixed");
    if (provider === "" || member === "") return "";
    const ref = `${provider}/${member}${fixed !== void 0 ? `:${fixed}` : ""}`;
    const idx = groupMembers.findIndex((x) => x === ref || x === `${provider}/${member}`);
    if (idx < 0) return "";
    const path = (groupVia[idx] ?? "").split(">").filter(Boolean);
    return path[path.length - 1] ?? "";
  };
  const seatKey = (entry) => `${str(entry, "id") ?? ""}\0${str(entry, "model") ?? ""}\0${str(entry, "fixed") ?? ""}`;
  const triesBySeat = /* @__PURE__ */ new Map();
  for (const tried of triesRaw) if (str(tried, "id") !== void 0) triesBySeat.set(seatKey(tried), tried);
  const candidate = (entry, kind) => {
    const tried = triesBySeat.get(seatKey(entry));
    const quota = accounts.find(
      (account) => account.providerId === str(entry, "provider") && ((account.user ?? "").toLowerCase() === maskHolder(str(entry, "who"))?.toLowerCase() || account.user === void 0)
    );
    const entryAmount = num(entry, "amount");
    const entryLimit = num(entry, "limit");
    const namesPickedWindow = quota?.windowName !== void 0 && (entryAmount === void 0 && entryLimit === void 0 || entryLimit !== void 0 && quota.limit !== void 0 && Math.abs(entryLimit - quota.limit) < 0.01);
    const quotaEnrichment = {
      // The trace row's own counters are what routing weighed, so they win;
      // the quota windows only fill what the row left out. Filling `used` from
      // one window while `amount`/`limit` came from another is exactly the
      // mismatch this guard prevents.
      ...num(entry, "used") === void 0 && quota?.usedPct !== void 0 ? { used: quota.usedPct } : {},
      ...entryAmount === void 0 && quota?.amount !== void 0 ? { amount: quota.amount } : {},
      ...entryLimit === void 0 && quota?.limit !== void 0 ? { limit: quota.limit } : {},
      ...str(entry, "unit") === void 0 && quota?.unit !== void 0 ? { unit: quota.unit } : {},
      ...str(entry, "windowName") === void 0 && namesPickedWindow ? { windowName: quota.windowName } : {},
      ...!Array.isArray(entry.renews) && quota?.resetsAt !== void 0 ? { renews: [quota.resetsAt] } : {}
    };
    const row = toTraceCandidate({ ...entry, ...quotaEnrichment }, kind, tried?.rest);
    if (row === void 0) return void 0;
    const rest = tried?.rest ?? entry.rest;
    const restValue = rest !== null && typeof rest === "object" ? rest : void 0;
    const outcome = restValue !== void 0 ? "resting" : kind;
    return {
      ...row,
      outcome,
      subgroup: subgroupFor(entry),
      ...quota?.error !== void 0 && row.error === void 0 ? { error: quota.error } : {},
      ...restValue !== void 0 ? { rest: {
        ...str(restValue, "why") !== void 0 ? { why: str(restValue, "why") } : {},
        ...num(restValue, "status") !== void 0 ? { status: num(restValue, "status") } : {},
        ...str(restValue, "until") !== void 0 ? { until: str(restValue, "until") } : {},
        ...str(restValue, "by") !== void 0 ? { by: str(restValue, "by") } : {},
        ...num(restValue, "failures") !== void 0 ? { failures: num(restValue, "failures") } : {},
        ...str(restValue, "model") !== void 0 ? { model: str(restValue, "model") } : {},
        ...str(restValue, "error") !== void 0 ? { error: str(restValue, "error") } : {},
        ...restValue.rate === true ? { rate: true } : {}
      } } : {}
    };
  };
  const orderSeats = new Set(orderRaw.map(seatKey));
  const orderCandidates = orderRaw.map((entry) => {
    const tried = triesBySeat.get(seatKey(entry));
    const done = tried?.done === true;
    const status2 = num(tried ?? entry, "status");
    const rest = tried?.rest ?? entry.rest;
    const outcome = rest !== void 0 && rest !== null ? "resting" : tried === void 0 ? "available" : done ? status2 !== void 0 && status2 >= 200 && status2 < 400 ? "answered" : "failed" : "processing";
    return candidate({ ...entry, ...tried ?? {}, ...status2 !== void 0 ? { status: status2 } : {} }, outcome);
  }).filter((value) => value !== void 0);
  const tries = triesRaw.map((entry) => {
    const ordered = orderRaw.find((candidate2) => seatKey(candidate2) === seatKey(entry));
    const enriched = ordered !== void 0 ? { ...ordered, ...entry } : entry;
    const done = entry.done === true;
    const status2 = num(entry, "status");
    const rest = entry.rest ?? ordered?.rest;
    const outcome = rest !== void 0 && rest !== null ? "resting" : done ? status2 !== void 0 && status2 >= 200 && status2 < 400 ? "answered" : "failed" : "processing";
    return candidate(enriched, outcome);
  }).filter((value) => value !== void 0);
  const left = leftRaw.filter((entry) => !orderSeats.has(seatKey(entry))).map((entry) => {
    const skipReason = str(entry, "leftWhy") ?? str(entry, "heldBy") ?? (entry.held === true ? "held" : entry.noCredits === true ? "credits" : entry.unlisted === true ? "unlisted" : entry.barred === true ? "barred" : "");
    return candidate({ ...entry, ...skipReason !== "" ? { leftWhy: skipReason } : {} }, "skipped");
  }).filter((value) => value !== void 0);
  const allCandidates = [...orderCandidates, ...left];
  const bySubgroup = /* @__PURE__ */ new Map();
  const orderedKeys = [];
  for (const row of allCandidates) {
    const key = row.subgroup ?? "";
    if (!bySubgroup.has(key)) orderedKeys.push(key);
    const list = bySubgroup.get(key) ?? [];
    list.push(row);
    bySubgroup.set(key, list);
  }
  const sections = [];
  for (const key of orderedKeys) {
    const rows = bySubgroup.get(key) ?? [];
    if (rows.length === 0) continue;
    if (key === "") {
      sections.push({
        name: group?.name ?? model,
        ref: group?.ref ?? model,
        ...group?.routing !== void 0 ? { routing: group.routing } : {},
        depth: 0,
        hideHeader: subs.length > 0,
        candidates: rows.slice(0, 8)
      });
      continue;
    }
    const sub = subs.find((entry) => entry.id === key);
    sections.push({
      name: sub?.name ?? key,
      ref: sub?.ref ?? `group/${key}`,
      ...sub?.routing !== void 0 ? { routing: sub.routing } : {},
      depth: 1,
      candidates: rows.slice(0, 8)
    });
  }
  if (sections.length === 0) {
    sections.push({
      name: group?.name ?? model,
      ref: group?.ref ?? model,
      ...group?.routing !== void 0 ? { routing: group.routing } : {},
      depth: 0,
      candidates: allCandidates.slice(0, 8)
    });
  }
  const ms = num(route, "ms");
  const ttftMs = num(route, "ttft");
  const status = num(route, "status");
  return {
    id,
    ...str(route, "time") !== void 0 ? { time: str(route, "time") } : {},
    model,
    ...group !== void 0 ? { group } : {},
    ...sections.length > 0 ? { sections } : {},
    order: orderCandidates,
    left,
    tries,
    done: route.done === true,
    ...status !== void 0 ? { status } : {},
    ...str(route, "error") !== void 0 ? { error: str(route, "error") } : {},
    ...ms !== void 0 ? { ms } : {},
    ...ttftMs !== void 0 ? { ttftMs } : {}
  };
}
function isAbort(error) {
  return error instanceof Error && error.name === "AbortError";
}
function toSessionRoute(data) {
  const route = data.route;
  if (route === null || route === void 0 || typeof route !== "object") return void 0;
  const record = route;
  const triesRaw = Array.isArray(record.tries) ? record.tries : [];
  const tries = triesRaw.map((entry) => {
    const ms2 = num(entry, "ms");
    const status2 = num(entry, "status");
    return {
      ...str(entry, "model") !== void 0 ? { model: str(entry, "model") } : {},
      ...entry.done === true ? { done: true } : {},
      ...status2 !== void 0 ? { status: status2 } : {},
      ...ms2 !== void 0 ? { ms: ms2 } : {},
      ...str(entry, "fail") !== void 0 ? { fail: str(entry, "fail") } : {}
    };
  });
  const ms = num(record, "ms");
  const ttftMs = num(record, "ttft_ms");
  const status = num(record, "status");
  const seq = num(data, "seq");
  return {
    ...str(record, "time") !== void 0 ? { time: str(record, "time") } : {},
    ...str(record, "asked") !== void 0 ? { asked: str(record, "asked") } : {},
    ...str(record, "model") !== void 0 ? { model: str(record, "model") } : {},
    ...str(record, "served") !== void 0 ? { served: str(record, "served") } : {},
    ...str(record, "group") !== void 0 ? { group: str(record, "group") } : {},
    ...tries.length > 0 ? { tries } : {},
    ...record.done === true ? { done: true } : {},
    ...status !== void 0 ? { status } : {},
    ...ms !== void 0 ? { ms } : {},
    ...ttftMs !== void 0 ? { ttftMs } : {},
    ...str(record, "error") !== void 0 ? { error: str(record, "error") } : {},
    ...seq !== void 0 ? { seq } : {}
  };
}
async function fetchTraceView(endpoint, signal, session, webKey) {
  const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  let base;
  try {
    base = deriveGatewayBase(normalizeBaseUrl(endpoint.baseUrl));
  } catch {
    base = void 0;
  }
  const defaultRoutingUrl = base !== void 0 && base !== "" ? routingUrlFor(base) : void 0;
  if (!isConfigured(endpoint)) return { status: "unconfigured", fetchedAt, ...defaultRoutingUrl !== void 0 ? { routingUrl: defaultRoutingUrl } : {} };
  if (base === void 0 || base === "") return { status: "unconfigured", fetchedAt, ...defaultRoutingUrl !== void 0 ? { routingUrl: defaultRoutingUrl } : {} };
  const key = endpoint.apiKey;
  const fullWebTrace = webKey !== void 0 && webKey.trim() !== "" ? fetchFullWebTrace(base, webKey.trim(), signal).then((out) => ({ data: out.trace, base: out.base })).catch((error) => ({ error })) : Promise.resolve(void 0);
  const quotas = fetchJson(base, key, "/v1/magpie/quotas", signal).then((data) => ({ data })).catch((error) => ({ error }));
  const concurrency = fetchJson(base, key, "/v1/magpie/concurrency", signal).then((data) => ({ data })).catch((error) => ({ error }));
  const sessionRoute = session !== void 0 && session !== "" ? fetchJson(base, key, `/v1/magpie/route?session=${encodeURIComponent(session)}`, signal).then((data) => ({ data })).catch((error) => ({ error })) : Promise.resolve(void 0);
  const [quotasOut, concurrencyOut, routeOut, fullTraceOut] = await Promise.all([quotas, concurrency, sessionRoute, fullWebTrace]);
  const gatewayErrors = [
    ..."error" in quotasOut ? [quotasOut.error] : [],
    ..."error" in concurrencyOut ? [concurrencyOut.error] : [],
    ...routeOut !== void 0 && "error" in routeOut ? [routeOut.error] : []
  ];
  if (gatewayErrors.length === (session !== void 0 && session !== "" ? 3 : 2)) {
    const error = gatewayErrors[0];
    if (isAbort(error)) return { status: "network", message: "aborted", fetchedAt };
    const kind = typeof error?.statusCode === "number" ? statusForStatusCode(error.statusCode) : error instanceof TypeError ? "network" : "unknown";
    return { status: kind, message: error instanceof Error ? error.message : void 0, fetchedAt };
  }
  const quotasData = "error" in quotasOut ? {} : quotasOut.data;
  const concurrencyData = "error" in concurrencyOut ? void 0 : concurrencyOut.data;
  const accountsRaw = Array.isArray(quotasData.data) ? quotasData.data : [];
  const accounts = accountsRaw.map(toAccountRow).filter((row) => row !== void 0).slice(0, TRACE_ACCOUNT_ROWS);
  const activeRaw = concurrencyData !== void 0 && Array.isArray(concurrencyData.active) ? concurrencyData.active : [];
  const active = activeRaw.map((entry) => toActiveRow(entry, session)).filter((row) => row !== void 0).sort((a, b) => (b.own === true ? 1 : 0) - (a.own === true ? 1 : 0) || b.ms - a.ms).slice(0, TRACE_ACTIVE_ROWS);
  const fullTraceData = fullTraceOut !== void 0 && "data" in fullTraceOut ? fullTraceOut.data : void 0;
  const routingUrl = defaultRoutingUrl;
  const fullRoutes = fullTraceData !== void 0 && Array.isArray(fullTraceData.routes) ? fullTraceData.routes : [];
  const matched = session !== void 0 ? [...fullRoutes].reverse().find((route) => str(route, "session") === session) : void 0;
  const matchedRoute = matched ?? (fullRoutes.length > 0 ? fullRoutes[fullRoutes.length - 1] : void 0);
  const sessionTrace = matchedRoute !== void 0 ? toSessionTrace(matchedRoute, accounts) : void 0;
  const traceFailure = fullTraceOut !== void 0 && "error" in fullTraceOut ? fullTraceOut.error : void 0;
  const webTraceError = webKey === void 0 || webKey.trim() === "" ? "missing-key" : traceFailure !== void 0 ? Number(traceFailure?.statusCode) === 401 ? "unauthorized" : Number(traceFailure?.statusCode) === 403 ? "forbidden" : "unavailable" : void 0;
  return {
    status: "ok",
    fetchedAt,
    routingUrl,
    ...webTraceError !== void 0 ? { webTraceError } : {},
    ...traceFailure instanceof Error ? { webTraceMessage: traceFailure.message } : {},
    ...accounts.length > 0 ? { accounts } : {},
    ...concurrencyData !== void 0 ? { concurrency: toConcurrency(concurrencyData) } : {},
    ...active.length > 0 ? { active } : {},
    ...routeOut !== void 0 && "data" in routeOut ? { sessionRoute: toSessionRoute(routeOut.data) } : {},
    ...sessionTrace !== void 0 ? { sessionTrace } : {}
  };
}

// src/search.ts
var MAGPIE_SEARCH_MCP_PATH = "/mcp/magpie/web-search";
var DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
var DEFAULT_SEARCH_MAX_TOKENS = 4096;
var DEFAULT_SEARCH_MAX_USES = 5;
var DEFAULT_SEARCH_TIMEOUT_MS = 12e4;
var MCP_SEARCH_MAX_COUNT = 20;
var DSH_USER_AGENT2 = "deepseek-harness/0.2.2-rc.1 (+https://github.com/deepseek-ai/deepseek-harness)";
var MagpieSearchError = class extends Error {
  code;
  constructor(message, code, options) {
    super(message, options);
    this.name = "MagpieSearchError";
    this.code = code;
  }
};
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}
function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}
function cleanTrailingUrlPunctuation(raw) {
  return raw.replace(/[.,;:!?)\]>'"`]+$/u, "");
}
function isHttpUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
function extractCitationSnippets(blocks) {
  const map = /* @__PURE__ */ new Map();
  for (const block of blocks) {
    if (block.type !== "text" || !Array.isArray(block.citations)) continue;
    for (const rawCite of block.citations) {
      if (!rawCite || typeof rawCite !== "object") continue;
      const url = typeof rawCite.url === "string" ? rawCite.url.trim() : "";
      const cited = typeof rawCite.cited_text === "string" ? rawCite.cited_text.trim() : "";
      if (url !== "" && cited !== "" && !map.has(url)) {
        map.set(url, cited);
      }
    }
  }
  return map;
}
function mapAnthropicSearchResponse(payload) {
  if (!payload || typeof payload !== "object") {
    throw new MagpieSearchError("Magpie returned a non-object Messages search response", "WEB_PROVIDER_ERROR");
  }
  const response = payload;
  const blocks = Array.isArray(response.content) ? response.content : [];
  const resultBlocks = blocks.filter((block) => block && typeof block === "object" && block.type === "web_search_tool_result");
  if (resultBlocks.length === 0) {
    throw new MagpieSearchError(
      "Magpie returned no web_search_tool_result blocks; the selected search model may not have triggered web search",
      "WEB_PROVIDER_ERROR"
    );
  }
  const citations = extractCitationSnippets(blocks);
  const seen = /* @__PURE__ */ new Set();
  const sources = [];
  for (const block of resultBlocks) {
    if (!Array.isArray(block.content)) continue;
    for (const rawItem of block.content) {
      if (!rawItem || typeof rawItem !== "object") continue;
      if (rawItem.type !== "web_search_result") continue;
      const url = typeof rawItem.url === "string" ? rawItem.url.trim() : "";
      if (url === "" || seen.has(url)) continue;
      seen.add(url);
      const title = typeof rawItem.title === "string" && rawItem.title.trim() !== "" ? rawItem.title.trim() : void 0;
      const ownSnippet = typeof rawItem.snippet === "string" && rawItem.snippet.trim() !== "" ? rawItem.snippet.trim() : void 0;
      const snippet = ownSnippet ?? citations.get(url);
      const publishedAt = typeof rawItem.page_age === "string" && rawItem.page_age.trim() !== "" ? rawItem.page_age.trim() : void 0;
      sources.push({
        url,
        ...title !== void 0 ? { title } : {},
        ...snippet !== void 0 ? { snippet } : {},
        ...publishedAt !== void 0 ? { publishedAt } : {}
      });
    }
  }
  return { sources, truncated: false };
}
var NUMBERED_ENTRY_RE = /^\d+\.\s+(?:(.+?)\s+[—–-]\s+)?(https?:\/\/\S+)\s*$/u;
var BULLET_DASH_RE = /^[-*]\s+(.+?)\s+[—–-]\s+(https?:\/\/\S+)\s*$/u;
var BULLET_MD_RE = /^[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\s*$/u;
var BULLET_URL_RE = /^[-*]\s+(https?:\/\/\S+)\s*$/u;
function parseSourcesSection(section) {
  const seen = /* @__PURE__ */ new Set();
  const sources = [];
  for (const rawLine of section.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "") continue;
    let title;
    let url;
    const dash = BULLET_DASH_RE.exec(line);
    if (dash) {
      title = dash[1]?.trim();
      url = dash[2]?.trim();
    } else {
      const md = BULLET_MD_RE.exec(line);
      if (md) {
        title = md[1]?.trim();
        url = md[2]?.trim();
      } else {
        const bare = BULLET_URL_RE.exec(line);
        if (bare) url = bare[1]?.trim();
      }
    }
    if (url === void 0) continue;
    url = cleanTrailingUrlPunctuation(url);
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    sources.push({
      url,
      ...title !== void 0 && title !== "" ? { title } : {}
    });
  }
  return sources;
}
function extractFallbackSources(text) {
  const seen = /* @__PURE__ */ new Set();
  const sources = [];
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gu;
  for (const match of text.matchAll(mdRe)) {
    const title = match[1]?.trim();
    const url = cleanTrailingUrlPunctuation(match[2] ?? "");
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    sources.push({
      url,
      ...title !== void 0 && title !== "" ? { title } : {}
    });
  }
  const urlRe = /https?:\/\/[^\s<>()]+/gu;
  for (const match of text.matchAll(urlRe)) {
    const url = cleanTrailingUrlPunctuation(match[0]);
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    sources.push({ url });
  }
  return sources;
}
function parseMagpieMcpSearchText(raw) {
  const text = raw.trim();
  if (text === "") return { sources: [], truncated: false };
  const lines = text.split(/\r?\n/u);
  const numberedIndices = [];
  for (let i = 0; i < lines.length; i++) {
    const match = NUMBERED_ENTRY_RE.exec(lines[i]?.trim() ?? "");
    if (!match) continue;
    const url = cleanTrailingUrlPunctuation(match[2] ?? "");
    if (!isHttpUrl(url)) continue;
    const title = match[1]?.trim();
    numberedIndices.push({ index: i, ...title !== void 0 && title !== "" ? { title } : {}, url });
  }
  if (numberedIndices.length > 0) {
    const preamble = lines.slice(0, numberedIndices[0].index).join("\n").trim();
    const seen = /* @__PURE__ */ new Set();
    const sources = [];
    for (let i = 0; i < numberedIndices.length; i++) {
      const current = numberedIndices[i];
      if (seen.has(current.url)) continue;
      seen.add(current.url);
      const nextStart = numberedIndices[i + 1]?.index ?? lines.length;
      const snippet = lines.slice(current.index + 1, nextStart).join("\n").trim();
      sources.push({
        url: current.url,
        ...current.title !== void 0 ? { title: current.title } : {},
        ...snippet !== "" ? { snippet } : {}
      });
    }
    return {
      ...preamble !== "" ? { content: preamble } : {},
      sources,
      truncated: false
    };
  }
  const sourcesSplit = /(?:^|\r?\n)Sources:\r?\n/u.exec(text);
  if (sourcesSplit) {
    const content = text.slice(0, sourcesSplit.index).trim();
    const section = text.slice(sourcesSplit.index + sourcesSplit[0].length);
    const sources = parseSourcesSection(section);
    return {
      ...content !== "" ? { content } : {},
      sources,
      truncated: false
    };
  }
  return {
    content: text,
    sources: extractFallbackSources(text),
    truncated: false
  };
}
function createRequestSignal(timeoutMs, external) {
  const controller = new AbortController();
  let expired = false;
  const onExternalAbort = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }
  const timer = timeoutMs > 0 ? setTimeout(() => {
    expired = true;
    controller.abort(new Error(`Magpie web search timed out after ${timeoutMs}ms`));
  }, timeoutMs) : void 0;
  return {
    signal: controller.signal,
    timedOut: () => expired,
    cleanup: () => {
      if (timer !== void 0) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    }
  };
}
async function readHttpErrorDetail(response) {
  let raw = "";
  try {
    raw = (await response.text()).trim();
  } catch {
    return "";
  }
  if (raw === "") return "";
  try {
    const parsed = JSON.parse(raw);
    const detail = typeof parsed.error === "string" ? parsed.error : typeof parsed.error?.message === "string" ? parsed.error.message : typeof parsed.message === "string" ? parsed.message : "";
    if (detail.trim() !== "") return detail.trim();
  } catch {
  }
  return raw.slice(0, 300);
}
async function searchViaMagpieMcp(options, signal) {
  if (signal?.aborted) {
    throw new MagpieSearchError("Magpie web search aborted", "WEB_ABORTED", { cause: signal.reason });
  }
  const gatewayBase = deriveGatewayBase(options.baseUrl);
  if (gatewayBase === void 0) {
    throw new MagpieSearchError(`Invalid Magpie baseUrl: ${options.baseUrl}`, "WEB_PROVIDER_ERROR");
  }
  const endpoint = `${gatewayBase}${MAGPIE_SEARCH_MCP_PATH}`;
  const count = options.maxResults !== void 0 && isPositiveInteger(options.maxResults) ? Math.min(options.maxResults, MCP_SEARCH_MAX_COUNT) : void 0;
  const rpcBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "web_search",
      arguments: {
        query: options.query,
        ...count !== void 0 ? { count } : {}
      }
    }
  };
  const fetchImpl = options.fetchImpl ?? fetch;
  const guarded = createRequestSignal(options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS, signal);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": DSH_USER_AGENT2
      },
      body: JSON.stringify(rpcBody),
      signal: guarded.signal
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new MagpieSearchError("Magpie web search aborted", "WEB_ABORTED", { cause: signal.reason ?? error });
    }
    if (guarded.timedOut() || isAbortError(error)) {
      throw new MagpieSearchError(
        `Magpie MCP search timed out after ${options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS}ms (${endpoint})`,
        "WEB_PROVIDER_ERROR",
        { cause: error }
      );
    }
    throw new MagpieSearchError(
      `Magpie MCP search request failed (${endpoint}): ${error instanceof Error ? error.message : String(error)}`,
      "WEB_PROVIDER_ERROR",
      { cause: error }
    );
  } finally {
    guarded.cleanup();
  }
  if (!response.ok) {
    const detail = await readHttpErrorDetail(response);
    const suffix = detail !== "" ? `: ${detail}` : "";
    const hint = response.status === 404 ? " (Magpie gateway or reverse proxy does not expose /mcp/magpie/web-search; try switching search mode to a specific Magpie model)" : response.status === 403 ? ' (check Magpie "Share on local network" and gateway key permissions)' : "";
    throw new MagpieSearchError(
      `Magpie MCP search HTTP ${response.status}${suffix}${hint}`,
      "WEB_PROVIDER_ERROR"
    );
  }
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new MagpieSearchError(
      `Magpie MCP search returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "WEB_PROVIDER_ERROR",
      { cause: error }
    );
  }
  if (payload.error) {
    const msg = typeof payload.error.message === "string" && payload.error.message !== "" ? payload.error.message : `JSON-RPC error ${String(payload.error.code ?? "unknown")}`;
    throw new MagpieSearchError(`Magpie MCP search error: ${msg}`, "WEB_PROVIDER_ERROR");
  }
  const textParts = Array.isArray(payload.result?.content) ? payload.result.content.filter((item) => item && item.type === "text" && typeof item.text === "string").map((item) => item.text) : [];
  const combined = textParts.join("\n").trim();
  if (payload.result?.isError === true) {
    throw new MagpieSearchError(combined !== "" ? combined : "Magpie MCP web_search tool returned an error", "WEB_PROVIDER_ERROR");
  }
  return parseMagpieMcpSearchText(combined);
}
async function searchViaMagpieModel(options, signal) {
  if (signal?.aborted) {
    throw new MagpieSearchError("Magpie web search aborted", "WEB_ABORTED", { cause: signal.reason });
  }
  const model = options.model.trim();
  if (model === "") {
    throw new MagpieSearchError(
      "Magpie model search requires a search model \u2014 select one on Settings \u2192 Magpie",
      "WEB_PROVIDER_ERROR"
    );
  }
  const endpoint = `${options.baseUrl.replace(/\/+$/, "")}/messages`;
  const maxUses = options.maxUses ?? DEFAULT_SEARCH_MAX_USES;
  const maxTokens = options.maxTokens ?? DEFAULT_SEARCH_MAX_TOKENS;
  const apiVersion = options.apiVersion ?? DEFAULT_ANTHROPIC_VERSION;
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `Perform a web search for the query: ${options.query}` }]
      }
    ],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses }],
    thinking: { type: "disabled" }
  };
  const fetchImpl = options.fetchImpl ?? fetch;
  const guarded = createRequestSignal(options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS, signal);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "x-api-key": options.apiKey,
        "anthropic-version": apiVersion,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": DSH_USER_AGENT2
      },
      body: JSON.stringify(body),
      signal: guarded.signal
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new MagpieSearchError("Magpie web search aborted", "WEB_ABORTED", { cause: signal.reason ?? error });
    }
    if (guarded.timedOut() || isAbortError(error)) {
      throw new MagpieSearchError(
        `Magpie model search timed out after ${options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS}ms (${endpoint})`,
        "WEB_PROVIDER_ERROR",
        { cause: error }
      );
    }
    throw new MagpieSearchError(
      `Magpie model search request failed (${endpoint}): ${error instanceof Error ? error.message : String(error)}`,
      "WEB_PROVIDER_ERROR",
      { cause: error }
    );
  } finally {
    guarded.cleanup();
  }
  if (!response.ok) {
    const detail = await readHttpErrorDetail(response);
    const suffix = detail !== "" ? `: ${detail}` : "";
    throw new MagpieSearchError(
      `Magpie model search HTTP ${response.status}${suffix} (${endpoint}, model=${model})`,
      "WEB_PROVIDER_ERROR"
    );
  }
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new MagpieSearchError(
      `Magpie model search returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "WEB_PROVIDER_ERROR",
      { cause: error }
    );
  }
  return mapAnthropicSearchResponse(payload);
}
var MagpieSearchProvider = class {
  id;
  title;
  description = {
    en: "Search the web through the Magpie gateway (follows Magpie\u2019s own search settings by default, or a selected Magpie model). Configure on the Magpie settings page.",
    zh: "\u901A\u8FC7 Magpie \u7F51\u5173\u6267\u884C\u7F51\u9875\u641C\u7D22\uFF08\u9ED8\u8BA4\u6CBF\u7528 Magpie \u81EA\u8EAB\u7684\u4EE3\u641C\u6A21\u578B\u6216 Search API \u914D\u7F6E\uFF0C\u4E5F\u53EF\u6307\u5B9A Magpie \u6A21\u578B\uFF09\u3002\u5728\u300CMagpie \u7F51\u5173\u300D\u8BBE\u7F6E\u9875\u4E2D\u914D\u7F6E\u3002"
  };
  #resolveSnapshot;
  #fetchImpl;
  constructor(options) {
    this.id = options.id;
    this.title = options.title ?? "Magpie";
    this.#resolveSnapshot = options.resolveSnapshot;
    this.#fetchImpl = options.fetchImpl ?? fetch;
  }
  /**
   * 同步结构可用性检查：仅校验地址和数值参数是否合法，不检查凭据是否已填。
   * 凭据与模型完备性交由 `ready()` 决定，以便未配置完成时 `dsh-tool-web`
   * 优雅撤下 `web_search` 而不是报 `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`。
   */
  available() {
    const { endpoint, search } = this.#resolveSnapshot();
    if (!isHttpUrl(endpoint.baseUrl)) return false;
    if (search.mode === "mcp") return deriveGatewayBase(endpoint.baseUrl) !== void 0;
    return isPositiveInteger(search.maxUses);
  }
  /** 异步就绪检查：必须具备网关地址、API Key，且 model 模式下必须已指定模型。 */
  async ready() {
    const { endpoint, search } = this.#resolveSnapshot();
    if (!isConfigured(endpoint) || !isHttpUrl(endpoint.baseUrl)) return false;
    if (search.mode === "mcp") return deriveGatewayBase(endpoint.baseUrl) !== void 0;
    return search.model.trim() !== "" && isPositiveInteger(search.maxUses);
  }
  async search(request, signal) {
    const { endpoint, search } = this.#resolveSnapshot();
    if (!isConfigured(endpoint)) {
      throw new MagpieSearchError(
        "Magpie gateway API URL or API key is not configured \u2014 fill in both on Settings \u2192 Magpie",
        "WEB_PROVIDER_CREDENTIAL_MISSING"
      );
    }
    const query = request.query.trim();
    if (query === "") {
      throw new MagpieSearchError("Magpie web search query must not be empty", "WEB_PROVIDER_ERROR");
    }
    if (search.mode === "mcp") {
      return await searchViaMagpieMcp(
        {
          baseUrl: endpoint.baseUrl,
          apiKey: endpoint.apiKey,
          query,
          ...request.maxResults !== void 0 ? { maxResults: request.maxResults } : {},
          timeoutMs: search.timeoutMs,
          fetchImpl: this.#fetchImpl
        },
        signal
      );
    }
    return await searchViaMagpieModel(
      {
        baseUrl: endpoint.baseUrl,
        apiKey: endpoint.apiKey,
        model: search.model,
        query,
        maxUses: search.maxUses,
        timeoutMs: search.timeoutMs,
        fetchImpl: this.#fetchImpl
      },
      signal
    );
  }
};

// src/mcp.ts
var MAGPIE_HUB_MCP_PATH = "/mcp/magpie/hub";
var DEFAULT_MCP_AGENT = "";
function normalizeMcpAgent(raw) {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (value === "") return "";
  if (value === "-" || value.toLowerCase() === "all") return "all";
  const lower = value.toLowerCase().replace(/[\s_]+/gu, "-");
  if (lower === "deepseek-harness" || lower === "deepseekharness" || lower === "dsh") return "dsh";
  return value;
}
var DEFAULT_HUB_AGENT = "dsh";
function resolveHubAgent(configured) {
  if (configured === "all") return "";
  return configured === "" ? DEFAULT_HUB_AGENT : configured;
}
function magpieHubMcpUrl(endpoint, agent = DEFAULT_MCP_AGENT) {
  if (!isConfigured(endpoint)) return void 0;
  let normalised;
  try {
    normalised = normalizeBaseUrl(endpoint.baseUrl);
  } catch {
    return void 0;
  }
  const base = deriveGatewayBase(normalised);
  if (base === void 0 || base === "") return void 0;
  const segment = agent === "" ? "" : `/${encodeURIComponent(agent)}`;
  return `${base}${MAGPIE_HUB_MCP_PATH}${segment}`;
}
function buildHubRegistration(endpoint, options) {
  const url = magpieHubMcpUrl(endpoint, options.agent ?? DEFAULT_MCP_AGENT);
  if (url === void 0) return null;
  const key = endpoint.apiKey.trim();
  return {
    transport: "streamable-http",
    url,
    ...key === "" ? {} : { headers: { Authorization: `Bearer ${key}` } },
    toolCallTimeoutMs: options.toolCallTimeoutMs,
    startupTimeoutMs: options.startupTimeoutMs ?? 3e4
  };
}
function hubFingerprint(registration) {
  if (registration === null) return void 0;
  return `${registration.url}\0${registration.headers?.Authorization ?? ""}`;
}
async function probeMagpieHub(endpoint, options) {
  const registration = buildHubRegistration(endpoint, {
    toolCallTimeoutMs: options.timeoutMs,
    agent: options.agent ?? DEFAULT_MCP_AGENT
  });
  if (registration === null) {
    return { ok: false, toolNames: [], toolCount: 0, error: "endpoint is not configured" };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs)]) : AbortSignal.timeout(options.timeoutMs);
  const headers = {
    "content-type": "application/json",
    accept: "application/json",
    ...registration.headers ?? {}
  };
  let sessionId;
  const post = async (body) => {
    const response = await fetchImpl(registration.url, {
      method: "POST",
      redirect: "error",
      headers: { ...headers, ...sessionId !== void 0 ? { "Mcp-Session-Id": sessionId } : {} },
      body: JSON.stringify(body),
      signal
    });
    const nextSession = response.headers.get("mcp-session-id") ?? void 0;
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const suffix = detail.trim() !== "" ? `: ${detail.trim().slice(0, 300)}` : "";
      const hint = response.status === 403 ? ' (enable "Share on local network" in Magpie \u2192 Network and sharing, and check the key allows MCP)' : response.status === 404 ? " (the gateway or a reverse proxy does not expose /mcp/magpie/hub)" : "";
      throw new Error(`MCP hub HTTP ${response.status}${suffix}${hint}`);
    }
    const text = await response.text();
    if (text.trim() === "") return { reply: {}, session: nextSession };
    try {
      return { reply: JSON.parse(text), session: nextSession };
    } catch {
      throw new Error("MCP hub returned invalid JSON");
    }
  };
  try {
    const init = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "dsh-magpie-connect", version: "0" }
      }
    });
    sessionId = init.session;
    if (init.reply.error !== void 0) {
      throw new Error(`initialize failed: ${String(init.reply.error.message ?? init.reply.error.code ?? "unknown error")}`);
    }
    await post({ jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => ({ reply: {} }));
    const listed = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    if (listed.reply.error !== void 0) {
      throw new Error(`tools/list failed: ${String(listed.reply.error.message ?? listed.reply.error.code ?? "unknown error")}`);
    }
    const tools = Array.isArray(listed.reply.result?.tools) ? listed.reply.result?.tools ?? [] : [];
    const toolNames = tools.map((tool) => typeof tool?.name === "string" ? tool.name : "").filter((name2) => name2 !== "");
    const instructions = typeof init.reply.result?.instructions === "string" ? init.reply.result.instructions : void 0;
    const hubOff = instructions !== void 0 && /MCP hub is off|hub is off/iu.test(instructions);
    return {
      ok: true,
      toolNames: toolNames.slice(0, 50),
      toolCount: toolNames.length,
      ...hubOff ? { hubOff: true } : {},
      ...instructions !== void 0 ? { instructions } : {}
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? `probe timed out after ${options.timeoutMs}ms` : error instanceof Error ? error.message : String(error);
    return { ok: false, toolNames: [], toolCount: 0, error: message };
  }
}
async function postRpc(url, headers, body, fetchImpl, signal) {
  const response = await fetchImpl(url, {
    method: "POST",
    redirect: "error",
    headers,
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const suffix = detail.trim() !== "" ? `: ${detail.trim().slice(0, 300)}` : "";
    const hint = response.status === 403 ? ' (enable "Share on local network" in Magpie \u2192 Network and sharing, and check the key allows MCP)' : response.status === 404 ? " (the gateway or a reverse proxy does not expose /mcp/magpie/hub)" : "";
    throw new Error(`MCP hub HTTP ${response.status}${suffix}${hint}`);
  }
  const text = await response.text();
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("MCP hub returned invalid JSON");
  }
}
function textOf(result) {
  if (result === void 0) return "";
  const content = result.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => block !== null && typeof block === "object" && typeof block.text === "string" ? block.text : "").filter((part) => part !== "").join("\n");
}
function hubHeaders(apiKey) {
  const key = apiKey.trim();
  return {
    "content-type": "application/json",
    accept: "application/json",
    ...key === "" ? {} : { authorization: `Bearer ${key}` }
  };
}
async function listHubTools(endpoint, options) {
  const url = magpieHubMcpUrl(endpoint, options.agent ?? DEFAULT_MCP_AGENT);
  if (url === void 0) throw new Error("dsh-magpie-connect: endpoint is not configured");
  const fetchImpl = options.fetchImpl ?? fetch;
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs)]) : AbortSignal.timeout(options.timeoutMs);
  const reply = await postRpc(url, hubHeaders(endpoint.apiKey), { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }, fetchImpl, signal);
  if (reply.error !== void 0) {
    const e = reply.error;
    throw new Error(`tools/list failed: ${String(e.message ?? e.code ?? "unknown error")}`);
  }
  const result = reply.result;
  const tools = result !== void 0 && Array.isArray(result.tools) ? result.tools : [];
  return tools.filter((tool) => typeof tool?.name === "string" && tool.name !== "").map((tool) => ({
    name: tool.name,
    ...typeof tool.description === "string" ? { description: tool.description } : {},
    ...tool.inputSchema !== null && typeof tool.inputSchema === "object" ? { inputSchema: tool.inputSchema } : {},
    ...tool.outputSchema !== null && typeof tool.outputSchema === "object" ? { outputSchema: tool.outputSchema } : {}
  }));
}
async function callHubTool(endpoint, name2, args, options) {
  const url = magpieHubMcpUrl(endpoint, options.agent ?? DEFAULT_MCP_AGENT);
  if (url === void 0) throw new Error("dsh-magpie-connect: endpoint is not configured");
  const fetchImpl = options.fetchImpl ?? fetch;
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs)]) : AbortSignal.timeout(options.timeoutMs);
  const reply = await postRpc(
    url,
    hubHeaders(endpoint.apiKey),
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name2, arguments: args ?? {} } },
    fetchImpl,
    signal
  );
  if (reply.error !== void 0) {
    const e = reply.error;
    throw new Error(`tools/call failed: ${String(e.message ?? e.code ?? "unknown error")}`);
  }
  const result = reply.result;
  return { text: textOf(result), isError: result?.isError === true };
}
var HUB_FIND_TOOL = "find_tools";
var HUB_CALL_TOOL = "call_tool";
var HUB_RUN_CODE_TOOL = "run_code";
var MCP_ON_DEMAND_OVER = 10;

// src/mcp-tools.ts
import { createHash } from "node:crypto";
var MCP_TOOL_PREFIX = "mcp__magpie__";
var MAX_TOOL_NAME = 64;
function publicToolName(hubName) {
  const base = `${MCP_TOOL_PREFIX}${hubName}`;
  const safe = base.replace(/[^A-Za-z0-9_-]/gu, "-");
  if (safe.length <= MAX_TOOL_NAME) return safe;
  const hash = createHash("sha256").update(base).digest("hex").slice(0, 12);
  return `${safe.slice(0, MAX_TOOL_NAME - hash.length - 1)}_${hash}`;
}
function textOutput() {
  return {
    schema: {
      type: "object",
      properties: { content: { type: "array", items: {} } },
      required: ["content"],
      additionalProperties: false
    },
    render(_args, value) {
      const record = value !== null && typeof value === "object" ? value : {};
      const content = Array.isArray(record.content) ? record.content : [];
      const text = content.map((block) => block !== null && typeof block === "object" && typeof block.text === "string" ? block.text : "").join("\n");
      return [{ type: "text", text }];
    }
  };
}
async function runHubTool(options, hubName, args, exec) {
  const result = await callHubTool(options.getEndpoint(), hubName, args, {
    timeoutMs: options.toolCallTimeoutMs,
    agent: options.agent,
    ...exec.signal !== void 0 ? { signal: exec.signal } : {}
  });
  if (result.isError) throw new Error(result.text !== "" ? result.text : `${hubName} returned an error`);
  return { content: [{ type: "text", text: result.text }] };
}
function directToolDefinition(tool, options) {
  return {
    name: publicToolName(tool.name),
    description: tool.description ?? `Magpie tool ${tool.name}`,
    parameters: tool.inputSchema ?? { type: "object", properties: {} },
    timeoutMs: options.toolCallTimeoutMs,
    output: textOutput(),
    execute: (args, exec) => runHubTool(options, tool.name, args, exec)
  };
}
var FIND_CATALOG_MAX = 1200;
function groupHubTools(tools) {
  const groups = /* @__PURE__ */ new Map();
  for (const tool of tools) {
    const at = tool.name.indexOf("__");
    const server = at > 0 ? tool.name.slice(0, at) : "";
    const name2 = at > 0 ? tool.name.slice(at + 2) : tool.name;
    if (name2 === "") continue;
    const key = server === "" ? "(other)" : server;
    groups.set(key, [...groups.get(key) ?? [], name2]);
  }
  return [...groups].map(([server, names]) => ({ server, tools: names }));
}
function buildToolCatalog(tools, maxChars = FIND_CATALOG_MAX) {
  const groups = groupHubTools(tools);
  if (groups.length === 0) return "";
  const total = groups.reduce((sum, group) => sum + group.tools.length, 0);
  const heading = `Servers behind this hub (${groups.length}) with ${total} tools in total: ` + groups.map((group) => `${group.server} (${group.tools.length})`).join(", ") + ".";
  let left = maxChars - heading.length - 1;
  if (left <= 0) return heading;
  const order = [...groups.keys()].sort((a, b) => groups[a].tools.length - groups[b].tools.length);
  const lines = new Array(groups.length).fill("");
  order.forEach((index, position) => {
    const group = groups[index];
    const share = Math.max(24, Math.floor(left / (order.length - position)) - 1);
    const prefix = `- ${group.server}: `;
    const shown = [];
    let used = prefix.length;
    for (const name2 of group.tools) {
      const piece = (shown.length === 0 ? "" : ", ") + name2;
      if (used + piece.length > share) break;
      shown.push(name2);
      used += piece.length;
    }
    if (shown.length === 0) {
      lines[index] = `${prefix}${group.tools.length} tools`;
    } else {
      const rest = group.tools.length - shown.length;
      lines[index] = `${prefix}${shown.join(", ")}${rest > 0 ? ` (+${rest} more)` : ""}`;
    }
    left -= lines[index].length + 1;
  });
  return [heading, ...lines.filter((line) => line !== "")].join("\n");
}
function findToolsDefinition(options, tools = []) {
  const catalog = buildToolCatalog(tools);
  const how = `Find the tools of the Magpie MCP hub that match a query. Give words of what you want done, or a tool name; an empty query lists every tool. Each match comes back with its description and parameters (inputSchema) \u2014 run one with ${MCP_TOOL_PREFIX}${HUB_CALL_TOOL}.`;
  return {
    name: `${MCP_TOOL_PREFIX}${HUB_FIND_TOOL}`,
    description: catalog === "" ? how : `${catalog}
${how}`,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words of what you want done, or a tool's name; empty lists every tool" },
        server: { type: "string", description: "Only this server's tools" }
      },
      additionalProperties: false
    },
    timeoutMs: options.toolCallTimeoutMs,
    output: textOutput(),
    execute: (args, exec) => runHubTool(options, HUB_FIND_TOOL, args, exec)
  };
}
function callToolDefinition(options) {
  return {
    name: `${MCP_TOOL_PREFIX}${HUB_CALL_TOOL}`,
    description: `Run a tool of the Magpie MCP hub by its <server>__<tool> name, with arguments as its inputSchema says. If you do not know the exact name, call ${MCP_TOOL_PREFIX}${HUB_FIND_TOOL} first \u2014 it returns matching tools with their names, descriptions and parameters.`,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The tool's name, <server>__<tool>" },
        arguments: { type: "object", description: "The tool's arguments, as its inputSchema says" }
      },
      required: ["name"],
      additionalProperties: false
    },
    timeoutMs: options.toolCallTimeoutMs,
    output: textOutput(),
    execute: (args, exec) => runHubTool(options, HUB_CALL_TOOL, args, exec)
  };
}
function isHubOnDemandPair(tools) {
  if (tools.length === 0) return false;
  const names = new Set(tools.map((tool) => tool.name));
  if (!names.has(HUB_FIND_TOOL) || !names.has(HUB_CALL_TOOL)) return false;
  return [...names].every((name2) => name2 === HUB_FIND_TOOL || name2 === HUB_CALL_TOOL || name2 === HUB_RUN_CODE_TOOL);
}
function toolModeFor(tools) {
  if (isHubOnDemandPair(tools)) return "passthrough";
  return tools.length > MCP_ON_DEMAND_OVER ? "on-demand" : "direct";
}
var MagpieToolRegistrar = class {
  #tools;
  #options;
  #disposers = [];
  #mode = "direct";
  #toolCount = 0;
  #disposed = false;
  constructor(tools, options) {
    this.#tools = tools;
    this.#options = options;
  }
  /** Current exposure: how many hub tools exist, the mode, and how many DSH tools are registered. */
  state() {
    return { mode: this.#mode, hubToolCount: this.#toolCount, registeredCount: this.#disposers.length };
  }
  /** Register the hub's tools in the mode its count selects. Replaces any previous set. */
  apply(tools) {
    if (this.#disposed) return;
    this.unregister();
    this.#toolCount = tools.length;
    this.#mode = toolModeFor(tools);
    const definitions = this.#mode === "passthrough" ? (
      // Magpie already answered with its own find_tools/call_tool: keep its
      // definitions verbatim, catalog included.
      tools.map((tool) => directToolDefinition(tool, this.#options))
    ) : this.#mode === "on-demand" ? [findToolsDefinition(this.#options, tools), callToolDefinition(this.#options)] : tools.map((tool) => directToolDefinition(tool, this.#options));
    for (const definition of definitions) {
      try {
        this.#disposers.push(this.#tools.register(definition));
      } catch {
      }
    }
  }
  /** Unregister every tool this registrar registered. Idempotent. */
  unregister() {
    for (const dispose of this.#disposers) {
      try {
        dispose();
      } catch {
      }
    }
    this.#disposers = [];
  }
  /** Release everything and refuse further registration. */
  dispose() {
    this.#disposed = true;
    this.unregister();
  }
};

// src/index.ts
var name = "dsh-magpie-connect";
var inject = ["llm"];
var SETTINGS_API = "/api/magpie-settings";
var MODELS_API = "/api/magpie-models";
var TEST_API = "/api/magpie-test";
var DISCOVER_API = "/api/magpie-discover";
var TRACE_API = "/api/magpie-trace";
var ICON_API = "/api/magpie-icon";
var SEARCH_TEST_API = "/api/magpie-search-test";
var MCP_TEST_API = "/api/magpie-mcp-test";
var SAVE_REFRESH_WAIT_MS = 5e3;
var SEARCH_TEST_TIMEOUT_MS = 25e3;
var MCP_TEST_TIMEOUT_MS = 2e4;
function responsesOnlyFor(nativeEndpoints) {
  if (nativeEndpoints.length === 0) return false;
  const hasCompletions = nativeEndpoints.some((endpoint) => endpoint.includes("/chat/completions"));
  return !hasCompletions && nativeEndpoints.some((endpoint) => endpoint.includes("/responses"));
}
function compareModelRows(left, right) {
  return left.displayName.localeCompare(right.displayName, "zh") || left.id.localeCompare(right.id);
}
function toRow(id, entry) {
  return {
    id,
    displayName: entry?.displayName ?? id,
    ...entry?.contextWindow !== void 0 ? { contextWindow: entry.contextWindow } : {},
    ...entry?.maxTokens !== void 0 ? { maxTokens: entry.maxTokens } : {},
    image: entry?.image ?? false,
    responsesOnly: responsesOnlyFor(entry?.nativeEndpoints ?? []),
    reasoning: entry?.reasoning ?? false,
    efforts: entry?.efforts ?? []
  };
}
var currentBackend = null;
var liveRouteSets = 0;
var routeDisposers = null;
var ownedSearchProviders = /* @__PURE__ */ new Set();
var pendingSearchRegistrations = /* @__PURE__ */ new Map();
function __resetSearchProviders() {
  ownedSearchProviders.clear();
  pendingSearchRegistrations.clear();
}
function __resetSettingsRoutes() {
  currentBackend = null;
  liveRouteSets = 0;
  routeDisposers = null;
  ownedSearchProviders.clear();
  pendingSearchRegistrations.clear();
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
  const allowlist = store.get().enabledModels;
  const allowed = allowlist === void 0 ? void 0 : new Set(allowlist);
  return catalog.directory().map((id) => ({
    ...toRow(id, catalog.getEntry(id)),
    enabled: allowed === void 0 || allowed.has(id),
    source: catalog.sourceFor(id)
  })).sort(compareModelRows);
}
function backendOrThrow() {
  if (!currentBackend) throw new Error("dsh-magpie-connect: settings backend not ready");
  return currentBackend;
}
function settingsView(backend) {
  const page = backend.store.get();
  const endpoint = resolveEffectiveEndpoint(backend.patchEndpoint, page);
  const search = resolveEffectiveSearchSettings(backend.patchSearch, page);
  const binding = backend.readWebSearchState();
  const mcp = backend.readMcpState();
  return {
    baseUrl: endpoint.baseUrl,
    hasApiKey: endpoint.apiKey !== "",
    hasWebKey: (page.webKey ?? "").trim() !== "",
    enabledModels: page.enabledModels,
    inheritedModels: page.enabledModels === void 0,
    showComposerIcon: page.showComposerIcon !== false,
    mcpEnabled: page.mcpEnabled === true,
    mcpAvailable: mcp.available,
    mcpRegistered: mcp.registered,
    ...mcp.mode !== void 0 ? { mcpMode: mcp.mode } : {},
    ...mcp.address !== void 0 ? { mcpAddress: mcp.address } : {},
    ...mcp.hubToolCount !== void 0 ? { mcpHubToolCount: mcp.hubToolCount } : {},
    ...mcp.registeredCount !== void 0 ? { mcpRegisteredCount: mcp.registeredCount } : {},
    ...mcp.status !== void 0 ? { mcpStatus: mcp.status } : {},
    ...mcp.status?.state === "failed" && mcp.status.lastError !== void 0 ? { mcpError: mcp.status.lastError } : {},
    searchMode: search.mode,
    searchModel: search.model,
    searchMaxUses: search.maxUses,
    searchActive: binding.active,
    searchProviderId: backend.providerId,
    searchRegistered: binding.registered,
    searchSwitchable: binding.switchable,
    ...binding.activeProvider !== void 0 ? { activeSearchProvider: binding.activeProvider } : {}
  };
}
function stripBlankApiKey(backend, body) {
  if (!body || typeof body !== "object") return body;
  const record = body;
  const rest = { ...record };
  if (typeof record.apiKey === "string" && record.apiKey.trim() === "") {
    if (resolveEffectiveEndpoint(backend.patchEndpoint, backend.store.get()).apiKey === "") {
      throw new Error("dsh-magpie-connect: apiKey is required and must not be empty");
    }
    delete rest.apiKey;
  }
  if (typeof record.webKey === "string" && record.webKey.trim() === "") delete rest.webKey;
  return rest;
}
async function handleSettingsGet() {
  try {
    return routeOk(settingsView(backendOrThrow()));
  } catch (error) {
    return routeFail(error);
  }
}
async function handleSettingsPost(request) {
  try {
    const backend = backendOrThrow();
    const body = await readRouteBody(request);
    let searchActive;
    if (body && typeof body === "object" && "searchActive" in body) {
      const rawActive = body.searchActive;
      if (rawActive !== void 0) {
        if (typeof rawActive !== "boolean") {
          throw new Error("dsh-magpie-connect: searchActive must be a boolean");
        }
        searchActive = rawActive;
      }
    }
    const normalized = normalizePageSettings(stripBlankApiKey(backend, body));
    const mergedPage = { ...backend.store.get(), ...normalized };
    const nextEndpoint = resolveEffectiveEndpoint(backend.patchEndpoint, mergedPage);
    const nextSearch = resolveEffectiveSearchSettings(backend.patchSearch, mergedPage);
    const currentBinding = backend.readWebSearchState();
    const willBeActive = searchActive ?? currentBinding.active;
    if (searchActive === true) {
      if (!currentBinding.registered) {
        throw new Error("dsh-magpie-connect: DSH web search service is unavailable in this composition");
      }
      if (!currentBinding.switchable) {
        throw new Error("dsh-magpie-connect: cannot update DSH web.searchProvider automatically; select Magpie in DSH Web search settings");
      }
      if (!isConfigured(nextEndpoint)) {
        throw new Error("dsh-magpie-connect: configure API URL and apiKey before enabling Magpie web search");
      }
    }
    if (willBeActive && (searchActive === true || normalized.searchMode !== void 0 || normalized.searchModel !== void 0) && nextSearch.mode === "model" && nextSearch.model.trim() === "") {
      throw new Error('dsh-magpie-connect: searchModel is required when searchMode is "model"');
    }
    if (normalized.mcpEnabled === true) {
      const mcpState = backend.readMcpState();
      if (!mcpState.available) {
        throw new Error("dsh-magpie-connect: DSH MCP manager is unavailable in this composition");
      }
      if (!isConfigured(nextEndpoint)) {
        throw new Error("dsh-magpie-connect: configure API URL and apiKey before enabling the Magpie MCP hub");
      }
    }
    const hasPageFields = Object.keys(normalized).length > 0;
    if (searchActive !== void 0) {
      const previousProvider = currentBinding.activeProvider;
      const willMutateProvider = searchActive && previousProvider !== backend.providerId || !searchActive && previousProvider === backend.providerId;
      await backend.setWebSearchActive(searchActive);
      if (hasPageFields) {
        try {
          await backend.store.save(normalized);
          backend.applyPageSettings();
        } catch (saveError) {
          if (willMutateProvider) {
            await backend.restoreWebSearchProvider(previousProvider).catch(() => {
            });
          }
          throw saveError;
        }
      }
    } else {
      await backend.store.save(normalized);
      backend.applyPageSettings();
    }
    if (normalized.baseUrl !== void 0 || normalized.apiKey !== void 0) {
      await Promise.race([
        backend.catalog.refreshOnce(),
        new Promise((resolve2) => setTimeout(resolve2, SAVE_REFRESH_WAIT_MS))
      ]);
    }
    if (normalized.mcpEnabled !== void 0 || normalized.baseUrl !== void 0 || normalized.apiKey !== void 0) {
      await Promise.race([
        backend.reconcileMcp(),
        new Promise((resolve2) => setTimeout(resolve2, SAVE_REFRESH_WAIT_MS))
      ]);
    }
    return routeOk(settingsView(backend));
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
function probeTarget(backend, body) {
  const effective = backend.effective();
  const origin = normalizeBaseUrl(body.baseUrl ?? effective.baseUrl);
  const typed = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const key = typed === "" ? effective.apiKey.trim() : typed;
  if (key === "") throw new Error("dsh-magpie-connect: apiKey is required \u2014 fill it in before asking the gateway");
  return { origin, key };
}
function hintGatewayFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  const hinted = /HTTP 404/.test(message) && !/网关返回 404/.test(message) ? `${message}\uFF08\u7F51\u5173\u8FD4\u56DE 404\uFF1A\u591A\u4E3A API \u5730\u5740\u8DEF\u5F84\u4E0D\u5BF9\uFF0C\u6216\u8BE5 Key \u65E0\u6548/\u65E0\u6743\u8BBF\u95EE\uFF09` : message;
  return routeFail(hinted);
}
async function handleTestPost(request) {
  try {
    const backend = backendOrThrow();
    const body = await readRouteBody(request);
    const { origin, key } = probeTarget(backend, body);
    const models = await fetchMagpieModels(origin, fetch, { headers: { authorization: `Bearer ${key}` } });
    return routeOk({ count: models.size, models: [...models.keys()].sort().slice(0, 50) });
  } catch (error) {
    return hintGatewayFailure(error);
  }
}
async function handleDiscoverPost(request) {
  try {
    const backend = backendOrThrow();
    const body = await readRouteBody(request);
    const { origin, key } = probeTarget(backend, body);
    const models = await fetchMagpieModels(origin, fetch, { headers: { authorization: `Bearer ${key}` } });
    backend.catalog.adoptDirectory(models);
    const candidates = [...models.entries()].map(([id, entry]) => toRow(id, entry)).sort(compareModelRows);
    return routeOk({ count: candidates.length, models: candidates });
  } catch (error) {
    return hintGatewayFailure(error);
  }
}
async function handleTraceGet(request) {
  try {
    const backend = backendOrThrow();
    const session = new URL(request.url).searchParams.get("session") ?? void 0;
    const pageSettings = backend.store.get();
    const view = await fetchTraceView(backend.effective(), AbortSignal.timeout(TRACE_TIMEOUT_MS), session ?? void 0, pageSettings.webKey);
    return routeOk(view);
  } catch (error) {
    return routeFail(error);
  }
}
async function handleIconGet(request) {
  const name2 = new URL(request.url).searchParams.get("name") ?? "";
  if (name2 === "") return jsonResponse(404, { ok: false, error: "icon name is required" });
  try {
    const backend = backendOrThrow();
    const webKey = backend.store.get().webKey;
    if (webKey === void 0 || webKey.trim() === "") {
      return jsonResponse(404, { ok: false, error: "Magpie Web Key is not configured" });
    }
    const base = deriveGatewayBase(normalizeBaseUrl(backend.effective().baseUrl));
    if (base === void 0 || base === "") return jsonResponse(404, { ok: false, error: "gateway base is invalid" });
    const icon = await fetchWebIcon(base, webKey.trim(), name2, AbortSignal.timeout(TRACE_TIMEOUT_MS));
    return new Response(icon.body, {
      status: 200,
      headers: { "content-type": icon.contentType, "cache-control": "public, max-age=3600" }
    });
  } catch (error) {
    return jsonResponse(404, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
async function handleSearchTestPost(request) {
  try {
    const backend = backendOrThrow();
    const body = await readRouteBody(request);
    const { origin, key } = probeTarget(backend, body);
    const current = backend.effectiveSearch();
    const mode = body.searchMode !== void 0 ? normalizeSearchMode(body.searchMode) : current.mode;
    let model = current.model;
    if (body.searchModel !== void 0) {
      if (typeof body.searchModel !== "string") {
        throw new Error("dsh-magpie-connect: searchModel must be a string");
      }
      model = body.searchModel.trim();
    }
    const maxUses = body.searchMaxUses !== void 0 ? normalizeSearchMaxUses(body.searchMaxUses) : current.maxUses;
    const query = typeof body.query === "string" && body.query.trim() !== "" ? body.query.trim() : "DeepSeek";
    const provider = new MagpieSearchProvider({
      id: backend.providerId,
      resolveSnapshot: () => ({
        endpoint: { baseUrl: origin, apiKey: key },
        search: {
          mode,
          model,
          maxUses,
          timeoutMs: Math.min(backend.searchTimeoutMs, SEARCH_TEST_TIMEOUT_MS)
        }
      })
    });
    const result = await provider.search({ query, maxResults: 5 });
    return routeOk({
      mode,
      ...mode === "model" ? { model } : {},
      count: result.sources.length,
      hasContent: typeof result.content === "string" && result.content.length > 0,
      sources: result.sources.slice(0, 5)
    });
  } catch (error) {
    return routeFail(error);
  }
}
async function handleMcpTestPost(request) {
  try {
    const backend = backendOrThrow();
    const body = await readRouteBody(request);
    const { origin, key } = probeTarget(backend, body);
    const agent = resolveHubAgent(normalizeMcpAgent(backend.mcpAgent));
    const timeoutMs = Math.min(backend.searchTimeoutMs, MCP_TEST_TIMEOUT_MS);
    let result = await probeMagpieHub({ baseUrl: origin, apiKey: key }, { timeoutMs, agent });
    let address = "agent";
    if (agent !== "" && result.ok && result.toolCount === 0) {
      result = await probeMagpieHub({ baseUrl: origin, apiKey: key }, { timeoutMs, agent: "" });
      address = "all";
    }
    return routeOk({ ...result, address });
  } catch (error) {
    return routeFail(error);
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
    },
    {
      path: DISCOVER_API,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: (request) => handleDiscoverPost(request)
    },
    {
      path: TRACE_API,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: (request) => handleTraceGet(request)
    },
    {
      path: ICON_API,
      methods: ["GET"],
      requestBody: "buffered",
      fetch: (request) => handleIconGet(request)
    },
    {
      path: SEARCH_TEST_API,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: (request) => handleSearchTestPost(request)
    },
    {
      path: MCP_TEST_API,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: (request) => handleMcpTestPost(request)
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
function installMcpTools(ctx, logger, options) {
  if (typeof ctx.inject !== "function") return;
  try {
    ctx.inject(["tools"], (tctx) => {
      const scoped = tctx;
      const tools = scoped.tools;
      if (tools === void 0 || typeof tools.register !== "function") {
        logger.warn("dsh-magpie-connect: ctx.tools.register unavailable; Magpie MCP tools disabled");
        return;
      }
      options.onAvailableChange(true);
      const registrar = new MagpieToolRegistrar(tools, {
        getEndpoint: () => options.resolveEndpoint(),
        toolCallTimeoutMs: options.toolCallTimeoutMs,
        agent: options.agent
      });
      let currentFingerprint;
      let generation = 0;
      let pending = Promise.resolve();
      let cleanedUp = false;
      const clear = () => {
        registrar.unregister();
        currentFingerprint = void 0;
        options.onStateChange({ mode: "direct", hubToolCount: 0, registeredCount: 0 });
      };
      const reconcile = () => {
        if (cleanedUp) return Promise.resolve();
        const enabled = options.enabled();
        const endpoint = options.resolveEndpoint();
        const registration = enabled ? buildHubRegistration(endpoint, { toolCallTimeoutMs: options.toolCallTimeoutMs, agent: options.agent }) : null;
        const fingerprint = hubFingerprint(registration);
        if (fingerprint === void 0) {
          clear();
          return Promise.resolve();
        }
        if (fingerprint === currentFingerprint) return pending;
        currentFingerprint = fingerprint;
        const myGeneration = ++generation;
        pending = (async () => {
          try {
            const primaryAgent = resolveHubAgent(options.agent);
            let hubTools = [];
            let usedAllApps = false;
            if (primaryAgent !== "") {
              try {
                hubTools = await listHubTools(endpoint, { timeoutMs: options.listTimeoutMs, agent: primaryAgent });
              } catch (error) {
                hubTools = [];
              }
            }
            if (primaryAgent === "" || hubTools.length === 0) {
              hubTools = await listHubTools(endpoint, { timeoutMs: options.listTimeoutMs, agent: "" });
              usedAllApps = primaryAgent !== "";
              if (usedAllApps) {
                logger.info(
                  `dsh-magpie-connect: agent "${primaryAgent}" lists no tools; using the all-apps hub address instead`
                );
              }
            }
            if (cleanedUp || myGeneration !== generation) return;
            registrar.apply(hubTools);
            options.onStateChange({ ...registrar.state(), address: usedAllApps ? "all" : "agent" });
            logger.info(
              `dsh-magpie-connect: Magpie MCP ${registrar.state().mode} \u2014 ${hubTools.length} hub tools from the ${usedAllApps ? "all-apps" : `agent "${primaryAgent}"`} address`
            );
          } catch (error) {
            if (cleanedUp || myGeneration !== generation) return;
            registrar.unregister();
            options.onStateChange({ mode: "direct", hubToolCount: 0, registeredCount: 0, lastError: error instanceof Error ? error.message : String(error) });
            logger.warn(`dsh-magpie-connect: Magpie MCP tools/list failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        })();
        return pending;
      };
      const teardown = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        generation += 1;
        registrar.dispose();
        options.onAvailableChange(false);
        options.setReconcile(async () => {
        });
      };
      if (typeof scoped.effect === "function") {
        scoped.effect(() => teardown, "dsh-magpie-connect: mcp tools");
      }
      void reconcile();
      options.setReconcile(() => cleanedUp ? Promise.resolve() : reconcile());
      return () => {
        options.setReconcile(async () => {
        });
      };
    });
  } catch (error) {
    logger.warn(`dsh-magpie-connect: ctx.tools unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function drainSearchWaiters(id, finalAttempt) {
  if (ownedSearchProviders.has(id)) return true;
  const waiters = pendingSearchRegistrations.get(id);
  if (!waiters || waiters.length === 0) return false;
  for (let i = waiters.length - 1; i >= 0; i--) {
    const candidate = waiters[i];
    try {
      if (candidate.tryTakeover()) {
        waiters.splice(i, 1);
        if (waiters.length === 0) pendingSearchRegistrations.delete(id);
        return true;
      }
    } catch {
      candidate.onLost();
      waiters.splice(i, 1);
    }
  }
  if (finalAttempt && !ownedSearchProviders.has(id)) {
    const remaining = waiters.splice(0, waiters.length);
    pendingSearchRegistrations.delete(id);
    for (const waiter of remaining) waiter.onLost();
  } else if (waiters.length === 0) {
    pendingSearchRegistrations.delete(id);
  }
  return false;
}
function installSearchProvider(ctx, logger, options) {
  try {
    if (typeof ctx.inject !== "function") return;
    ctx.inject(["web"], (wctx) => {
      const scoped = wctx;
      const web = scoped.web;
      const register = web?.registerSearchProvider;
      if (typeof register !== "function") {
        logger.warn("dsh-magpie-connect: web search registry unavailable; Magpie search provider disabled");
        return;
      }
      const provider = new MagpieSearchProvider({
        id: options.id,
        title: options.title,
        resolveSnapshot: options.resolveSnapshot
      });
      let ownedDispose = null;
      let ownsRegistration = false;
      let cleanedUp = false;
      const tryRegister = () => {
        if (cleanedUp) return false;
        try {
          const disposer = register.call(web, provider);
          ownedDispose = typeof disposer === "function" ? disposer : null;
          ownsRegistration = true;
          ownedSearchProviders.add(options.id);
          options.onRegisteredChange(true);
          logger.info(`dsh-magpie-connect: web search provider registered for "${options.id}"`);
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const code = error && typeof error === "object" ? error.code : void 0;
          if (/already registered/i.test(message) || code === "WEB_DUPLICATE_PROVIDER") {
            return false;
          }
          logger.warn(`dsh-magpie-connect: web search provider registration failed: ${message}`);
          throw error;
        }
      };
      let registeredNow = false;
      try {
        registeredNow = tryRegister();
      } catch {
        return;
      }
      const waiter = {
        tryTakeover: tryRegister,
        onLost: () => {
          if (!cleanedUp && !ownsRegistration) options.onRegisteredChange(false);
        }
      };
      if (!registeredNow) {
        if (!ownedSearchProviders.has(options.id)) {
          logger.warn(
            `dsh-magpie-connect: web search provider "${options.id}" is already registered by another plugin; Magpie web search disabled`
          );
          options.onRegisteredChange(false);
          return;
        }
        logger.warn(`dsh-magpie-connect: web search provider "${options.id}" already registered by an earlier generation; waiting to take over`);
        const queue = pendingSearchRegistrations.get(options.id) ?? [];
        queue.push(waiter);
        pendingSearchRegistrations.set(options.id, queue);
        options.onRegisteredChange(true);
      }
      const teardown = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        options.onRegisteredChange(false);
        const queue = pendingSearchRegistrations.get(options.id);
        if (queue) {
          const idx = queue.indexOf(waiter);
          if (idx >= 0) queue.splice(idx, 1);
          if (queue.length === 0) pendingSearchRegistrations.delete(options.id);
        }
        if (!ownsRegistration) return;
        ownsRegistration = false;
        ownedSearchProviders.delete(options.id);
        const dispose = ownedDispose;
        ownedDispose = null;
        if (dispose) {
          try {
            dispose();
          } catch {
          }
        }
        if (!drainSearchWaiters(options.id, false)) {
          const remaining = pendingSearchRegistrations.get(options.id);
          if (remaining && remaining.length > 0) {
            queueMicrotask(() => {
              drainSearchWaiters(options.id, true);
            });
          }
        }
      };
      if (typeof scoped.effect === "function") {
        scoped.effect(() => teardown, "dsh-magpie-connect: web search provider");
      }
      return teardown;
    });
  } catch (error) {
    logger.warn(`dsh-magpie-connect: web search provider unavailable: ${error instanceof Error ? error.message : String(error)}`);
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
  const store = new SettingsStore({
    path: defaultSettingsPath(dataDir),
    legacyPath: config.dataDir === void 0 ? join4(legacyDataDir(), "settings.json") : void 0,
    // Only the plugin-owned default directory is chmod-ed; an explicit
    // `dataDir` belongs to the user and is left as they set it.
    privateDir: config.dataDir === void 0
  });
  const patchEndpoint = { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey };
  const patchSearch = {
    mode: cfg.searchMode,
    model: cfg.searchModel,
    maxUses: cfg.searchMaxUses
  };
  const effective = () => resolveEffectiveEndpoint(patchEndpoint, store.get());
  const effectiveSearch = () => resolveEffectiveSearchSettings(patchSearch, store.get());
  let searchRegistered = false;
  let dshSettings;
  let mcpAvailable = false;
  let mcpToolState = {
    mode: "direct",
    hubToolCount: 0,
    registeredCount: 0
  };
  let reconcileMcp = async () => {
  };
  const readMcpState = () => {
    if (!mcpAvailable) return { available: false, registered: false };
    const registered = mcpToolState.registeredCount > 0;
    let status;
    if (registered) {
      status = { state: "connected", toolCount: mcpToolState.registeredCount };
    } else if (store.get().mcpEnabled === true && mcpToolState.lastError !== void 0) {
      status = { state: "failed", lastError: mcpToolState.lastError };
    }
    return {
      available: true,
      registered,
      mode: mcpToolState.mode,
      ...mcpToolState.address !== void 0 ? { address: mcpToolState.address } : {},
      hubToolCount: mcpToolState.hubToolCount,
      registeredCount: mcpToolState.registeredCount,
      ...status !== void 0 ? { status } : {}
    };
  };
  const readWebSearchState = () => {
    if (!dshSettings || typeof dshSettings.describe !== "function") {
      return { registered: searchRegistered, switchable: false, active: false };
    }
    try {
      const descriptors = dshSettings.describe();
      const webDesc = Array.isArray(descriptors) ? descriptors.find((row) => row?.ns === "web") : void 0;
      if (!webDesc) {
        return { registered: searchRegistered, switchable: false, active: false };
      }
      const rawValue = webDesc.value && typeof webDesc.value === "object" ? webDesc.value.searchProvider : void 0;
      const activeProvider = typeof rawValue === "string" && rawValue.trim() !== "" ? rawValue.trim() : void 0;
      const switchable = searchRegistered && dshSettings.writable !== false && typeof dshSettings.mutate === "function";
      return {
        registered: searchRegistered,
        switchable,
        active: activeProvider === cfg.providerId,
        ...activeProvider !== void 0 ? { activeProvider } : {}
      };
    } catch {
      return { registered: searchRegistered, switchable: false, active: false };
    }
  };
  const setWebSearchActive = async (active) => {
    const state = readWebSearchState();
    if (!dshSettings || typeof dshSettings.mutate !== "function" || dshSettings.writable === false) {
      throw new Error("dsh-magpie-connect: DSH settings service is unavailable or read-only");
    }
    if (active) {
      if (!state.registered) {
        throw new Error("dsh-magpie-connect: Magpie web search provider is not registered");
      }
      await dshSettings.mutate("web", [{ op: "set", path: ["searchProvider"], value: cfg.providerId }]);
      return;
    }
    if (state.activeProvider === cfg.providerId) {
      await dshSettings.mutate("web", [{ op: "unset", path: ["searchProvider"] }]);
    }
  };
  const restoreWebSearchProvider = async (provider) => {
    if (!dshSettings || typeof dshSettings.mutate !== "function" || dshSettings.writable === false) return;
    if (provider !== void 0) {
      await dshSettings.mutate("web", [{ op: "set", path: ["searchProvider"], value: provider }]);
      return;
    }
    await dshSettings.mutate("web", [{ op: "unset", path: ["searchProvider"] }]);
  };
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
    apiKey: effective().apiKey,
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
    const configured = isConfigured(endpoint);
    catalog.setEndpoint(configured ? endpoint.baseUrl.replace(/\/+$/, "") : "", configured ? endpoint.apiKey : "");
    catalog.setEnabled(page.enabledModels ?? null);
    void reconcileMcp();
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
    const persisted = await store.read();
    await store.hydrate(persisted, void 0);
    applyPageSettings();
    await catalog.start().catch((err) => {
      logger.error(`dsh-magpie-connect: catalog start failed: ${err instanceof Error ? err.message : String(err)}`);
    });
    await store.hydrate(persisted, catalog.directory());
    applyPageSettings();
  })().catch((err) => {
    logger.error(`dsh-magpie-connect: startup failed: ${err instanceof Error ? err.message : String(err)}`);
  });
  try {
    if (typeof ctx.inject === "function") {
      ctx.inject(["settings"], (settingsCtx) => {
        const scoped = settingsCtx;
        const owned = scoped.settings;
        dshSettings = owned;
        let released = false;
        const releaseSettings = () => {
          if (released) return;
          released = true;
          if (dshSettings === owned) dshSettings = void 0;
        };
        try {
          const fiber = ctx.fiber;
          scoped.effect?.(() => owned?.configure?.({ auto: false }, fiber), "dsh-magpie-connect: custom settings page");
          scoped.effect?.(() => releaseSettings, "dsh-magpie-connect: web search settings ref");
        } catch {
        }
        return releaseSettings;
      });
    }
  } catch {
  }
  currentBackend = {
    store,
    catalog,
    patchEndpoint,
    patchSearch,
    searchTimeoutMs: cfg.searchTimeoutMs,
    providerId: cfg.providerId,
    mcpAgent: cfg.mcpAgent,
    effective,
    effectiveSearch,
    applyPageSettings,
    readWebSearchState,
    setWebSearchActive,
    restoreWebSearchProvider,
    readMcpState,
    reconcileMcp: () => reconcileMcp()
  };
  installMcpTools(ctx, logger, {
    resolveEndpoint: () => {
      const backend = currentBackend;
      return backend && backend.providerId === cfg.providerId ? backend.effective() : effective();
    },
    enabled: () => {
      const backend = currentBackend;
      const page = backend && backend.providerId === cfg.providerId ? backend.store.get() : store.get();
      return page.mcpEnabled === true;
    },
    toolCallTimeoutMs: cfg.mcpToolCallTimeoutMs,
    listTimeoutMs: MCP_TEST_TIMEOUT_MS,
    agent: normalizeMcpAgent(cfg.mcpAgent),
    onAvailableChange: (available) => {
      if (currentBackend === null || currentBackend.providerId === cfg.providerId) mcpAvailable = available;
    },
    onStateChange: (state) => {
      if (currentBackend === null || currentBackend.providerId === cfg.providerId) mcpToolState = state;
    },
    setReconcile: (reconcile) => {
      if (currentBackend === null || currentBackend.providerId === cfg.providerId) reconcileMcp = reconcile;
    }
  });
  installSettingsRoutes(ctx, logger);
  installSearchProvider(ctx, logger, {
    id: cfg.providerId,
    title: cfg.displayName,
    resolveSnapshot: () => {
      if (currentBackend && currentBackend.providerId === cfg.providerId) {
        const search2 = currentBackend.effectiveSearch();
        return {
          endpoint: currentBackend.effective(),
          search: {
            mode: search2.mode,
            model: search2.model,
            maxUses: search2.maxUses,
            timeoutMs: currentBackend.searchTimeoutMs
          }
        };
      }
      const search = effectiveSearch();
      return {
        endpoint: effective(),
        search: {
          mode: search.mode,
          model: search.model,
          maxUses: search.maxUses,
          timeoutMs: cfg.searchTimeoutMs
        }
      };
    },
    onRegisteredChange: (registered) => {
      searchRegistered = registered;
    }
  });
  const maybeEffect = ctx.effect;
  if (typeof maybeEffect === "function") {
    maybeEffect.call(ctx, () => () => {
      catalog.stop();
    });
  }
  return { ready };
}
export {
  DISCOVER_API,
  ICON_API,
  MCP_TEST_API,
  MODELS_API,
  MagpieAdapter,
  MagpieSearchError,
  MagpieSearchProvider,
  ModelCatalog,
  SEARCH_TEST_API,
  SETTINGS_API,
  SettingsStore,
  TEST_API,
  TRACE_API,
  __resetSearchProviders,
  __resetSettingsRoutes,
  apply,
  inject,
  isConfigured,
  mapAnthropicSearchResponse,
  name,
  parseMagpieMcpSearchText,
  resolveConfig,
  resolveEffectiveEndpoint,
  resolveEffectiveSearchSettings,
  searchViaMagpieMcp,
  searchViaMagpieModel
};
//# sourceMappingURL=index.js.map
