window.__ModuleLoader__.load({
  id: "dsh-magpie-connect",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  NS: () => NS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/i18n.ts
var import_react = require("react");
var NS = "magpie-connect";
var EN = {
  nav: "Magpie",
  title: "Magpie gateway",
  intro: "Connect DSH to the Magpie LAN model gateway. Changes save to this machine and apply immediately \u2014 no restart needed.",
  connection: "Connection",
  baseUrl: "API URL",
  baseUrlPlaceholder: "http://127.0.0.1:3425/v1",
  apiKey: "API key",
  apiKeyPlaceholder: "required",
  requiredNote: "API URL and API key are both required.",
  test: "Test connection",
  testing: "Testing\u2026",
  save: "Save",
  saving: "Saving\u2026",
  saved: "Saved \u2014 live already.",
  testOk: "Connection OK: {count} models found.",
  models: "Models",
  showing: "Showing {shown} of {total} in the picker.",
  search: "Filter models\u2026",
  showAll: "Show all",
  hideAll: "Hide all",
  image: "image",
  responses: "responses",
  reasoning: "reasoning",
  context: "{window} ctx",
  hidden: "hidden",
  saveHint: "Untick a model to hide it from the model picker. Saved instantly.",
  notConfigured: "Not fully configured: the model picker stays empty and calls fail until both fields are saved.",
  pluginVersion: "Plugin version:",
  loadFailed: "Failed to load settings: {message}",
  requestFailed: "Request failed (HTTP {status})",
  requestTimeout: "Request timed out. Check the gateway address and try again."
};
var ZH = {
  nav: "Magpie \u7F51\u5173",
  title: "Magpie \u7F51\u5173",
  intro: "\u628A DSH \u63A5\u5165 Magpie \u5C40\u57DF\u7F51\u6A21\u578B\u7F51\u5173\u3002\u4FEE\u6539\u4FDD\u5B58\u5728\u672C\u673A\u5E76\u7ACB\u5373\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F\u3002",
  connection: "\u8FDE\u63A5",
  baseUrl: "API \u5730\u5740",
  baseUrlPlaceholder: "http://127.0.0.1:3425/v1",
  apiKey: "API Key",
  apiKeyPlaceholder: "\u5FC5\u586B",
  requiredNote: "API \u5730\u5740\u4E0E Key \u5747\u4E3A\u5FC5\u586B\u3002",
  test: "\u6D4B\u8BD5\u8FDE\u63A5",
  testing: "\u6D4B\u8BD5\u4E2D\u2026",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saved: "\u5DF2\u4FDD\u5B58\u5E76\u5B9E\u65F6\u751F\u6548\u3002",
  testOk: "\u8FDE\u63A5\u6B63\u5E38\uFF0C\u5171\u53D1\u73B0 {count} \u4E2A\u6A21\u578B\u3002",
  models: "\u6A21\u578B\u5217\u8868",
  showing: "\u9009\u62E9\u5668\u4E2D\u663E\u793A {shown} / {total} \u4E2A\u3002",
  search: "\u7B5B\u9009\u6A21\u578B\u2026",
  showAll: "\u5168\u90E8\u663E\u793A",
  hideAll: "\u5168\u90E8\u9690\u85CF",
  image: "\u56FE\u7247",
  responses: "responses",
  reasoning: "\u601D\u8003",
  context: "{window} \u4E0A\u4E0B\u6587",
  hidden: "\u5DF2\u9690\u85CF",
  saveHint: "\u53D6\u6D88\u52FE\u9009\u5373\u5728\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u9690\u85CF\u8BE5\u6A21\u578B\uFF0C\u4FDD\u5B58\u540E\u7ACB\u5373\u751F\u6548\u3002",
  notConfigured: "\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF1A\u4E24\u4E2A\u5B57\u6BB5\u90FD\u4FDD\u5B58\u540E\uFF0C\u6A21\u578B\u9009\u62E9\u5668\u624D\u4F1A\u6709\u5185\u5BB9\uFF0C\u8C03\u7528\u624D\u4F1A\u653E\u884C\u3002",
  pluginVersion: "\u63D2\u4EF6\u7248\u672C\uFF1A",
  loadFailed: "\u52A0\u8F7D\u8BBE\u7F6E\u5931\u8D25\uFF1A{message}",
  requestFailed: "\u8BF7\u6C42\u5931\u8D25\uFF08HTTP {status}\uFF09",
  requestTimeout: "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u5173\u5730\u5740\u540E\u91CD\u8BD5\u3002"
};
var localeRuntime;
function setLocaleRuntime(runtime) {
  localeRuntime = runtime;
}
function format(template, params) {
  if (!params) return template;
  return template.replace(/\{([^}]+)\}/g, (match, key) => key in params ? String(params[key]) : match);
}
function text(key, params) {
  const active = localeRuntime?.getSnapshot().active;
  const dictionary = active === "zh" ? ZH : EN;
  return format(dictionary[key] ?? EN[key] ?? key, params);
}
function subscribe(listener) {
  return localeRuntime === void 0 ? () => {
  } : localeRuntime.subscribe(listener);
}
function snapshot() {
  return localeRuntime?.getSnapshot().revision ?? 0;
}
function useLocaleRevision() {
  (0, import_react.useSyncExternalStore)(subscribe, snapshot, () => 0);
}

// src/client/page.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
var PLUGIN_VERSION = "0.2.0";
var css = {
  section: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 780, paddingBottom: 32 },
  title: { margin: 0, fontSize: 22, lineHeight: "30px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
  intro: { margin: 0, fontSize: 14, lineHeight: "22px", color: "var(--dsw-alias-label-secondary)" },
  card: { display: "flex", flexDirection: "column", gap: 14, padding: 18, border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 12, background: "var(--dsw-alias-bg-layer-1)" },
  cardTitle: { margin: 0, fontSize: 15, lineHeight: "22px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-secondary)" },
  hint: { margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-tertiary)" },
  body: { margin: 0, fontSize: 14, lineHeight: "22px", color: "var(--dsw-alias-label-primary)" },
  error: { margin: 0, whiteSpace: "pre-wrap", color: "var(--dsw-alias-label-error, var(--dsw-alias-state-danger-label))" },
  ok: { margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-state-success-label, var(--dsw-alias-label-primary))" },
  list: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 420, overflowY: "auto", paddingRight: 4 },
  item: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", borderRadius: 8, background: "transparent" },
  itemHidden: { opacity: 0.55 },
  checkbox: { marginTop: 3, width: 15, height: 15, accentColor: "var(--dsw-alias-brand-primary)", flex: "none", cursor: "pointer" },
  itemMain: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  itemId: { fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--dsw-alias-label-primary)", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  chips: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: { fontSize: 11, lineHeight: "18px", padding: "0 7px", borderRadius: 999, border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-secondary)", whiteSpace: "nowrap" },
  versionLink: { color: "var(--dsw-alias-brand-primary)" }
};
var REQUEST_TIMEOUT_MS = 3e4;
async function request(path, method = "GET", body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: { accept: "application/json", ...body !== void 0 ? { "content-type": "application/json" } : {} },
      cache: "no-store",
      signal: controller.signal,
      ...body !== void 0 ? { body: JSON.stringify(body) } : {}
    });
  } catch (cause) {
    throw new Error(cause instanceof Error && cause.name === "AbortError" ? text("requestTimeout") : String(cause));
  } finally {
    clearTimeout(timer);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(text("requestFailed", { status: response.status }));
  }
  if (!response.ok || payload?.ok !== true) {
    throw new Error(typeof payload?.error === "string" ? payload.error : text("requestFailed", { status: response.status }));
  }
  return payload.value;
}
function formatWindow(value) {
  if (value === void 0) return "";
  if (value >= 1e6) return `${(value / 1e6).toFixed(value % 1e6 === 0 ? 0 : 1)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(value);
}
function MagpieSettings() {
  useLocaleRevision();
  const [baseUrl, setBaseUrl] = (0, import_react2.useState)("");
  const [apiKey, setApiKey] = (0, import_react2.useState)("");
  const [hidden, setHidden] = (0, import_react2.useState)([]);
  const [models, setModels] = (0, import_react2.useState)([]);
  const [filter, setFilter] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)("idle");
  const [error, setError] = (0, import_react2.useState)(void 0);
  const [notice, setNotice] = (0, import_react2.useState)(void 0);
  const [loaded, setLoaded] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    let alive = true;
    Promise.all([request("/api/magpie-settings"), request("/api/magpie-models")]).then(
      ([settingsValue, modelsValue]) => {
        if (!alive) return;
        const settings = settingsValue;
        const listed = modelsValue.models ?? [];
        setBaseUrl(settings.baseUrl ?? "");
        setApiKey(settings.apiKey ?? "");
        setHidden(settings.hiddenModels ?? []);
        setModels(listed);
        setLoaded(true);
      },
      (cause) => {
        if (!alive) return;
        setError(text("loadFailed", { message: cause instanceof Error ? cause.message : String(cause) }));
        setLoaded(true);
      }
    );
    return () => {
      alive = false;
    };
  }, []);
  const hiddenSet = (0, import_react2.useMemo)(() => new Set(hidden), [hidden]);
  const visible = (0, import_react2.useMemo)(() => {
    const needle = filter.trim().toLowerCase();
    const rows = needle === "" ? models : models.filter((row) => row.id.toLowerCase().includes(needle) || row.displayName.toLowerCase().includes(needle));
    return rows;
  }, [models, filter]);
  const shownCount = models.length - hiddenSet.size;
  const toggle = (id) => {
    setHidden((prev) => prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]);
    setNotice(void 0);
  };
  const save = async () => {
    setBusy("saving");
    setError(void 0);
    setNotice(void 0);
    try {
      const saved = await request("/api/magpie-settings", "POST", { baseUrl, apiKey, hiddenModels: hidden });
      setBaseUrl(saved.baseUrl);
      setApiKey(saved.apiKey);
      setHidden(saved.hiddenModels ?? []);
      setNotice(text("saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };
  const testConnection = async () => {
    setBusy("testing");
    setError(void 0);
    setNotice(void 0);
    try {
      const result = await request("/api/magpie-test", "POST", { baseUrl, apiKey });
      setNotice(text("testOk", { count: result.count }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };
  const working = busy !== "idle";
  const incomplete = baseUrl.trim() === "" || apiKey.trim() === "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: css.section, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: css.title, children: text("title") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.intro, children: text("intro") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: css.cardTitle, children: text("connection") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.hint, children: text("requiredNote") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.field, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.label, children: text("baseUrl") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Input, { value: baseUrl, placeholder: text("baseUrlPlaceholder"), disabled: working, onChange: (event) => setBaseUrl(event.currentTarget.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.field, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.label, children: text("apiKey") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Input, { type: "password", value: apiKey, placeholder: text("apiKeyPlaceholder"), disabled: working, onChange: (event) => setApiKey(event.currentTarget.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", disabled: working || incomplete, onClick: () => void save(), children: busy === "saving" ? text("saving") : text("save") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", disabled: working || incomplete, onClick: () => void testConnection(), children: busy === "testing" ? text("testing") : text("test") })
      ] }),
      error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", style: css.error, children: error }),
      notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.ok, children: notice }),
      loaded && incomplete ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.hint, children: text("notConfigured") }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: css.cardTitle, children: text("models") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: css.hint, children: [
        text("showing", { shown: Math.max(shownCount, 0), total: models.length }),
        " ",
        text("saveHint")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Input, { value: filter, placeholder: text("search"), disabled: !loaded, onChange: (event) => setFilter(event.currentTarget.value), style: { flex: 1, minWidth: 180 } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_dsh_client_ui_primitives.Button,
          {
            variant: "outline",
            disabled: !loaded,
            onClick: () => {
              setHidden([]);
              setNotice(void 0);
            },
            children: text("showAll")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_dsh_client_ui_primitives.Button,
          {
            variant: "outline",
            disabled: !loaded,
            onClick: () => {
              setHidden(models.map((row) => row.id));
              setNotice(void 0);
            },
            children: text("hideAll")
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: css.list, children: visible.map((row) => {
        const isHidden = hiddenSet.has(row.id);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { ...css.item, ...isHidden ? css.itemHidden : {} }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", style: css.checkbox, checked: !isHidden, onChange: () => toggle(row.id), "aria-label": row.id }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: css.itemMain, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.itemId, children: row.id }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: css.chips, children: [
              row.image ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.chip, children: text("image") }) : null,
              row.responsesOnly ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.chip, children: text("responses") }) : null,
              row.reasoning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.chip, children: `${text("reasoning")} \xB7 ${row.efforts.length}` }) : null,
              row.contextWindow !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.chip, children: text("context", { window: formatWindow(row.contextWindow) }) }) : null,
              isHidden ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.chip, children: text("hidden") }) : null
            ] })
          ] })
        ] }, row.id);
      }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: css.hint, children: [
      text("pluginVersion"),
      " dsh-magpie-connect v",
      PLUGIN_VERSION
    ] })
  ] });
}

// src/client/index.ts
function registerDictionaries(ctx) {
  try {
    ctx.locale.register(NS, { zh: ZH, en: EN });
    return;
  } catch {
  }
  try {
    ctx.locale.register(NS, "zh", ZH);
    ctx.locale.register(NS, "en", EN);
  } catch {
  }
}
function apply(ctx) {
  setLocaleRuntime(ctx.locale);
  try {
    ctx.effect(
      () => {
        registerDictionaries(ctx);
        return () => {
          setLocaleRuntime(void 0);
        };
      },
      "dsh-magpie-connect: locale dictionaries"
    );
  } catch {
    registerDictionaries(ctx);
  }
  ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register(
      {
        name: "settings.section",
        id: "dsh-magpie-connect",
        order: 12,
        locale: NS,
        label: () => text("nav")
      },
      MagpieSettings
    )
  );
}
var inject = ["slots", "locale"];

    return module.exports;
  }
});
