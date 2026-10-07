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
  requiredNote: "API URL and API key are both required. Include the version segment (e.g. /v1) \u2014 the URL is used exactly as written.",
  test: "Test connection",
  testing: "Testing\u2026",
  save: "Save",
  saving: "Saving\u2026",
  saved: "Saved \u2014 live already.",
  savingModels: "Saving models\u2026",
  modelsSaved: "Models saved \u2014 the picker is up to date.",
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
  saveHint: "These are the models the picker offers. Changes save on their own \u2014 the credential fields above still need Save.",
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
  requiredNote: "API \u5730\u5740\u4E0E Key \u5747\u4E3A\u5FC5\u586B\u3002\u5730\u5740\u9700\u5305\u542B\u7248\u672C\u6BB5\uFF08\u5982 /v1\uFF09\uFF0C\u63D2\u4EF6\u6309\u4F60\u586B\u5199\u7684\u539F\u6837\u4F7F\u7528\u3002",
  test: "\u6D4B\u8BD5\u8FDE\u63A5",
  testing: "\u6D4B\u8BD5\u4E2D\u2026",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saved: "\u5DF2\u4FDD\u5B58\u5E76\u5B9E\u65F6\u751F\u6548\u3002",
  savingModels: "\u6B63\u5728\u4FDD\u5B58\u6A21\u578B\u2026",
  modelsSaved: "\u6A21\u578B\u5DF2\u4FDD\u5B58\uFF0C\u9009\u62E9\u5668\u5DF2\u66F4\u65B0\u3002",
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
  saveHint: "\u4EE5\u4E0B\u5373\u9009\u62E9\u5668\u4E2D\u53EF\u7528\u7684\u6A21\u578B\uFF0C\u6539\u52A8\u4F1A\u81EA\u52A8\u4FDD\u5B58\uFF1B\u4E0A\u65B9\u7684\u5730\u5740\u4E0E Key \u4ECD\u9700\u70B9\u201C\u4FDD\u5B58\u201D\u3002",
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

// src/client/nav-icon.ts
var NAV_ICON_MARKER = "data-dsh-magpie-nav-icon";
var NAV_ROW_SELECTOR = '[role="dialog"] nav button';
var BIRD_PATH = "M1.5 5.5C1.3 5.7 1.2 6.5 1.2 6.9C1.2 6.9 1.2 7 1.2 7.1C1.1 7.4 1.3 8 1.4 8.3C1.4 8.4 1.5 8.5 1.5 8.7C1.5 8.9 1.7 9 1.8 9.3C2.2 9.9 2.2 10 2.3 10.1C2.4 10.2 2.5 10.3 2.6 10.5C2.8 10.8 3 11.1 3.2 11.3C3.3 11.3 3.4 11.6 3.6 11.8C3.8 12 4.1 12.4 4.2 12.5C4.7 13 5.2 13.7 5.4 13.9C6 14.5 6.5 15.1 6.7 15.3C6.7 15.4 6.9 15.5 6.9 15.7C7.3 15.9 7.7 16.5 7.9 16.8C7.9 16.8 8 16.9 8 16.9C8.1 16.9 8.2 17.2 8.2 17.3C8.2 17.3 8.1 17.2 8.1 17.1C7.9 16.9 7.9 16.9 7.6 16.6C7.5 16.5 7.4 16.5 7.4 16.3C7.2 16.2 6.7 15.7 6.3 15.2C6.1 15.1 6 14.9 6 14.9C5.9 14.8 5.7 14.7 5.7 14.6C5.6 14.5 5.4 14.3 5.3 14.2C5.1 14.1 4.9 13.8 4.7 13.5C4.5 13.3 4.2 13.1 4.1 12.9C4.1 12.9 3.8 12.7 3.8 12.5C3.5 12.3 3 11.8 2.8 11.4C1.8 10.5 0.9 9.6 0.7 9.6C0.6 9.7 0.6 9.8 0.5 10C0.5 10.1 0.6 10.2 0.5 10.3C0.5 10.4 0.6 10.5 0.6 10.6C0.5 10.7 0.5 10.9 0.6 11C0.5 11.1 0.6 11.4 0.6 11.5C0.9 12.9 1.3 13.8 2.8 14.9C2.9 15.1 3.3 15.3 3.4 15.4C3.4 15.5 3.6 15.6 3.7 15.7C4.2 16 6.4 17.8 7 18.4C7.4 18.8 7.4 18.8 7.5 18.9C7.6 19 7.7 19 7.7 19.1C7.7 19.2 7.8 19.2 7.9 19.2C7.9 19.3 8.1 19.4 8.1 19.5C8.2 19.6 8.2 19.7 8.3 19.7C8.3 19.7 8.3 19.7 8.2 19.7C8.2 19.6 8.1 19.6 8 19.6C7.9 19.5 7.9 19.4 7.8 19.4C7.7 19.3 7.6 19.2 7.6 19.2C7.6 19.1 7.5 19 7.3 18.9C7.2 18.9 6.9 18.6 6.7 18.4C6.1 17.8 4.5 16.6 3.5 16C3.4 15.8 3 15.6 2.9 15.5C2.6 15.3 1.5 14.6 0.9 14.3C0.7 14.1 0.6 14.1 0.6 14.2C0.5 14.5 0.8 15.9 0.9 16.1C0.9 16.2 1 16.2 0.9 16.3C1.2 16.8 1.9 17.6 2.7 18.3C2.8 18.5 4 19.2 4.7 19.5C6.2 20.5 6.6 20.7 7.4 21.5C8.2 22.2 8.7 22.7 9.3 23.6C9.5 24.1 9.9 24.4 10.3 25.3C10.4 25.5 10.5 25.8 10.5 25.8C10.7 25.8 10.8 25.7 11 25.4C11.6 25 11.9 24.6 12.3 24.3C12.8 24 13 23.8 13 23.7C13.1 23.7 13.1 23.8 13 24C12 24.8 11 26 10.2 26.9C10.1 27.1 9.9 27.5 9.7 27.7C9.5 27.8 9.4 28 9.4 28C9.4 28 9.3 28.3 9.1 28.5C8.6 29.2 7.7 30.8 7.7 30.9C7.7 31 7.8 31 8.3 30.8C9 30.4 9.5 30.2 10.4 30C11.7 29.6 12.5 29.6 11.6 30C10.5 30.2 9.7 30.6 9.2 31.2C8.8 31.7 8.8 31.7 9.3 31.7C10.1 31.8 10.9 31.9 11.6 32.2C12.8 32.7 13.5 33.1 15.5 34.8C16.4 35.5 17.3 36.2 17.8 36.4C17.9 36.5 18.1 36.7 18.2 36.8C19.1 37.3 21.2 38.1 22.3 38.3C22.4 38.3 22.7 38.3 22.8 38.3C22.8 38.5 23 38.5 23 38.5C23.1 38.5 23.2 38.5 23.3 38.5C23.6 38.6 25.9 38.6 26.1 38.5C26.2 38.5 26.3 38.5 26.4 38.5C26.5 38.5 26.6 38.5 26.7 38.3C26.7 38.3 27 38.3 27.1 38.3C28.3 38.1 30.2 37.3 31.4 36.7C31.5 36.7 31.7 36.4 31.8 36.4C32.2 36.2 33.2 35.4 33.4 35.2C34.2 34.5 35.5 33 35.8 32.6C35.8 32.5 36 32.2 36.1 32C36.4 31.8 36.6 31.4 36.6 31.2C36.7 31.1 36.8 30.9 36.9 30.8C37.2 30.4 37.5 29.6 37.7 29.2C37.7 29.1 37.8 28.7 37.9 28.7C38.1 28.5 38.4 27.1 38.5 26.8C39 25.2 39.1 23.7 39 22.4C39 22.2 38.9 21.9 38.9 21.8C38.9 21.7 38.9 21.6 38.9 21.4C38.6 20.5 38.5 19.9 38.2 19C37.9 18.5 37.5 17.5 37.3 17.2C37 16.8 36.8 15.8 36.8 15.2C36.8 13.8 37.7 12.7 39.6 12.2C40.1 12.1 41.3 11.8 42.1 11.7C43.5 11.5 43.5 11.5 43.4 11.3C42.9 10.7 40.9 9.9 39.2 9.7C37.9 9.5 38.1 9.5 37.6 9C37 8.6 36.4 8 36 7.9C36 7.8 35.8 7.8 35.7 7.7C35.1 7.3 34.2 7 33.1 6.9C32.6 6.7 31.6 6.9 31 7C29.6 7.3 28.3 8 27.3 9.2C26.7 9.8 26.2 10.8 25.7 11.7C25.5 12.1 24.8 13.4 24.7 13.7C24.6 13.9 24.5 14.1 24.1 14.7C23.5 15.7 22.1 16.9 20.6 17.8C20.5 18 20.3 18.2 20.1 18.3C19.7 18.5 19.4 18.8 19.1 19C18.9 19.1 18.7 19.3 18.5 19.4C18 19.8 17.2 20.3 17 20.5C16.9 20.5 16.8 20.6 16.7 20.7C16.3 20.8 16.1 20.9 16 20.9C15.5 20.8 14.9 20.5 14.2 20.2C13.7 19.8 12.7 18.9 12.4 18.6C12.3 18.5 12.2 18.4 12.1 18.2C11.9 18 11.2 17.1 11 16.6C10.9 16.5 10.8 16.4 10.7 16.3C10.7 16.2 10.6 16.1 10.6 15.9C10.5 15.9 10.4 15.7 10.4 15.6C10.3 15.5 10.2 15.2 10.1 15C10 14.8 9.8 14.4 9.7 14.2C9.6 14 9.5 13.7 9.4 13.6C9.4 13.4 9.3 13.2 9.2 13C9.2 12.8 9 12.6 9 12.5C8.9 12.3 8.7 12.1 8.7 12C8.7 12 8.5 11.7 8.5 11.7C8.3 11.2 8.2 10.9 7.5 10C6.4 8.3 4.2 6.4 2.7 5.8C2 5.5 1.6 5.4 1.5 5.5ZM28.4 16.7C29.2 16.9 29.7 17.2 29.9 17.7C30.1 18.2 30 18.9 29.6 19.4C29.2 19.9 28.2 20.9 27.6 21.2C26.8 21.7 25.3 22.4 24.2 22.7C23.9 22.8 23.6 22.9 23.5 22.9C22.8 23.2 20.7 23.7 19.6 24C19 24.2 18.4 24.3 18.1 24.4C17.9 24.4 16.1 24.9 15.3 25.1C14.6 25.2 14.7 25.1 15.7 23.6C16.4 22.7 18.5 20.6 19.4 19.9C20.8 18.8 21.4 18.4 23.2 17.6C23.8 17.4 25.6 16.8 25.9 16.8C25.9 16.8 26.3 16.8 26.6 16.7C26.8 16.7 28.2 16.7 28.4 16.7ZM30.4 20.2C30.5 20.3 30.6 20.6 30.6 20.7C31.7 23.1 33.4 24.6 35.6 25.3C36.1 25.5 36.7 25.7 37.2 25.8C37.7 25.8 37.8 25.9 37.8 26.1C37.7 26.2 37.7 26.3 37.7 26.5C37.7 26.6 37.7 26.8 37.6 27C37.4 28.5 36.8 29.9 36.1 31C36.1 31.2 35.9 31.4 35.9 31.6C35.7 31.9 35.2 32.6 34.7 33.3C32.6 35.6 29.7 37.3 26.6 37.8C26.5 37.8 26.3 37.9 26.2 37.9C25.8 37.9 23.7 37.9 23.3 37.9C23.2 37.9 23 37.8 22.9 37.8C21.1 37.6 19.3 36.8 18 35.7C17.7 35.4 17 34.7 16.8 34.5C16.3 33.8 16.1 33 16.3 32.5C16.5 31.8 16.8 31.6 17.9 31.1C19.1 30.5 19.4 30.4 20.2 30C21.4 29.4 23.2 28.4 23.9 27.9C23.9 27.8 24.2 27.7 24.5 27.6C26.3 26.3 28 24.6 28.9 22.9C29.5 22.2 29.7 21.6 29.9 20.7C30.1 20 30.2 19.9 30.4 20.2Z";
function birdMaskSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" fill="#000"><path fill-rule="evenodd" d="${BIRD_PATH}"/></svg>`;
}
function birdMaskUrl(svg = birdMaskSvg()) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function isOwnNavRow(rowText, wantedLabel) {
  const wanted = String(wantedLabel ?? "").trim();
  if (wanted.length === 0) return false;
  return String(rowText ?? "").trim() === wanted;
}
function navIconCss(maskUrl) {
  return [
    `[${NAV_ICON_MARKER}] > svg { display: none; }`,
    `[${NAV_ICON_MARKER}]::before {`,
    `  content: '';`,
    `  flex: none;`,
    `  width: 18px;`,
    `  height: 18px;`,
    `  background-color: currentColor;`,
    `  -webkit-mask-image: url("${maskUrl}");`,
    `  mask-image: url("${maskUrl}");`,
    `  -webkit-mask-repeat: no-repeat;`,
    `  mask-repeat: no-repeat;`,
    `  -webkit-mask-position: center;`,
    `  mask-position: center;`,
    `  -webkit-mask-size: 18px 18px;`,
    `  mask-size: 18px 18px;`,
    `}`
  ].join("\n");
}
function installSettingsNavIcon(ctx, resolveLabel) {
  if (typeof document === "undefined") return;
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-magpie-connect";
    tag.dataset.pluginCss = "dsh-magpie-connect/settings-nav-icon";
    tag.textContent = navIconCss(birdMaskUrl());
    document.head.appendChild(tag);
    let disposed = false;
    let scheduled = false;
    const sync = () => {
      scheduled = false;
      if (disposed) return;
      const wanted = resolveLabel();
      for (const row of Array.from(document.querySelectorAll(NAV_ROW_SELECTOR))) {
        if (isOwnNavRow(row.textContent, wanted)) row.setAttribute(NAV_ICON_MARKER, "");
        else row.removeAttribute(NAV_ICON_MARKER);
      }
    };
    const schedule = () => {
      if (scheduled || disposed) return;
      scheduled = true;
      queueMicrotask(sync);
    };
    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      disposed = true;
      observer.disconnect();
      for (const row of Array.from(document.querySelectorAll(`[${NAV_ICON_MARKER}]`))) row.removeAttribute(NAV_ICON_MARKER);
      tag.remove();
    };
  }, "dsh-magpie-connect: settings nav icon");
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
  ok: { margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-state-success-label, var(--dsw-alias-label-primary))" },
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
  const { models, visibleIds, onFetch, onRefresh, onRemove, onHiddenChange, disabled, fetchable, status } = props;
  const [filter, setFilter] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [fetchFailure, setFetchFailure] = (0, import_react2.useState)(void 0);
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
    setFetchFailure(void 0);
    try {
      const found = await onFetch();
      if (found.length === 0) {
        setFetchFailure(text("fetchEmpty"));
        return;
      }
      await onRefresh().catch(() => {
      });
      setCandidateQuery("");
      setCandidates(found);
      setPicked(initialPicked(found, visibleIds));
    } catch (cause) {
      setFetchFailure(cause instanceof Error ? cause.message : String(cause));
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
    fetchFailure === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", style: css.error, children: fetchFailure }),
    status === "saving" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.hint, children: text("savingModels") }) : null,
    status === "saved" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: css.ok, children: text("modelsSaved") }) : null,
    status === "error" && props.failure !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", style: css.error, children: props.failure }) : null,
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

// src/client/write-queue.ts
function createWriteQueue(write, onSettled) {
  let inFlight;
  let queued;
  let idleWaiters = [];
  const settleIdle = () => {
    if (inFlight !== void 0 || queued !== void 0) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const waiter of waiters) waiter();
  };
  const drain = () => {
    const next = queued;
    queued = void 0;
    if (next === void 0) {
      settleIdle();
      return;
    }
    const run = write(next.value);
    inFlight = run.then(
      () => {
        inFlight = void 0;
        onSettled?.({ ok: true });
        drain();
      },
      (error) => {
        inFlight = void 0;
        onSettled?.({ ok: false, error });
        drain();
      }
    );
  };
  return {
    push(value) {
      queued = { value };
      if (inFlight === void 0) drain();
    },
    idle() {
      if (inFlight === void 0 && queued === void 0) return Promise.resolve();
      return new Promise((resolve) => {
        idleWaiters.push(resolve);
      });
    },
    pending() {
      return inFlight !== void 0 || queued !== void 0;
    }
  };
}

// src/client/page.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var PLUGIN_VERSION = "0.3.3";
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
async function saveHiddenModels(hidden) {
  await request("/api/magpie-settings", "POST", { hiddenModels: hidden });
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
  const [modelsStatus, setModelsStatus] = (0, import_react3.useState)("idle");
  const [modelsError, setModelsError] = (0, import_react3.useState)(void 0);
  const [loaded, setLoaded] = (0, import_react3.useState)(false);
  const modelsQueue = (0, import_react3.useRef)(
    createWriteQueue((next) => saveHiddenModels(next), (outcome) => {
      if (outcome.ok) {
        setModelsStatus("saved");
        setModelsError(void 0);
        return;
      }
      setModelsStatus("error");
      setModelsError(outcome.error instanceof Error ? outcome.error.message : String(outcome.error));
    })
  ).current;
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
  const refreshModels = async () => {
    const value = await request("/api/magpie-models");
    setModels(value.models ?? []);
  };
  const applyHidden = (next) => {
    setHidden(next);
    setNotice(void 0);
    setModelsStatus("saving");
    setModelsError(void 0);
    modelsQueue.push(next);
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
      await refreshModels();
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
        onRefresh: refreshModels,
        onRemove: (id) => applyHidden(hideOne(hidden, id)),
        onHiddenChange: applyHidden,
        disabled: !loaded || working,
        fetchable: !incomplete,
        status: modelsStatus,
        failure: modelsError
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
  installSettingsNavIcon(ctx, () => text("nav"));
}
var inject = ["slots", "locale"];

    return module.exports;
  }
});
