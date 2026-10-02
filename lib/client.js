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
  baseUrlPlaceholder: "http://api.lan/v1",
  apiKey: "API key",
  apiKeyPlaceholder: "required",
  requiredNote: "API URL and API key are both required. Include the version segment (e.g. /v1) \u2014 the URL is used exactly as written.",
  test: "Test connection",
  testing: "Testing\u2026",
  save: "Save",
  saving: "Saving\u2026",
  saved: "Saved \u2014 live already.",
  testOk: "Connection OK: {count} models found.",
  models: "Models",
  enabled: "{count} enabled in the picker.",
  allHidden: "Every model is hidden \u2014 fetch available models to bring some back.",
  remove: "Remove",
  removeHint: "Hide this model from the picker. Fetch available models to bring it back.",
  search: "Filter models\u2026",
  fetchModels: "Fetch available models",
  fetching: "Fetching\u2026",
  fetchTitle: "Available models",
  fetchDescription: "Models the gateway currently serves. Tick the ones the model picker should offer.",
  fetchSearch: "Search models\u2026",
  fetchSelectAll: "Select all",
  fetchDeselectAll: "Deselect all",
  fetchAdopt: "Apply selection",
  fetchEmpty: "The gateway listed no models.",
  fetchNoMatches: "No matching models.",
  fetchNeedsConfig: "Set the API URL and key before fetching.",
  fetchFound: "{count} models found \u2014 {picked} selected.",
  cancel: "Cancel",
  close: "Close",
  image: "image",
  responses: "responses",
  reasoning: "reasoning",
  context: "{window} ctx",
  saveHint: "These are the models the picker offers. Remove one to hide it \u2014 saved instantly.",
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
  baseUrlPlaceholder: "http://api.lan/v1",
  apiKey: "API Key",
  apiKeyPlaceholder: "\u5FC5\u586B",
  requiredNote: "API \u5730\u5740\u4E0E Key \u5747\u4E3A\u5FC5\u586B\u3002\u5730\u5740\u9700\u5305\u542B\u7248\u672C\u6BB5\uFF08\u5982 /v1\uFF09\uFF0C\u63D2\u4EF6\u6309\u4F60\u586B\u5199\u7684\u539F\u6837\u4F7F\u7528\u3002",
  test: "\u6D4B\u8BD5\u8FDE\u63A5",
  testing: "\u6D4B\u8BD5\u4E2D\u2026",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saved: "\u5DF2\u4FDD\u5B58\u5E76\u5B9E\u65F6\u751F\u6548\u3002",
  testOk: "\u8FDE\u63A5\u6B63\u5E38\uFF0C\u5171\u53D1\u73B0 {count} \u4E2A\u6A21\u578B\u3002",
  models: "\u6A21\u578B\u5217\u8868",
  enabled: "\u9009\u62E9\u5668\u4E2D\u5DF2\u542F\u7528 {count} \u4E2A\u3002",
  allHidden: "\u6240\u6709\u6A21\u578B\u90FD\u5DF2\u9690\u85CF\u2014\u2014\u7528\u201C\u83B7\u53D6\u53EF\u7528\u6A21\u578B\u201D\u628A\u5B83\u4EEC\u52A0\u56DE\u6765\u3002",
  remove: "\u5220\u9664",
  removeHint: "\u4ECE\u9009\u62E9\u5668\u4E2D\u9690\u85CF\u8BE5\u6A21\u578B\uFF0C\u53EF\u7528\u201C\u83B7\u53D6\u53EF\u7528\u6A21\u578B\u201D\u91CD\u65B0\u52A0\u56DE\u3002",
  search: "\u7B5B\u9009\u6A21\u578B\u2026",
  fetchModels: "\u83B7\u53D6\u53EF\u7528\u6A21\u578B",
  fetching: "\u83B7\u53D6\u4E2D\u2026",
  fetchTitle: "\u53EF\u7528\u6A21\u578B",
  fetchDescription: "\u7F51\u5173\u5F53\u524D\u63D0\u4F9B\u7684\u6A21\u578B\u3002\u52FE\u9009\u9700\u8981\u51FA\u73B0\u5728\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u7684\u90A3\u4E9B\u3002",
  fetchSearch: "\u641C\u7D22\u6A21\u578B\u2026",
  fetchSelectAll: "\u5168\u9009",
  fetchDeselectAll: "\u53D6\u6D88\u5168\u9009",
  fetchAdopt: "\u5E94\u7528\u9009\u62E9",
  fetchEmpty: "\u7F51\u5173\u6CA1\u6709\u5217\u51FA\u4EFB\u4F55\u6A21\u578B\u3002",
  fetchNoMatches: "\u6CA1\u6709\u5339\u914D\u7684\u6A21\u578B\u3002",
  fetchNeedsConfig: "\u8BF7\u5148\u586B\u5199 API \u5730\u5740\u4E0E Key\u3002",
  fetchFound: "\u5171\u53D1\u73B0 {count} \u4E2A\u6A21\u578B\uFF0C\u5DF2\u9009 {picked} \u4E2A\u3002",
  cancel: "\u53D6\u6D88",
  close: "\u5173\u95ED",
  image: "\u56FE\u7247",
  responses: "responses",
  reasoning: "\u601D\u8003",
  context: "{window} \u4E0A\u4E0B\u6587",
  saveHint: "\u4EE5\u4E0B\u5373\u9009\u62E9\u5668\u4E2D\u53EF\u7528\u7684\u6A21\u578B\uFF0C\u5220\u9664\u5373\u9690\u85CF\uFF0C\u4FDD\u5B58\u540E\u7ACB\u5373\u751F\u6548\u3002",
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
var import_react3 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/model-list.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/model-visibility.ts
function initialPicked(candidates, visibleIds) {
  return new Set(candidates.filter((candidate) => visibleIds.has(candidate.id)).map((candidate) => candidate.id));
}
function hiddenAfterAdopt(candidates, picked) {
  return candidates.filter((candidate) => !picked.has(candidate.id)).map((candidate) => candidate.id);
}
function hideOne(hidden, id) {
  return hidden.includes(id) ? [...hidden] : [...hidden, id];
}
function toggleAllPicked(current, visible) {
  const next = new Set(current);
  if (visible.length > 0 && visible.every((candidate) => current.has(candidate.id))) {
    for (const candidate of visible) next.delete(candidate.id);
    return next;
  }
  for (const candidate of visible) next.add(candidate.id);
  return next;
}

// src/client/model-list.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var css = {
  card: { display: "flex", flexDirection: "column", gap: 14, padding: 18, border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 12, background: "var(--dsw-alias-bg-layer-1)" },
  head: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heading: { display: "flex", flexDirection: "column", gap: 2 },
  cardTitle: { margin: 0, fontSize: 15, lineHeight: "22px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
  meta: { margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-tertiary)" },
  linkButton: { border: "none", background: "transparent", color: "var(--dsw-alias-brand-primary)", cursor: "pointer", padding: "2px 6px", borderRadius: 6, fontSize: 12, lineHeight: "18px", flex: "none" },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  hint: { margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-tertiary)" },
  error: { margin: 0, whiteSpace: "pre-wrap", color: "var(--dsw-alias-label-error, var(--dsw-alias-state-danger-label))" },
  list: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 420, overflowY: "auto", paddingRight: 4 },
  empty: { margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-tertiary)", textAlign: "center", padding: "12px 0" },
  item: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "transparent" },
  removeButton: { border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", padding: "3px 10px", borderRadius: 6, fontSize: 12, lineHeight: "18px", flex: "none" },
  itemMain: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 },
  itemId: { fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--dsw-alias-label-primary)", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  chips: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: { fontSize: 11, lineHeight: "18px", padding: "0 7px", borderRadius: 999, border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-secondary)", whiteSpace: "nowrap" },
  candidateToolbar: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  candidateSearch: { flex: 1, minWidth: 0 },
  candidateList: { display: "flex", flexDirection: "column", gap: 2, maxHeight: 320, margin: 0, padding: 0, listStyle: "none", overflowY: "auto" },
  candidate: { borderRadius: 8 },
  // Mirrors the list's `item`: checkbox and a two-line text column (id, then
  // chips) so a candidate reads the same as an enabled row.
  candidateLabel: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", cursor: "pointer" },
  candidateCheckbox: { width: 15, height: 15, accentColor: "var(--dsw-alias-brand-primary)", flex: "none", cursor: "pointer" },
  candidateText: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 },
  candidateId: { fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--dsw-alias-label-primary)", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  candidateEmpty: { margin: "24px 0", textAlign: "center", fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-secondary)" }
};
function formatWindow(value) {
  if (value === void 0) return "";
  if (value >= 1e6) return `${(value / 1e6).toFixed(value % 1e6 === 0 ? 0 : 1)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(value);
}
function chipsFor(row) {
  const chips = [];
  if (row.image) chips.push({ key: "image", label: text("image") });
  if (row.responsesOnly) chips.push({ key: "responses", label: text("responses") });
  if (row.reasoning) chips.push({ key: "reasoning", label: `${text("reasoning")} \xB7 ${row.efforts.length}` });
  if (row.contextWindow !== void 0) chips.push({ key: "context", label: text("context", { window: formatWindow(row.contextWindow) }) });
  return chips;
}
function ModelListEditor(props) {
  const { models, visibleIds, onFetch, onRemove, onHiddenChange, disabled, fetchable } = props;
  const [filter, setFilter] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [failure, setFailure] = (0, import_react2.useState)(void 0);
  const [candidates, setCandidates] = (0, import_react2.useState)(void 0);
  const [picked, setPicked] = (0, import_react2.useState)(/* @__PURE__ */ new Set());
  const [candidateQuery, setCandidateQuery] = (0, import_react2.useState)("");
  const enabledRows = (0, import_react2.useMemo)(() => models.filter((row) => visibleIds.has(row.id)), [models, visibleIds]);
  const visibleRows = (0, import_react2.useMemo)(() => {
    const needle = filter.trim().toLowerCase();
    if (needle === "") return enabledRows;
    return enabledRows.filter((row) => row.id.toLowerCase().includes(needle) || row.displayName.toLowerCase().includes(needle));
  }, [enabledRows, filter]);
  const togglePicked = (id) => {
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };
  const visibleCandidates = (0, import_react2.useMemo)(() => {
    const needle = candidateQuery.trim().toLowerCase();
    if (candidates === void 0) return [];
    if (needle === "") return candidates;
    return candidates.filter(
      (candidate) => candidate.id.toLowerCase().includes(needle) || candidate.displayName.toLowerCase().includes(needle)
    );
  }, [candidates, candidateQuery]);
  const allVisiblePicked = visibleCandidates.length > 0 && visibleCandidates.every((candidate) => picked.has(candidate.id));
  const closePicker = () => {
    setCandidates(void 0);
    setPicked(/* @__PURE__ */ new Set());
    setCandidateQuery("");
  };
  const fetchModels = async () => {
    setBusy(true);
    setFailure(void 0);
    try {
      const found = await onFetch();
      if (found.length === 0) {
        setFailure(text("fetchEmpty"));
        return;
      }
      setCandidateQuery("");
      setCandidates(found);
      setPicked(initialPicked(found, visibleIds));
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const adoptPicked = () => {
    if (candidates === void 0) return;
    onHiddenChange(hiddenAfterAdopt(candidates, picked));
    closePicker();
  };
  const working = disabled || busy;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.card, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.heading, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: css.cardTitle, children: text("models") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.meta, children: text("enabled", { count: enabledRows.length }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          style: { ...css.linkButton, ...working || !fetchable ? { opacity: 0.5, cursor: "default" } : {} },
          disabled: working || !fetchable,
          title: fetchable ? void 0 : text("fetchNeedsConfig"),
          onClick: () => void fetchModels(),
          children: busy ? text("fetching") : text("fetchModels")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.hint, children: text("saveHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_dsh_client_ui_primitives.Input,
      {
        value: filter,
        placeholder: text("search"),
        disabled,
        onChange: (event) => setFilter(event.currentTarget.value)
      }
    ),
    enabledRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.empty, children: models.length === 0 ? text("fetchEmpty") : text("allHidden") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: css.list, children: visibleRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.item, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: css.itemMain, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.itemId, children: row.id }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.chips, children: chipsFor(row).map((chip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.chip, children: chip.label }, chip.key)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          style: { ...css.removeButton, ...disabled ? { opacity: 0.5, cursor: "default" } : {} },
          disabled,
          title: text("removeHint"),
          "aria-label": `${text("remove")} ${row.id}`,
          onClick: () => onRemove(row.id),
          children: text("remove")
        }
      )
    ] }, row.id)) }),
    failure === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", style: css.error, children: failure }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      import_dsh_client_ui_primitives.Modal,
      {
        open: candidates !== void 0,
        onClose: closePicker,
        title: text("fetchTitle"),
        closeLabel: text("close"),
        description: text("fetchDescription"),
        footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: closePicker, children: text("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", onClick: adoptPicked, children: text("fetchAdopt") })
        ] }),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: css.candidateToolbar, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              import_dsh_client_ui_primitives.Input,
              {
                type: "search",
                value: candidateQuery,
                placeholder: text("fetchSearch"),
                "aria-label": text("fetchSearch"),
                onChange: (event) => setCandidateQuery(event.currentTarget.value),
                style: css.candidateSearch
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", size: "sm", disabled: visibleCandidates.length === 0, onClick: () => setPicked((current) => toggleAllPicked(current, visibleCandidates)), children: allVisiblePicked ? text("fetchDeselectAll") : text("fetchSelectAll") })
          ] }),
          visibleCandidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.candidateEmpty, role: "status", children: text("fetchNoMatches") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { style: css.candidateList, children: visibleCandidates.map((candidate) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { style: css.candidate, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: css.candidateLabel, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                type: "checkbox",
                style: css.candidateCheckbox,
                checked: picked.has(candidate.id),
                onChange: () => togglePicked(candidate.id)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: css.candidateText, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.candidateId, title: candidate.id, children: candidate.id }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.chips, children: chipsFor(candidate).map((chip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: css.chip, children: chip.label }, chip.key)) })
            ] })
          ] }) }, candidate.id)) })
        ]
      }
    )
  ] });
}

// src/client/page.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var PLUGIN_VERSION = "0.2.0";
var css2 = {
  section: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 780, paddingBottom: 32 },
  title: { margin: 0, fontSize: 22, lineHeight: "30px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
  intro: { margin: 0, fontSize: 14, lineHeight: "22px", color: "var(--dsw-alias-label-secondary)" },
  card: { display: "flex", flexDirection: "column", gap: 14, padding: 18, border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 12, background: "var(--dsw-alias-bg-layer-1)" },
  cardTitle: { margin: 0, fontSize: 15, lineHeight: "22px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-secondary)" },
  hint: { margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-tertiary)" },
  error: { margin: 0, whiteSpace: "pre-wrap", color: "var(--dsw-alias-label-error, var(--dsw-alias-state-danger-label))" },
  ok: { margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-state-success-label, var(--dsw-alias-label-primary))" }
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
function MagpieSettings() {
  useLocaleRevision();
  const [baseUrl, setBaseUrl] = (0, import_react3.useState)("");
  const [apiKey, setApiKey] = (0, import_react3.useState)("");
  const [hidden, setHidden] = (0, import_react3.useState)([]);
  const [models, setModels] = (0, import_react3.useState)([]);
  const [busy, setBusy] = (0, import_react3.useState)("idle");
  const [error, setError] = (0, import_react3.useState)(void 0);
  const [notice, setNotice] = (0, import_react3.useState)(void 0);
  const [loaded, setLoaded] = (0, import_react3.useState)(false);
  (0, import_react3.useEffect)(() => {
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
  const hiddenSet = (0, import_react3.useMemo)(() => new Set(hidden), [hidden]);
  const visibleIds = (0, import_react3.useMemo)(() => new Set(models.filter((row) => !hiddenSet.has(row.id)).map((row) => row.id)), [models, hiddenSet]);
  const fetchCandidates = async () => {
    const result = await request("/api/magpie-discover", "POST", { baseUrl, apiKey });
    return result.models ?? [];
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
      const modelsValue = await request("/api/magpie-models");
      setModels(modelsValue.models ?? []);
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { style: css2.section, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: css2.title, children: text("title") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: css2.intro, children: text("intro") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: css2.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { style: css2.cardTitle, children: text("connection") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: css2.hint, children: text("requiredNote") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: css2.field, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: css2.label, children: text("baseUrl") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Input, { value: baseUrl, placeholder: text("baseUrlPlaceholder"), disabled: working, onChange: (event) => setBaseUrl(event.currentTarget.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: css2.field, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: css2.label, children: text("apiKey") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Input, { type: "password", value: apiKey, placeholder: text("apiKeyPlaceholder"), disabled: working, onChange: (event) => setApiKey(event.currentTarget.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: css2.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", disabled: working || incomplete, onClick: () => void save(), children: busy === "saving" ? text("saving") : text("save") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: working || incomplete, onClick: () => void testConnection(), children: busy === "testing" ? text("testing") : text("test") })
      ] }),
      error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", style: css2.error, children: error }),
      notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: css2.ok, children: notice }),
      loaded && incomplete ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: css2.hint, children: text("notConfigured") }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      ModelListEditor,
      {
        models,
        visibleIds,
        onFetch: fetchCandidates,
        onRemove: (id) => {
          setHidden((prev) => hideOne(prev, id));
          setNotice(void 0);
        },
        onHiddenChange: (next) => {
          setHidden(next);
          setNotice(void 0);
        },
        disabled: !loaded || working,
        fetchable: !incomplete
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { style: css2.hint, children: [
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
