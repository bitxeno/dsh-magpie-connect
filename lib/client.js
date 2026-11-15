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
  intro: "Connect DSH to the Magpie model gateway. Changes save to this machine and apply immediately \u2014 no restart needed.",
  connection: "Connection",
  baseUrl: "API URL",
  baseUrlPlaceholder: "http://127.0.0.1:3425/v1",
  apiKey: "API key",
  apiKeyPlaceholder: "required",
  apiKeySavedPlaceholder: "Saved \u2014 leave blank to keep the existing key",
  webKey: "Magpie Web Key",
  webKeyPlaceholder: "optional, for full routing details",
  webKeySavedPlaceholder: "Saved \u2014 leave blank to keep the existing Web Key",
  requiredNote: "API URL and API key are both required. Once a key is saved, leave the field blank to keep it. Include the version segment (e.g. /v1) \u2014 the URL is used exactly as written.",
  test: "Test connection",
  testing: "Testing\u2026",
  save: "Save",
  saving: "Saving\u2026",
  saved: "Saved \u2014 live already.",
  savingModels: "Saving models\u2026",
  modelsSaved: "Models saved \u2014 the picker is up to date.",
  testOk: "Connection OK: {count} models found.",
  models: "Models",
  modelsInherited: "Using the gateway\u2019s full catalog.",
  modelsCustomized: "{count} models offered by the picker.",
  resetModels: "Restore defaults",
  allRemoved: "No model is offered right now \u2014 fetch available models to add some, or restore defaults.",
  remove: "Remove",
  removeHint: "Remove this model from the picker. Fetch available models and tick it again to bring it back.",
  sourceStatic: "built-in snapshot",
  sourceStale: "not listed by gateway",
  search: "Filter models\u2026",
  fetchModels: "Fetch available models",
  fetching: "Fetching\u2026",
  fetchTitle: "Available models",
  fetchDescription: "Models the gateway lists right now. Tick the ones the picker should offer \u2014 applying replaces the list with exactly your selection.",
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
  saveHint: "These are the models the picker offers; the gateway\u2019s catalog is not shown until you add from it. Changes save on their own \u2014 the credential fields above still need Save.",
  notConfigured: "Not fully configured: the model picker stays empty and calls fail until both fields are saved.",
  github: "Open the GitHub repository",
  loadFailed: "Failed to load settings: {message}",
  requestFailed: "Request failed (HTTP {status})",
  requestTimeout: "Request timed out. Check the gateway address and try again.",
  "trace.open": "Magpie routing status",
  "trace.title": "Routing",
  "trace.totals": "{requests} requests \xB7 {retried} retried \xB7 {errors} errors",
  "trace.totalsDetail": "Requests {requests}, retried {retried} times, errors {errors}, canceled {canceled} (today)",
  "trace.requests": "Requests",
  "trace.noRequests": "No requests served yet today.",
  "trace.accounts": "Accounts",
  "trace.accountError": "Sign-in expired",
  "trace.took.ms": "{n} ms",
  "trace.took.s": "{n} s",
  "trace.took.m": "{n} min",
  "trace.took.h": "{n} h",
  "trace.took.d": "{n} d",
  "trace.reset.m": "{n} min",
  "trace.reset.h": "{n} h",
  "trace.reset.d": "{n} d",
  "trace.canceled": "canceled",
  "trace.fetchedAt": "Updated {time}",
  "trace.unconfigured": "Not configured: fill in the API URL and key on the Magpie settings page.",
  "trace.unauthorized": "The gateway refused the key (401). Check the API key on the settings page.",
  "trace.forbidden": "The gateway refused (403): enable \u201CShare on local network\u201D in Magpie \u2192 Network and sharing.",
  "trace.network": "The gateway is unreachable right now.",
  "trace.unknown": "Could not read the routing status.",
  "trace.retry": "Retry",
  "trace.thisSession": "This session",
  "trace.sessionNone": "No routed request for this session yet \u2014 send a message and reopen.",
  "trace.tryCount": "{n} tries",
  "trace.group": "Routing group",
  "trace.routing.smart": "Smart",
  "trace.routing.order": "Order",
  "trace.routing.rotate": "Rotate",
  "trace.routing.usage": "Usage",
  "trace.routing.weight": "Weighted",
  "trace.candidate.answered": "answered this request",
  "trace.candidate.processing": "processing",
  "trace.candidate.available": "available",
  "trace.candidate.skipped": "skipped",
  "trace.candidate.fallback": "fallback",
  "trace.candidate.resting": "rate limited",
  "trace.reason.rate": "rate limited",
  "trace.reason.quota": "quota used up",
  "trace.reason.credit": "out of credits",
  "trace.reason.rateLimit": "rate limited",
  "trace.reason.window": "allowance used up",
  "trace.reason.resets": "limit resets",
  "trace.reason.retryAfter": "Retry-After",
  "trace.reason.backoff": "backoff",
  "trace.reason.cooldown": "cooldown",
  "trace.reason.verify": "verification needed",
  "trace.reason.restricted": "account restricted",
  "trace.reason.signin": "sign-in expired",
  "trace.reason.auth": "authentication failed",
  "trace.reason.held": "held by key/group",
  "trace.reason.unlisted": "model not listed",
  "trace.reason.barred": "model barred",
  "trace.reason.noCredits": "no credits policy",
  "trace.reason.unread": "usage unavailable",
  "trace.reason.windowTooSmall": "context window too small",
  "trace.reason.windowSize": "context window {n}K",
  "trace.reason.noURL": "no API URL",
  "trace.reason.other": "unavailable",
  "trace.restUntil": "back {d}",
  "trace.quotaReset": "reset in {d}",
  "trace.candidate.used": "{n}% used",
  "trace.candidate.amount": "{amount} / {limit} {unit}",
  "trace.unit.credits": "credits",
  "trace.unit.tokens": "tokens",
  "trace.unit.requests": "requests",
  "trace.webTraceMissing": "Save the Magpie Web Key for full routing-group detail.",
  "trace.webTraceUnauthorized": "Magpie Web Key was refused; the simplified routing view remains.",
  "trace.webTraceUnavailable": "Full routing-group detail is unavailable; showing the simplified view.",
  "trace.active": "In flight",
  "trace.activeNone": "Nothing is in flight right now.",
  "trace.phase.slot": "waiting for a slot",
  "trace.phase.rpm": "waiting for the minute window",
  "trace.phase.upstream": "at the vendor",
  "trace.phase.redact": "masking",
  enhancements: "Interface enhancements",
  webKeyHint: "Optional; required by the interface-enhancement API. Get it from the magpie config file or its start-up log.",
  webKeySave: "Save Web Key",
  webKeySaved: "Saved \u2014 routing details and logos are now available.",
  composerIconNeedsWebKey: "Save the Magpie Web Key above to enable the routing icon.",
  composer: "Composer",
  composerIcon: "Show routing icon in the input box",
  composerIconHint: "The Magpie mark at the input box\u2019s right edge that opens the routing popover on hover (tap on mobile).",
  composerIconSaved: "Saved \u2014 applies the next time the page opens.",
  composerIconFailed: "Could not save: {message}"
};
var ZH = {
  nav: "Magpie \u7F51\u5173",
  title: "Magpie \u7F51\u5173",
  intro: "\u628A DSH \u63A5\u5165 Magpie \u6A21\u578B\u7F51\u5173\u3002\u4FEE\u6539\u4FDD\u5B58\u5728\u672C\u673A\u5E76\u7ACB\u5373\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F\u3002",
  connection: "\u8FDE\u63A5",
  baseUrl: "API \u5730\u5740",
  baseUrlPlaceholder: "http://127.0.0.1:3425/v1",
  apiKey: "API Key",
  apiKeyPlaceholder: "\u5FC5\u586B",
  apiKeySavedPlaceholder: "\u5DF2\u4FDD\u5B58\uFF1B\u7559\u7A7A\u4FDD\u7559\u73B0\u6709 Key",
  webKey: "Magpie Web Key",
  webKeyPlaceholder: "\u53EF\u9009\uFF0C\u7528\u4E8E\u663E\u793A\u5B8C\u6574\u8DEF\u7531\u8BE6\u60C5",
  webKeySavedPlaceholder: "\u5DF2\u4FDD\u5B58\uFF1B\u7559\u7A7A\u4FDD\u7559\u73B0\u6709 Web Key",
  requiredNote: "API \u5730\u5740\u4E0E Key \u5747\u4E3A\u5FC5\u586B\u3002Key \u4FDD\u5B58\u540E\u7559\u7A7A\u5373\u53EF\u6CBF\u7528\uFF1B\u5730\u5740\u9700\u5305\u542B\u7248\u672C\u6BB5\uFF08\u5982 /v1\uFF09\uFF0C\u63D2\u4EF6\u6309\u4F60\u586B\u5199\u7684\u539F\u6837\u4F7F\u7528\u3002",
  test: "\u6D4B\u8BD5\u8FDE\u63A5",
  testing: "\u6D4B\u8BD5\u4E2D\u2026",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saved: "\u5DF2\u4FDD\u5B58\u5E76\u5B9E\u65F6\u751F\u6548\u3002",
  savingModels: "\u6B63\u5728\u4FDD\u5B58\u6A21\u578B\u2026",
  modelsSaved: "\u6A21\u578B\u5DF2\u4FDD\u5B58\uFF0C\u9009\u62E9\u5668\u5DF2\u66F4\u65B0\u3002",
  testOk: "\u8FDE\u63A5\u6B63\u5E38\uFF0C\u5171\u53D1\u73B0 {count} \u4E2A\u6A21\u578B\u3002",
  models: "\u6A21\u578B\u5217\u8868",
  modelsInherited: "\u6B63\u5728\u4F7F\u7528\u7F51\u5173\u7684\u5B8C\u6574\u76EE\u5F55\u3002",
  modelsCustomized: "\u9009\u62E9\u5668\u4E2D\u63D0\u4F9B {count} \u4E2A\u6A21\u578B\u3002",
  resetModels: "\u6062\u590D\u9ED8\u8BA4\u6A21\u578B",
  allRemoved: "\u5F53\u524D\u6CA1\u6709\u63D0\u4F9B\u4EFB\u4F55\u6A21\u578B\u2014\u2014\u7528\u201C\u83B7\u53D6\u53EF\u7528\u6A21\u578B\u201D\u6DFB\u52A0\uFF0C\u6216\u6062\u590D\u9ED8\u8BA4\u3002",
  remove: "\u5220\u9664",
  removeHint: "\u4ECE\u9009\u62E9\u5668\u4E2D\u79FB\u9664\u8BE5\u6A21\u578B\uFF1B\u7528\u201C\u83B7\u53D6\u53EF\u7528\u6A21\u578B\u201D\u91CD\u65B0\u52FE\u9009\u5373\u53EF\u52A0\u56DE\u3002",
  sourceStatic: "\u5185\u7F6E\u5FEB\u7167",
  sourceStale: "\u7F51\u5173\u672A\u5217\u51FA",
  search: "\u7B5B\u9009\u6A21\u578B\u2026",
  fetchModels: "\u83B7\u53D6\u53EF\u7528\u6A21\u578B",
  fetching: "\u83B7\u53D6\u4E2D\u2026",
  fetchTitle: "\u53EF\u7528\u6A21\u578B",
  fetchDescription: "\u7F51\u5173\u6B64\u523B\u5217\u51FA\u7684\u6A21\u578B\u3002\u52FE\u9009\u9700\u8981\u51FA\u73B0\u5728\u9009\u62E9\u5668\u4E2D\u7684\u90A3\u4E9B\u2014\u2014\u5E94\u7528\u540E\u5217\u8868\u5C31\u6B63\u597D\u662F\u8FD9\u4E9B\u3002",
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
  saveHint: "\u4EE5\u4E0B\u5373\u9009\u62E9\u5668\u63D0\u4F9B\u7684\u6A21\u578B\uFF0C\u7F51\u5173\u76EE\u5F55\u91CC\u7684\u5176\u4F59\u6A21\u578B\u4E0D\u4F1A\u81EA\u52A8\u51FA\u73B0\uFF1B\u6539\u52A8\u4F1A\u81EA\u52A8\u4FDD\u5B58\uFF0C\u4E0A\u65B9\u7684\u5730\u5740\u4E0E Key \u4ECD\u9700\u70B9\u201C\u4FDD\u5B58\u201D\u3002",
  notConfigured: "\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF1A\u4E24\u4E2A\u5B57\u6BB5\u90FD\u4FDD\u5B58\u540E\uFF0C\u6A21\u578B\u9009\u62E9\u5668\u624D\u4F1A\u6709\u5185\u5BB9\uFF0C\u8C03\u7528\u624D\u4F1A\u653E\u884C\u3002",
  github: "\u5728 GitHub \u4E0A\u67E5\u770B\u4ED3\u5E93",
  loadFailed: "\u52A0\u8F7D\u8BBE\u7F6E\u5931\u8D25\uFF1A{message}",
  requestFailed: "\u8BF7\u6C42\u5931\u8D25\uFF08HTTP {status}\uFF09",
  requestTimeout: "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u5173\u5730\u5740\u540E\u91CD\u8BD5\u3002",
  "trace.open": "Magpie \u8DEF\u7531\u8FD0\u884C\u60C5\u51B5",
  "trace.title": "\u8DEF\u7531",
  "trace.totals": "{requests} \u8BF7\u6C42 \xB7 \u91CD\u8BD5 {retried} \xB7 \u9519\u8BEF {errors}",
  "trace.totalsDetail": "\u4ECA\u65E5\u8BF7\u6C42 {requests}\uFF0C\u91CD\u8BD5 {retried} \u6B21\uFF0C\u9519\u8BEF {errors}\uFF0C\u53D6\u6D88 {canceled}",
  "trace.requests": "\u6700\u8FD1\u8BF7\u6C42",
  "trace.noRequests": "\u4ECA\u5929\u8FD8\u6CA1\u6709\u8BF7\u6C42\u7ECF\u8FC7\u7F51\u5173\u3002",
  "trace.accounts": "\u8D26\u53F7\u7528\u91CF",
  "trace.accountError": "\u767B\u5F55\u5DF2\u8FC7\u671F",
  "trace.took.ms": "{n} \u6BEB\u79D2",
  "trace.took.s": "{n} \u79D2",
  "trace.took.m": "{n} \u5206\u949F",
  "trace.took.h": "{n} \u5C0F\u65F6",
  "trace.took.d": "{n} \u5929",
  "trace.reset.m": "{n} \u5206\u949F",
  "trace.reset.h": "{n} \u5C0F\u65F6",
  "trace.reset.d": "{n} \u5929",
  "trace.canceled": "\u5DF2\u53D6\u6D88",
  "trace.fetchedAt": "\u66F4\u65B0\u4E8E {time}",
  "trace.unconfigured": "\u5C1A\u672A\u914D\u7F6E\uFF1A\u8BF7\u5728 Magpie \u7F51\u5173\u8BBE\u7F6E\u9875\u586B\u5199 API \u5730\u5740\u4E0E Key\u3002",
  "trace.unauthorized": "\u7F51\u5173\u62D2\u7EDD\u4E86\u8BF7\u6C42\uFF08401\uFF09\uFF1A\u8BF7\u68C0\u67E5\u8BBE\u7F6E\u9875\u91CC\u7684 API Key\u3002",
  "trace.forbidden": "\u7F51\u5173\u62D2\u7EDD\u8BBF\u95EE\uFF08403\uFF09\uFF1A\u8BF7\u5728 Magpie \u2192 \u7F51\u7EDC\u4E0E\u5171\u4EAB \u91CC\u5F00\u542F\u300C\u5728\u5C40\u57DF\u7F51\u5171\u4EAB\u300D\u3002",
  "trace.network": "\u6682\u65F6\u8FDE\u4E0D\u4E0A\u7F51\u5173\u3002",
  "trace.unknown": "\u65E0\u6CD5\u8BFB\u53D6\u8DEF\u7531\u8FD0\u884C\u60C5\u51B5\u3002",
  "trace.retry": "\u91CD\u8BD5",
  "trace.thisSession": "\u5F53\u524D\u4F1A\u8BDD",
  "trace.sessionNone": "\u8FD9\u4E2A\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u8DEF\u7531\u8FC7\u7684\u8BF7\u6C42\u2014\u2014\u53D1\u9001\u4E00\u6761\u6D88\u606F\u540E\u518D\u6253\u5F00\u3002",
  "trace.tryCount": "{n} \u6B21\u5C1D\u8BD5",
  "trace.group": "\u8DEF\u7531\u7EC4",
  "trace.routing.smart": "\u667A\u80FD",
  "trace.routing.order": "\u987A\u5E8F",
  "trace.routing.rotate": "\u8F6E\u8BE2",
  "trace.routing.usage": "\u7528\u91CF\u4F18\u5148",
  "trace.routing.weight": "\u52A0\u6743",
  "trace.candidate.answered": "\u56DE\u7B54\u4E86\u8FD9\u4E2A\u8BF7\u6C42",
  "trace.candidate.processing": "\u6B63\u5728\u5904\u7406",
  "trace.candidate.available": "\u53EF\u7528",
  "trace.candidate.skipped": "\u8DF3\u8FC7",
  "trace.candidate.fallback": "\u515C\u5E95",
  "trace.candidate.resting": "\u9650\u6D41",
  "trace.reason.rate": "\u9650\u6D41",
  "trace.reason.quota": "\u989D\u5EA6\u7528\u5C3D",
  "trace.reason.credit": "\u79EF\u5206\u4E0D\u8DB3",
  "trace.reason.rateLimit": "\u9650\u6D41",
  "trace.reason.window": "\u989D\u5EA6\u7528\u5C3D",
  "trace.reason.resets": "\u989D\u5EA6\u91CD\u7F6E",
  "trace.reason.retryAfter": "Retry-After",
  "trace.reason.backoff": "\u9000\u907F",
  "trace.reason.cooldown": "\u51B7\u5374",
  "trace.reason.verify": "\u9700\u8981\u9A8C\u8BC1",
  "trace.reason.restricted": "\u8D26\u53F7\u53D7\u9650",
  "trace.reason.signin": "\u767B\u5F55\u5DF2\u8FC7\u671F",
  "trace.reason.auth": "\u8BA4\u8BC1\u5931\u8D25",
  "trace.reason.held": "\u88AB Key / \u5206\u7EC4\u9650\u5236",
  "trace.reason.unlisted": "\u8D26\u53F7\u4E0D\u63D0\u4F9B\u8BE5\u6A21\u578B",
  "trace.reason.barred": "\u6A21\u578B\u88AB\u6392\u9664",
  "trace.reason.noCredits": "\u4E0D\u4F7F\u7528\u79EF\u5206",
  "trace.reason.unread": "\u7528\u91CF\u672A\u77E5",
  "trace.reason.windowTooSmall": "\u4E0A\u4E0B\u6587\u7A97\u53E3\u4E0D\u8DB3",
  "trace.reason.windowSize": "\u8D85\u51FA\u5176 {n}K \u4E0A\u4E0B\u6587",
  "trace.reason.noURL": "\u7F3A\u5C11 API \u5730\u5740",
  "trace.reason.other": "\u6682\u4E0D\u53EF\u7528",
  "trace.restUntil": "{d} \u540E\u6062\u590D",
  "trace.quotaReset": "{d} \u540E\u91CD\u7F6E",
  "trace.candidate.used": "\u5DF2\u7528 {n}%",
  "trace.candidate.amount": "{amount} / {limit} {unit}",
  "trace.unit.credits": "\u79EF\u5206",
  "trace.unit.tokens": "tokens",
  "trace.unit.requests": "\u6B21",
  "trace.webTraceMissing": "\u4FDD\u5B58 Magpie Web Key \u540E\u53EF\u663E\u793A\u5B8C\u6574\u8DEF\u7531\u7EC4\u8BE6\u60C5\u3002",
  "trace.webTraceUnauthorized": "Magpie Web Key \u88AB\u62D2\u7EDD\uFF1B\u5F53\u524D\u663E\u793A\u7B80\u5316\u8DEF\u7531\u89C6\u56FE\u3002",
  "trace.webTraceUnavailable": "\u5B8C\u6574\u8DEF\u7531\u7EC4\u8BE6\u60C5\u6682\u4E0D\u53EF\u7528\uFF1B\u5F53\u524D\u663E\u793A\u7B80\u5316\u89C6\u56FE\u3002",
  "trace.active": "\u6B63\u5728\u5904\u7406",
  "trace.activeNone": "\u5F53\u524D\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u8BF7\u6C42\u3002",
  "trace.phase.slot": "\u6392\u961F\u7B49\u5F85\u5E76\u53D1\u69FD\u4F4D",
  "trace.phase.rpm": "\u7B49\u5F85\u5206\u949F\u7A97\u53E3",
  "trace.phase.upstream": "\u4F9B\u5E94\u5546\u5904\u7406\u4E2D",
  "trace.phase.redact": "\u8131\u654F\u4E2D",
  enhancements: "\u754C\u9762\u589E\u5F3A",
  webKeyHint: "\u53EF\u9009\uFF1B\u754C\u9762\u589E\u5F3A API \u9700\u8981\u8BBE\u7F6E\uFF0C\u53EF\u4EE5\u4ECE magpie \u914D\u7F6E\u6587\u4EF6\u6216\u542F\u52A8 log \u4E2D\u83B7\u53D6\u3002",
  webKeySave: "\u4FDD\u5B58 Web Key",
  webKeySaved: "\u5DF2\u4FDD\u5B58\u2014\u2014\u8DEF\u7531\u8BE6\u60C5\u4E0E logo \u5DF2\u542F\u7528\u3002",
  composerIconNeedsWebKey: "\u8BF7\u5148\u5728\u4E0A\u65B9\u4FDD\u5B58 Magpie Web Key\uFF0C\u624D\u80FD\u542F\u7528\u8DEF\u7531\u56FE\u6807\u3002",
  composer: "\u8F93\u5165\u6846",
  composerIcon: "\u5728\u8F93\u5165\u6846\u663E\u793A\u8DEF\u7531\u56FE\u6807",
  composerIconHint: "\u8F93\u5165\u6846\u53F3\u4FA7\u7684 Magpie \u56FE\u6807\uFF1A\u684C\u9762\u60AC\u505C\u3001\u624B\u673A\u70B9\u6309\u5373\u53EF\u67E5\u770B\u7F51\u5173\u8DEF\u7531\u8FD0\u884C\u60C5\u51B5\u3002",
  composerIconSaved: "\u5DF2\u4FDD\u5B58\u2014\u2014\u4E0B\u6B21\u6253\u5F00\u9875\u9762\u65F6\u751F\u6548\u3002",
  composerIconFailed: "\u4FDD\u5B58\u5931\u8D25\uFF1A{message}"
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
var SLOT_GLYPH_MARKER = "data-dsh-magpie-slot-glyph";
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
  const ownRow = `[${NAV_ICON_MARKER}]:not(:has([${SLOT_GLYPH_MARKER}]))`;
  return [
    // Descendant (not `>`) so it also hides the gear on shells that wrap it in a
    // `span.navIcon` (0.2.2+) — on those the svg is a grandchild of the button,
    // which a child combinator missed (gear stayed visible under the bird).
    `${ownRow} svg { display: none; }`,
    `${ownRow}::before {`,
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

// src/client/section-icon.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function MagpieSectionIcon(props) {
  const size = props.size ?? 16;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "svg",
    {
      ...{ [SLOT_GLYPH_MARKER]: "" },
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 44 44",
      fill: "currentColor",
      "aria-hidden": "true",
      focusable: "false",
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { fillRule: "evenodd", d: BIRD_PATH })
    }
  );
}

// src/client/page.tsx
var import_react3 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/model-list.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/model-visibility.ts
function initialPicked(candidates, offeredIds) {
  return new Set(candidates.filter((candidate) => offeredIds.has(candidate.id)).map((candidate) => candidate.id));
}
function enabledAfterAdopt(candidates, picked) {
  return candidates.filter((candidate) => picked.has(candidate.id)).map((candidate) => candidate.id);
}
function disableOne(enabled, id) {
  return enabled.filter((entry) => entry !== id);
}
function toggleAllWouldClear(visible, picked) {
  const addable = visible.some((candidate) => !picked.has(candidate.id));
  const clearable = visible.some((candidate) => picked.has(candidate.id));
  return !addable && clearable;
}
function toggleAllPicked(current, visible) {
  const next = new Set(current);
  if (toggleAllWouldClear(visible, next)) {
    for (const candidate of visible) next.delete(candidate.id);
    return next;
  }
  for (const candidate of visible) next.add(candidate.id);
  return next;
}

// src/client/model-list.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  // The visible label is `<group>/<name>`; the raw route id is only a hover
  // title, so the list reads cleanly while the allowlist key stays inspectable.
  itemId: { fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--dsw-alias-label-primary)", overflowWrap: "anywhere" },
  chips: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: { fontSize: 11, lineHeight: "18px", padding: "0 7px", borderRadius: 999, border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-secondary)", whiteSpace: "nowrap" },
  // A row the live gateway does not list is informational, not a capability the
  // user is choosing: read it as dimmer than the capability chips.
  chipStale: { color: "var(--dsw-alias-label-tertiary)", borderStyle: "dashed" },
  candidateToolbar: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  candidateSearch: { flex: 1, minWidth: 0 },
  candidateList: { display: "flex", flexDirection: "column", gap: 2, maxHeight: 320, margin: 0, padding: 0, listStyle: "none", overflowY: "auto" },
  candidate: { borderRadius: 8 },
  // Mirrors the list's `item`: checkbox and a two-line text column (id, then
  // chips) so a candidate reads the same as an enabled row.
  candidateLabel: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", cursor: "pointer" },
  candidateCheckbox: { width: 15, height: 15, accentColor: "var(--dsw-alias-brand-primary)", flex: "none", cursor: "pointer" },
  candidateText: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 },
  candidateId: { fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--dsw-alias-label-primary)", overflowWrap: "anywhere" },
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
function sourceChip(row) {
  if (row.source === "static") return { key: "source", label: text("sourceStatic") };
  if (row.source === "none") return { key: "source", label: text("sourceStale") };
  return void 0;
}
function filterRows(rows, query) {
  const needle = query.trim().toLowerCase();
  if (needle === "") return rows;
  return rows.filter((row) => row.id.toLowerCase().includes(needle) || row.displayName.toLowerCase().includes(needle));
}
function ModelListEditor(props) {
  const { models, enabled, onFetch, onRefresh, onEnabledChange, disabled, fetchable, status } = props;
  const [filter, setFilter] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [fetchFailure, setFetchFailure] = (0, import_react2.useState)(void 0);
  const [candidates, setCandidates] = (0, import_react2.useState)(void 0);
  const [picked, setPicked] = (0, import_react2.useState)(/* @__PURE__ */ new Set());
  const [candidateQuery, setCandidateQuery] = (0, import_react2.useState)("");
  const inheriting = enabled === void 0;
  const offeredIds = (0, import_react2.useMemo)(
    () => enabled === void 0 ? new Set(models.filter((row) => row.enabled).map((row) => row.id)) : new Set(enabled),
    [models, enabled]
  );
  const enabledRows = (0, import_react2.useMemo)(() => models.filter((row) => offeredIds.has(row.id)), [models, offeredIds]);
  const visibleRows = (0, import_react2.useMemo)(() => filterRows(enabledRows, filter), [enabledRows, filter]);
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
  const wouldClear = (0, import_react2.useMemo)(() => toggleAllWouldClear(visibleCandidates, picked), [visibleCandidates, picked]);
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
      setPicked(initialPicked(found, offeredIds));
    } catch (cause) {
      setFetchFailure(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const adoptPicked = () => {
    if (candidates === void 0) return;
    onEnabledChange(enabledAfterAdopt(candidates, picked));
    closePicker();
  };
  const working = disabled || busy;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: css.card, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: css.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: css.heading, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { style: css.cardTitle, children: text("models") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: css.hint, children: text("saveHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_dsh_client_ui_primitives.Input,
      {
        value: filter,
        placeholder: text("search"),
        disabled,
        onChange: (event) => setFilter(event.currentTarget.value)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { style: css.meta, children: [
      inheriting ? text("modelsInherited") : text("modelsCustomized", { count: enabledRows.length }),
      inheriting || disabled ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: css.linkButton,
          disabled,
          onClick: () => onEnabledChange(void 0),
          children: text("resetModels")
        }
      )
    ] }),
    enabledRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: css.empty, children: models.length === 0 ? text("fetchEmpty") : text("allRemoved") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: css.list, children: visibleRows.map((row) => {
      const source = sourceChip(row);
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: css.item, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: css.itemMain, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: css.itemId, title: row.id, children: row.displayName }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: css.chips, children: [
            chipsFor(row).map((chip) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: css.chip, children: chip.label }, chip.key)),
            source === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { ...css.chip, ...css.chipStale }, children: source.label }, source.key)
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            style: { ...css.removeButton, ...disabled ? { opacity: 0.5, cursor: "default" } : {} },
            disabled,
            title: text("removeHint"),
            "aria-label": `${text("remove")} ${row.id}`,
            onClick: () => onEnabledChange(disableOne(enabled ?? [], row.id)),
            children: text("remove")
          }
        )
      ] }, row.id);
    }) }),
    fetchFailure === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", style: css.error, children: fetchFailure }),
    status === "saving" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: css.hint, children: text("savingModels") }) : null,
    status === "saved" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: css.ok, children: text("modelsSaved") }) : null,
    status === "error" && props.failure !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", style: css.error, children: props.failure }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      import_dsh_client_ui_primitives.Modal,
      {
        open: candidates !== void 0,
        onClose: closePicker,
        title: text("fetchTitle"),
        closeLabel: text("close"),
        description: text("fetchDescription"),
        footer: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: closePicker, children: text("cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", onClick: adoptPicked, children: text("fetchAdopt") })
        ] }),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: css.candidateToolbar, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { variant: "ghost", size: "sm", disabled: visibleCandidates.length === 0, onClick: () => setPicked((current) => toggleAllPicked(current, visibleCandidates)), children: wouldClear ? text("fetchDeselectAll") : text("fetchSelectAll") })
          ] }),
          visibleCandidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: css.candidateEmpty, role: "status", children: text("fetchNoMatches") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { style: css.candidateList, children: visibleCandidates.map((candidate) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { style: css.candidate, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: css.candidateLabel, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                type: "checkbox",
                style: css.candidateCheckbox,
                checked: picked.has(candidate.id),
                onChange: () => togglePicked(candidate.id)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: css.candidateText, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: css.candidateId, title: candidate.id, children: candidate.displayName }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: css.chips, children: chipsFor(candidate).map((chip) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: css.chip, children: chip.label }, chip.key)) })
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

// src/client/load-retry.ts
var PENDING_RETRY_DELAY_MS = 1500;
var PENDING_RETRY_LIMIT = 6;
function shouldRetryPending(snapshot2, attempts, limit = PENDING_RETRY_LIMIT) {
  return snapshot2?.status === "pending" && attempts < limit;
}

// src/client/page.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var PLUGIN_VERSION = "0.6.0";
var REPO_URL = "https://github.com/bitxeno/dsh-magpie-connect";
var css2 = {
  section: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 780, paddingBottom: 32 },
  /**
   * Title row: brand block (title + version, then the intro) on the left, the
   * GitHub action pinned right. Sits where the bare `<h2>` used to, so the rest
   * of the page keeps its spacing.
   */
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, margin: 0 },
  brand: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  heading: { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 22, lineHeight: "30px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
  version: { fontSize: 11, lineHeight: "16px", fontWeight: 500, letterSpacing: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--dsw-alias-label-tertiary)" },
  actions: { display: "flex", alignItems: "center", gap: 8, flex: "none" },
  iconLink: {
    display: "inline-grid",
    placeItems: "center",
    width: 30,
    height: 30,
    padding: 0,
    boxSizing: "border-box",
    border: "1px solid var(--dsw-alias-border-l2)",
    borderRadius: 8,
    color: "var(--dsw-alias-label-secondary)",
    background: "var(--dsw-alias-bg-layer-1)",
    textDecoration: "none",
    cursor: "pointer"
  },
  intro: { margin: 0, fontSize: 14, lineHeight: "22px", color: "var(--dsw-alias-label-secondary)" },
  card: { display: "flex", flexDirection: "column", gap: 14, padding: 18, border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 12, background: "var(--dsw-alias-bg-layer-1)" },
  cardTitle: { margin: 0, fontSize: 15, lineHeight: "22px", fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-secondary)" },
  hint: { margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-tertiary)" },
  error: { margin: 0, whiteSpace: "pre-wrap", color: "var(--dsw-alias-label-error, var(--dsw-alias-state-danger-label))" },
  ok: { margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-state-success-label, var(--dsw-alias-label-primary))" },
  switchRow: { display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" },
  switchBox: { width: 16, height: 16, margin: "2px 0 0", accentColor: "var(--dsw-alias-brand-primary, #4c6ef5)", cursor: "pointer", flex: "none" },
  switchText: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  switchLabel: { fontSize: 14, lineHeight: "20px", color: "var(--dsw-alias-label-primary)" },
  switchHint: { fontSize: 12, lineHeight: "17px", color: "var(--dsw-alias-label-tertiary)" },
  collapseHead: { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, border: 0, background: "transparent", cursor: "pointer", textAlign: "left" },
  collapseChevron: { flex: "none", marginLeft: "auto", color: "var(--dsw-alias-label-tertiary)", transition: "transform 0.16s", display: "inline-flex" },
  collapseChevronOpen: { transform: "rotate(180deg)" },
  collapseBody: { display: "flex", flexDirection: "column", gap: 14 }
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
async function saveEnabledModels(enabled) {
  await request("/api/magpie-settings", "POST", enabled === void 0 ? {} : { enabledModels: enabled });
}
async function saveShowComposerIcon(show) {
  await request("/api/magpie-settings", "POST", { showComposerIcon: show });
}
async function saveWebKey(webKey) {
  return await request("/api/magpie-settings", "POST", { webKey });
}
function MagpieSettings() {
  useLocaleRevision();
  const [baseUrl, setBaseUrl] = (0, import_react3.useState)("");
  const [apiKey, setApiKey] = (0, import_react3.useState)("");
  const [webKey, setWebKey] = (0, import_react3.useState)("");
  const [hasApiKey, setHasApiKey] = (0, import_react3.useState)(false);
  const [hasWebKey, setHasWebKey] = (0, import_react3.useState)(false);
  const [enabled, setEnabled] = (0, import_react3.useState)(void 0);
  const [models, setModels] = (0, import_react3.useState)([]);
  const [busy, setBusy] = (0, import_react3.useState)("idle");
  const [error, setError] = (0, import_react3.useState)(void 0);
  const [notice, setNotice] = (0, import_react3.useState)(void 0);
  const [modelsStatus, setModelsStatus] = (0, import_react3.useState)("idle");
  const [modelsError, setModelsError] = (0, import_react3.useState)(void 0);
  const [loaded, setLoaded] = (0, import_react3.useState)(false);
  const [showComposerIcon, setShowComposerIcon] = (0, import_react3.useState)(true);
  const [iconStatus, setIconStatus] = (0, import_react3.useState)("idle");
  const [iconError, setIconError] = (0, import_react3.useState)(void 0);
  const [webKeyStatus, setWebKeyStatus] = (0, import_react3.useState)("idle");
  const [webKeyError, setWebKeyError] = (0, import_react3.useState)(void 0);
  const [enhancementsOpen, setEnhancementsOpen] = (0, import_react3.useState)(false);
  const credentialsDirty = (0, import_react3.useRef)(false);
  const modelsQueue = (0, import_react3.useRef)(
    createWriteQueue((next) => saveEnabledModels(next), (outcome) => {
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
    let retry;
    let attempts = 0;
    const rereadModels = async () => {
      const value = await request("/api/magpie-models");
      if (!alive) return;
      setModels(value.models ?? []);
      if (shouldRetryPending(value.snapshot, attempts)) {
        attempts += 1;
        retry = setTimeout(() => void rereadModels().catch(() => {
        }), PENDING_RETRY_DELAY_MS);
      }
    };
    const load = async () => {
      const [settingsValue, modelsValue] = await Promise.all([
        request("/api/magpie-settings"),
        request("/api/magpie-models")
      ]);
      if (!alive) return;
      const settings = settingsValue;
      const listed = modelsValue.models ?? [];
      const snapshot2 = modelsValue.snapshot;
      if (!credentialsDirty.current) setBaseUrl(settings.baseUrl ?? "");
      setHasApiKey(settings.hasApiKey === true);
      setHasWebKey(settings.hasWebKey === true);
      setEnabled(settings.enabledModels);
      setShowComposerIcon(settings.showComposerIcon !== false);
      setModels(listed);
      setLoaded(true);
      if (shouldRetryPending(snapshot2, attempts)) {
        attempts += 1;
        retry = setTimeout(() => void rereadModels().catch(() => {
        }), PENDING_RETRY_DELAY_MS);
      }
    };
    void load().catch((cause) => {
      if (!alive) return;
      setError(text("loadFailed", { message: cause instanceof Error ? cause.message : String(cause) }));
      setLoaded(true);
    });
    return () => {
      alive = false;
      if (retry !== void 0) clearTimeout(retry);
    };
  }, []);
  const fetchCandidates = async () => {
    const result = await request("/api/magpie-discover", "POST", { baseUrl, ...apiKey.trim() === "" ? {} : { apiKey } });
    return result.models ?? [];
  };
  const refreshModels = async () => {
    const value = await request("/api/magpie-models");
    setModels(value.models ?? []);
  };
  const applyEnabled = (next) => {
    setEnabled(next);
    setNotice(void 0);
    setModelsStatus("saving");
    setModelsError(void 0);
    modelsQueue.push(next);
  };
  const applyShowComposerIcon = (show) => {
    setShowComposerIcon(show);
    setIconStatus("saving");
    setIconError(void 0);
    saveShowComposerIcon(show).then(
      () => setIconStatus("saved"),
      (cause) => {
        setIconStatus("error");
        setIconError(cause instanceof Error ? cause.message : String(cause));
        setShowComposerIcon((previous) => !previous);
      }
    );
  };
  const applyWebKey = () => {
    if (webKey.trim() === "") return;
    setWebKeyStatus("saving");
    setWebKeyError(void 0);
    saveWebKey(webKey.trim()).then(
      (saved) => {
        setHasWebKey(saved.hasWebKey === true);
        setWebKey("");
        setWebKeyStatus("saved");
      },
      (cause) => {
        setWebKeyStatus("error");
        setWebKeyError(cause instanceof Error ? cause.message : String(cause));
      }
    );
  };
  const save = async () => {
    setBusy("saving");
    setError(void 0);
    setNotice(void 0);
    try {
      const saved = await request("/api/magpie-settings", "POST", {
        baseUrl,
        ...apiKey.trim() === "" ? {} : { apiKey },
        ...enabled === void 0 ? {} : { enabledModels: enabled }
      });
      setBaseUrl(saved.baseUrl);
      setHasApiKey(saved.hasApiKey);
      setHasWebKey(saved.hasWebKey);
      setApiKey("");
      setEnabled(saved.enabledModels);
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
      const result = await request("/api/magpie-test", "POST", { baseUrl, ...apiKey.trim() === "" ? {} : { apiKey } });
      setNotice(text("testOk", { count: result.count }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("idle");
    }
  };
  const working = busy !== "idle";
  const incomplete = baseUrl.trim() === "" || !hasApiKey && apiKey.trim() === "";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { style: css2.section, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { style: css2.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: css2.brand, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: css2.heading, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { style: css2.title, children: text("title") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: css2.version, children: [
            "v",
            PLUGIN_VERSION
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: css2.intro, children: text("intro") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: css2.actions, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "a",
        {
          href: REPO_URL,
          target: "_blank",
          rel: "noopener noreferrer",
          "aria-label": text("github"),
          title: text("github"),
          style: css2.iconLink,
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: 18, height: 18, viewBox: "0 0 16 16", fill: "currentColor", focusable: "false", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" }) })
        }
      ) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: css2.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { style: css2.cardTitle, children: text("connection") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: css2.hint, children: text("requiredNote") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: css2.field, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: css2.label, children: text("baseUrl") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Input, { value: baseUrl, placeholder: text("baseUrlPlaceholder"), disabled: working, onChange: (event) => {
          credentialsDirty.current = true;
          setBaseUrl(event.currentTarget.value);
        } })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: css2.field, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: css2.label, children: text("apiKey") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Input, { type: "password", value: apiKey, placeholder: text(hasApiKey ? "apiKeySavedPlaceholder" : "apiKeyPlaceholder"), disabled: working, onChange: (event) => {
          credentialsDirty.current = true;
          setApiKey(event.currentTarget.value);
        } })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: css2.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", disabled: working || incomplete, onClick: () => void save(), children: busy === "saving" ? text("saving") : text("save") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: working || incomplete, onClick: () => void testConnection(), children: busy === "testing" ? text("testing") : text("test") })
      ] }),
      error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { role: "alert", style: css2.error, children: error }),
      notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: css2.ok, children: notice }),
      loaded && incomplete ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: css2.hint, children: text("notConfigured") }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { ...css2.card, gap: enhancementsOpen ? 14 : 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "button",
        {
          type: "button",
          "aria-expanded": enhancementsOpen,
          onClick: () => setEnhancementsOpen((open) => !open),
          style: css2.collapseHead,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { style: css2.cardTitle, children: text("enhancements") }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { ...css2.collapseChevron, ...enhancementsOpen ? css2.collapseChevronOpen : {} }, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 6l4 4 4-4" }) }) })
          ]
        }
      ),
      enhancementsOpen ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: css2.collapseBody, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: css2.field, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: css2.label, children: text("webKey") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Input, { type: "password", value: webKey, placeholder: text(hasWebKey ? "webKeySavedPlaceholder" : "webKeyPlaceholder"), disabled: working || webKeyStatus === "saving", onChange: (event) => setWebKey(event.currentTarget.value) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: css2.hint, children: text("webKeyHint") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { style: css2.switchRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              type: "checkbox",
              style: css2.switchBox,
              checked: showComposerIcon,
              disabled: iconStatus === "saving" || !hasWebKey,
              onChange: (event) => applyShowComposerIcon(event.currentTarget.checked)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: css2.switchText, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: css2.switchLabel, children: text("composerIcon") }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: css2.switchHint, children: hasWebKey ? text("composerIconHint") : text("composerIconNeedsWebKey") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: css2.row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: working || webKeyStatus === "saving" || webKey.trim() === "", onClick: () => applyWebKey(), children: webKeyStatus === "saving" ? text("saving") : text("save") }),
          webKeyStatus === "saved" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: css2.ok, children: text("webKeySaved") }) : null
        ] }),
        iconStatus === "saved" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: css2.ok, children: text("composerIconSaved") }) : null,
        webKeyError === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { role: "alert", style: css2.error, children: text("composerIconFailed", { message: webKeyError }) }),
        iconError === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { role: "alert", style: css2.error, children: text("composerIconFailed", { message: iconError }) })
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      ModelListEditor,
      {
        models,
        enabled,
        onFetch: fetchCandidates,
        onRefresh: refreshModels,
        onEnabledChange: applyEnabled,
        disabled: !loaded || working,
        fetchable: !incomplete,
        status: modelsStatus,
        failure: modelsError
      }
    )
  ] });
}

// src/client/trace-button.tsx
var import_react4 = require("react");

// src/client/trace-icons.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function TraceBirdIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { xmlns: "http://www.w3.org/2000/svg", width: 16, height: 16, viewBox: "0 0 44 44", fill: "currentColor", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { fillRule: "evenodd", d: BIRD_PATH }) });
}
function TraceDotIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: 8, height: 8, viewBox: "0 0 8 8", fill: "currentColor", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: 4, cy: 4, r: 3.4 }) });
}
function TraceHollowDotIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: 8, height: 8, viewBox: "0 0 8 8", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: 4, cy: 4, r: 3.25 }) });
}
function TraceFanIcon() {
  const dot = (x, y) => `M${x - 1.4} ${y}a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0`;
  const path = [
    dot(2.9, 8),
    dot(13.1, 3.4),
    dot(13.1, 8),
    dot(13.1, 12.6),
    "M4.3 8h7.4",
    "M4.3 8c2.6 0 3.2-4.6 5.8-4.6h1.6",
    "M4.3 8c2.6 0 3.2 4.6 5.8 4.6h1.6"
  ].join(" ");
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: path }) });
}
function TraceGenericIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 2.2 13.2 5.1v5.8L8 13.8 2.8 10.9V5.1Z M8 8v5.8 M2.8 5.1 8 8l5.2-2.9" }) });
}
function TraceLinkIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: 1.4, "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M4.5 1.5h6v6", strokeLinecap: "round", strokeLinejoin: "round" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M10.5 1.5 5 7", strokeLinecap: "round" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8.5 9.2v1.3H1.5V3.5h1.3", strokeLinecap: "round", strokeLinejoin: "round" })
  ] });
}

// src/client/trace-styles.ts
var TRACE_STYLE_ID = "dsh-magpie-connect-trace-style";
var cssText = `
@keyframes dsh-magpie-connect-trace-flow {
  to { stroke-dashoffset: -8; }
}

/* A pixel-sized SVG outline draws the animated dashed rounded border. Its
   viewBox matches the card's CSS pixels, so stroke width, corner radius and
   dash phase are not scaled or clipped at the corners. */
.dsh-magpie-connect-trace-busy-outline {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.dsh-magpie-connect-trace-busy-outline rect {
  fill: none;
  stroke: #00A6B0;
  stroke-width: 1.5px;
  stroke-dasharray: 3 5;
  stroke-linecap: round;
  animation: dsh-magpie-connect-trace-flow 0.7s linear infinite;
}

/* Magpie-style cubic S wires from the group header to each model card.
   The SVG has a pixel-sized viewBox, so paths are not scaled and keep their
   exact positions and stroke width. */
.dsh-magpie-connect-trace-wire {
  fill: none;
  stroke: var(--dsw-alias-border-l2, rgba(128,128,128,0.28));
  stroke-width: 1.5px;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dsh-magpie-connect-trace-wire.is-active {
  stroke: #00A6B0;
}
.dsh-magpie-connect-trace-wire.is-live {
  stroke-dasharray: 3 5;
  animation: dsh-magpie-connect-trace-flow 0.7s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .dsh-magpie-connect-trace-busy-outline rect,
  .dsh-magpie-connect-trace-wire.is-live { animation: none; }
}
`;
function adoptTraceStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(TRACE_STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = TRACE_STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);
}

// src/client/trace-format.ts
function durationParts(ms) {
  if (ms === void 0 || !Number.isFinite(ms) || ms < 0) return void 0;
  if (ms < 1e3) return { n: Math.round(ms), unit: "ms" };
  if (ms < 6e4) return { n: Math.round(ms / 1e3), unit: "s" };
  const minutes = Math.round(ms / 6e4);
  if (minutes < 60) return { n: minutes, unit: "m" };
  const hours = Math.round(minutes / 60);
  if (hours < 48) return { n: hours, unit: "h" };
  return { n: Math.round(hours / 24), unit: "d" };
}
function resetParts(resetsAt, now = Date.now()) {
  if (resetsAt === void 0) return void 0;
  const at = Date.parse(resetsAt);
  if (!Number.isFinite(at) || at <= now) return void 0;
  const ms = at - now;
  const minutes = Math.ceil(ms / 6e4);
  if (minutes < 60) return { n: minutes, unit: "m" };
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return { n: hours, unit: "h" };
  return { n: Math.ceil(hours / 24), unit: "d" };
}
function maskUser(user) {
  if (user === void 0) return void 0;
  const at = user.indexOf("@");
  if (at <= 0) return user;
  const head = user.slice(0, Math.max(1, Math.min(at, 4)));
  return `${head}\u2026`;
}

// src/client/trace-placement.ts
var POPUP_WIDTH = 320;
var POPUP_MAX_HEIGHT = 420;
var POPUP_GAP = 8;
var POPUP_MARGIN = 8;
var clamp = (value, min, max) => max < min ? min : Math.min(Math.max(value, min), max);
function computePopupPlacement(anchor, clip) {
  const clipWidth = Math.max(0, clip.right - clip.left);
  const clipHeight = Math.max(0, clip.bottom - clip.top);
  const innerTop = clip.top + POPUP_MARGIN;
  const innerBottom = clip.bottom - POPUP_MARGIN;
  const aboveSpace = anchor.top - POPUP_GAP - innerTop;
  const belowSpace = innerBottom - anchor.bottom - POPUP_GAP;
  if (aboveSpace < POPUP_MARGIN && belowSpace < POPUP_MARGIN) {
    const width2 = Math.max(0, Math.min(POPUP_WIDTH, clipWidth - 2 * POPUP_MARGIN));
    const bottom2 = Math.max(innerTop, innerBottom);
    return {
      side: "sheet",
      offsetLeft: clip.left + (clipWidth - width2) / 2 - anchor.left,
      offsetBottom: anchor.bottom - bottom2,
      width: width2,
      maxHeight: Math.min(POPUP_MAX_HEIGHT, Math.max(0, bottom2 - innerTop))
    };
  }
  const above = aboveSpace >= belowSpace;
  const width = Math.max(0, Math.min(POPUP_WIDTH, clipWidth - 2 * POPUP_MARGIN));
  const left = clamp(
    anchor.right - width,
    clip.left + POPUP_MARGIN,
    clip.right - POPUP_MARGIN - width
  );
  const wanted = Math.min(POPUP_MAX_HEIGHT, Math.max(0, above ? aboveSpace : belowSpace));
  if (above) {
    const bottom2 = Math.min(anchor.top - POPUP_GAP, innerBottom);
    const top2 = Math.max(bottom2 - wanted, innerTop);
    return {
      side: "above",
      offsetLeft: left - anchor.left,
      offsetBottom: anchor.bottom - bottom2,
      width,
      maxHeight: Math.max(0, bottom2 - top2)
    };
  }
  const top = Math.max(anchor.bottom + POPUP_GAP, innerTop);
  const bottom = Math.min(top + wanted, innerBottom);
  return {
    side: "below",
    offsetLeft: left - anchor.left,
    offsetTop: top - anchor.top,
    width,
    maxHeight: Math.max(0, bottom - top)
  };
}
function intersectBoxes(a, b) {
  const top = Math.max(a.top, b.top);
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  return { top, left, right: Math.max(left, right), bottom: Math.max(top, bottom) };
}
function clipBoxFor(element, viewport) {
  let box = viewport;
  let node = element.parentElement;
  while (node !== null && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (style.overflowY === "auto" || style.overflowY === "scroll") {
      const rect = node.getBoundingClientRect();
      box = intersectBoxes(viewport, { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
      break;
    }
    node = node.parentElement;
  }
  return box;
}
function readViewport() {
  const visual = window.visualViewport;
  if (visual !== null && visual !== void 0) {
    return {
      top: visual.offsetTop,
      left: visual.offsetLeft,
      width: visual.width,
      height: visual.height,
      bottom: visual.offsetTop + visual.height,
      right: visual.offsetLeft + visual.width
    };
  }
  return {
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    bottom: window.innerHeight,
    right: window.innerWidth
  };
}
function prefersCoarsePointer(target) {
  const matchMedia = (target ?? (typeof window === "undefined" ? void 0 : window))?.matchMedia;
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(pointer: coarse)").matches;
}

// src/client/trace-button.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var DESKTOP_REFRESH_MS = 5e3;
var TOUCH_REFRESH_MS = 4e3;
var HOVER_OPEN_DELAY_MS = 120;
var HOVER_CLOSE_DELAY_MS = 180;
var buttonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  margin: "0 2px",
  padding: "0",
  border: "none",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--dsw-alias-label-secondary, #c9d2e0)",
  cursor: "pointer",
  flex: "none"
};
var popoverStyle = {
  position: "absolute",
  bottom: "calc(100% + 8px)",
  right: "0",
  display: "flex",
  flexDirection: "column",
  background: "var(--dsw-specific-tip, #1e2533)",
  border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.35))",
  borderRadius: "12px",
  boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
  overflow: "hidden",
  zIndex: 1e3
};
function placementStyle(placement) {
  return {
    left: `${placement.offsetLeft}px`,
    right: "auto",
    width: `${placement.width}px`,
    maxHeight: `${placement.maxHeight}px`,
    ...placement.offsetTop === void 0 ? {} : { top: `${placement.offsetTop}px`, bottom: "auto" },
    ...placement.offsetBottom === void 0 ? {} : { bottom: `${placement.offsetBottom}px`, top: "auto" }
  };
}
var headStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 12px 8px",
  borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2))",
  flex: "none"
};
var liveDotStyle = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "var(--dsw-alias-state-success-primary, #4ade80)",
  flex: "none"
};
var headTitleStyle = {
  margin: 0,
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 600,
  color: "var(--dsw-alias-label-primary, #e6ebf2)"
};
var headLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0,
  color: "inherit",
  textDecoration: "none",
  cursor: "pointer"
};
var headUpdatedStyle = {
  marginLeft: "auto",
  fontSize: "11px",
  lineHeight: "18px",
  color: "var(--dsw-alias-label-tertiary, #8a94a6)",
  whiteSpace: "nowrap"
};
var sectionLabelStyle = {
  padding: "8px 12px 4px",
  fontSize: "11px",
  lineHeight: "16px",
  fontWeight: 600,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  color: "var(--dsw-alias-label-tertiary, #8a94a6)",
  flex: "none"
};
var listStyle = {
  overflowY: "auto",
  // Wheel/touch scroll chaining must stop at the popover — scrolling past
  // the ends must not scroll the conversation behind it.
  overscrollBehavior: "contain",
  // A column flex child defaults to min-height:auto, which would let the
  // list grow past the popover's clamped height instead of scrolling inside.
  minHeight: "0",
  padding: "0 6px 8px"
};
var requestRowStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  padding: "6px 8px",
  borderRadius: "8px",
  minWidth: 0
};
var dotWrapStyle = {
  flex: "none",
  display: "inline-flex",
  paddingTop: "5px"
};
var rowTextStyle = {
  flex: "1 1 auto",
  minWidth: "0",
  display: "flex",
  flexDirection: "column",
  gap: "2px"
};
var rowMainStyle = {
  fontSize: "12px",
  lineHeight: "17px",
  color: "var(--dsw-alias-label-primary, #e6ebf2)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
var rowSubStyle = {
  fontSize: "11px",
  lineHeight: "15px",
  color: "var(--dsw-alias-label-tertiary, #8a94a6)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
var rowRightStyle = {
  flex: "none",
  marginLeft: "auto",
  fontSize: "11px",
  lineHeight: "15px",
  color: "var(--dsw-alias-label-tertiary, #8a94a6)",
  whiteSpace: "nowrap",
  textAlign: "right"
};
var accountPlanStyle = {
  flex: "none",
  fontSize: "11px",
  lineHeight: "17px",
  padding: "0 6px",
  borderRadius: "9999px",
  border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))",
  color: "var(--dsw-alias-label-secondary, #c9d2e0)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "clip",
  maxWidth: "10ch"
};
var barFill = "var(--dsw-alias-brand-primary, #4cc9f0)";
var barFillCritical = "var(--dsw-alias-state-danger-primary, #f87171)";
var statusStyle = {
  padding: "12px",
  fontSize: "12px",
  lineHeight: "18px",
  color: "var(--dsw-alias-label-tertiary, #8a94a6)",
  flex: "none"
};
var fullTraceSectionsStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};
var traceGroupStyle = {
  position: "relative",
  margin: "2px 0 8px",
  padding: "0"
};
var groupHeadStyle = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "22px",
  padding: "5px 10px",
  border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.35))",
  borderRadius: "10px",
  background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,0.05))",
  minWidth: 0
};
var groupNameStyle = {
  minWidth: 0,
  flex: "0 1 auto",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 600,
  color: "var(--dsw-alias-label-primary, #e6ebf2)"
};
var groupRefStyle = {
  flex: "0 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "11px",
  lineHeight: "18px",
  color: "var(--dsw-alias-label-tertiary, #8a94a6)"
};
var routingPillStyle = {
  flex: "none",
  marginLeft: "auto",
  padding: "1px 7px",
  border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))",
  borderRadius: "9999px",
  fontSize: "11px",
  lineHeight: "16px",
  color: "var(--dsw-alias-label-secondary, #c9d2e0)"
};
var candidateListStyle = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  marginLeft: "18px",
  paddingTop: "7px",
  paddingLeft: "8px"
};
var directListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  minWidth: 0
};
var candidateWrapStyle = {
  position: "relative",
  minWidth: 0
};
var candidateCardStyle = {
  position: "relative",
  padding: "7px 8px 8px",
  borderRadius: "10px",
  background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,0.04))",
  minWidth: 0
};
var candidateHeadStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0
};
var providerLogoWrapStyle = {
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  color: "var(--dsw-alias-label-secondary, #c9d2e0)"
};
var providerLogoStyle = {
  width: "16px",
  height: "16px",
  objectFit: "contain",
  borderRadius: "4px"
};
var candidateNameStyle = {
  minWidth: 0,
  flex: "0 1 auto",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "12px",
  lineHeight: "17px",
  color: "var(--dsw-alias-label-primary, #e6ebf2)"
};
var candidateDetailStyle = {
  marginTop: "3px",
  fontSize: "11px",
  lineHeight: "16px",
  color: "var(--dsw-alias-label-tertiary, #8a94a6)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
var candidateGaugeStyle = {
  marginTop: "6px",
  height: "3px",
  borderRadius: "2px",
  background: "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.2))",
  overflow: "hidden"
};
var TONE_COLOR = {
  ok: "var(--dsw-alias-state-success-primary, #4ade80)",
  failed: "var(--dsw-alias-state-danger-primary, #f87171)",
  canceled: "var(--dsw-alias-label-dimmed, #6b7280)"
};
function isFailedView(view) {
  return view !== void 0 && view.status !== "ok";
}
function formatDuration(parts, kind) {
  if (parts === void 0) return "";
  if (kind === "took") return text(`trace.took.${parts.unit}`, { n: parts.n });
  return text(`trace.reset.${parts.unit}`, { n: parts.n });
}
function ActiveRow(props) {
  const { row } = props;
  const phaseWord = row.phase === void 0 ? "" : text(`trace.phase.${row.phase}`) !== `trace.phase.${row.phase}` ? text(`trace.phase.${row.phase}`) : row.phase;
  const model = row.model ?? "";
  const took = formatDuration(durationParts(row.ms), "took");
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: requestRowStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { ...dotWrapStyle, color: row.own === true ? "var(--dsw-alias-brand-primary, #4cc9f0)" : "var(--dsw-alias-state-warning-primary, var(--dsw-alias-label-tertiary, #facc15))" }, children: TraceDotIcon() }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: rowTextStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: rowMainStyle, children: [
        row.agent ?? "",
        model !== "" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary, #c9d2e0)" }, children: ` \xB7 ${model}` }) : null,
        row.own === true ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: "var(--dsw-alias-brand-primary, #4cc9f0)" }, children: ` \xB7 ${text("trace.thisSession")}` }) : null
      ] }),
      phaseWord !== "" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: rowSubStyle, children: phaseWord }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: rowRightStyle, children: took !== "" ? took : null })
  ] });
}
function SessionRouteRow(props) {
  const { route } = props;
  const tries = route.tries ?? [];
  const last = tries.at(-1);
  const tone = route.status !== void 0 && (route.status < 200 || route.status >= 400) ? "failed" : route.error !== void 0 && route.done !== true ? "failed" : "ok";
  const asked = route.asked ?? "";
  const served = route.served ?? "";
  const model = asked !== "" && served !== "" && asked !== served ? `${asked} \u2192 ${served}` : asked !== "" ? asked : served;
  const took = formatDuration(durationParts(route.ms), "took");
  const errorWord = route.error !== void 0 ? localizedErrorText(route.error) ?? "" : "";
  const sub = tries.length > 1 ? `${text("trace.tryCount", { n: tries.length })}${errorWord !== "" ? ` \xB7 ${errorWord}` : ""}` : errorWord;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: requestRowStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { ...dotWrapStyle, color: TONE_COLOR[tone] }, children: TraceDotIcon() }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: rowTextStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: rowMainStyle, children: [
        model !== "" ? model : text("trace.sessionNone"),
        route.group !== void 0 && route.group !== asked ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary, #8a94a6)" }, children: ` \xB7 ${route.group}` }) : null
      ] }),
      sub !== "" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: rowSubStyle, children: sub }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: rowRightStyle, children: [
      took !== "" ? took : null,
      last?.status !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { marginLeft: took !== "" ? 6 : 0 }, children: String(last.status) }) : null
    ] })
  ] });
}
function routingLabel(routing) {
  const key = `trace.routing.${routing || "smart"}`;
  return text(key) !== key ? text(key) : routing || text("trace.routing.smart");
}
function FullTraceSection(props) {
  const { trace } = props;
  const group = trace.group;
  const sections = trace.sections ?? [{
    name: group?.name ?? trace.model,
    ref: group?.ref ?? trace.model,
    ...group?.routing !== void 0 ? { routing: group.routing } : {},
    candidates: [...trace.order, ...trace.left].slice(0, 8)
  }];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: fullTraceSectionsStyle, children: sections.map((section, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RoutingGroupCard, { section }, `${section.ref}:${index}`)) });
}
function RoutingGroupCard(props) {
  const { section } = props;
  const showHeader = section.hideHeader !== true;
  const activeIndex = section.candidates.findIndex((candidate) => candidate.outcome === "answered" || candidate.outcome === "processing");
  const groupRef = (0, import_react4.useRef)(null);
  const [wires, setWires] = (0, import_react4.useState)({ width: 0, height: 0, paths: [] });
  (0, import_react4.useLayoutEffect)(() => {
    const container = groupRef.current;
    if (container === null || !showHeader) {
      setWires({ width: 0, height: 0, paths: [] });
      return;
    }
    const measure = () => {
      const rect = container.getBoundingClientRect();
      const rows = Array.from(container.querySelectorAll("[data-magpie-candidate]"));
      const x0 = 10;
      const x3 = 26;
      const mx = (x0 + x3) / 2;
      const y0 = 16;
      const paths = rows.map((row, index) => {
        const card = row.getBoundingClientRect();
        const y3 = card.top - rect.top + card.height / 2;
        return {
          d: `M${x0} ${y0} C${mx} ${y0} ${mx} ${y3} ${x3} ${y3}`,
          active: index === activeIndex,
          live: section.candidates[index]?.outcome === "processing"
        };
      });
      setWires({ width: rect.width, height: rect.height, paths });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [showHeader, activeIndex, section.candidates]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { ref: groupRef, style: traceGroupStyle, children: [
    showHeader && wires.width > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "svg",
      {
        "aria-hidden": "true",
        viewBox: `0 0 ${wires.width} ${wires.height}`,
        style: { position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" },
        children: wires.paths.map((wire, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "path",
          {
            d: wire.d,
            className: `dsh-magpie-connect-trace-wire${wire.active ? " is-active" : ""}${wire.live ? " is-live" : ""}`
          },
          index
        ))
      }
    ) : null,
    showHeader ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: groupHeadStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { ...dotWrapStyle, paddingTop: 0, color: "var(--dsw-alias-label-secondary, #c9d2e0)" }, children: TraceFanIcon() }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: groupNameStyle, children: section.name }),
      section.ref !== section.name ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: groupRefStyle, children: section.ref }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: routingPillStyle, children: routingLabel(section.routing) })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: showHeader ? candidateListStyle : directListStyle, children: [
      section.candidates.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: statusStyle, children: text("trace.noRequests") }) : null,
      section.candidates.map((candidate, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { "data-magpie-candidate": "", style: candidateWrapStyle, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CandidateCard, { candidate, active: index === activeIndex }) }, `${candidate.id}:${candidate.model ?? ""}:${candidate.fixed ?? ""}:${index}`))
    ] })
  ] });
}
function localizedErrorText(error) {
  if (error === void 0 || error === "") return void 0;
  if (/sign.?in.+expired|could not authenticate|re-?sign/i.test(error)) return text("trace.reason.signin");
  if (/frequency limit|rate.?limit|too many requests|429/i.test(error)) return text("trace.reason.rateLimit");
  if (/quota|allowance|usage exceeds|out of .*allowance/i.test(error)) return text("trace.reason.quota");
  if (/credit/i.test(error)) return text("trace.reason.credit");
  return text("trace.reason.other");
}
function localizedFailText(fail) {
  if (fail === void 0 || fail === "") return text("trace.reason.other");
  const key = `trace.reason.${fail}`;
  return text(key) !== key ? text(key) : text("trace.reason.other");
}
function candidateReason(candidate) {
  const rest = candidate.rest;
  const localized = (key, fallback) => text(key) !== key ? text(key) : fallback;
  if (rest !== void 0) {
    if (rest.rate === true || /rate/i.test(rest.why ?? "") || rest.by === "retry-after" || rest.by === "resets") return localized("trace.reason.rateLimit", "rate limited");
    if (rest.by === "window" || /quota/i.test(rest.why ?? "")) return localized("trace.reason.window", "allowance used up");
    if (rest.by === "credit" || /credit/i.test(rest.why ?? "")) return localized("trace.reason.credit", "out of credits");
    if (rest.by === "verify") return localized("trace.reason.verify", "verification needed");
    if (rest.by === "restricted") return localized("trace.reason.restricted", "account restricted");
    if (rest.by === "backoff") return localized("trace.reason.backoff", "backoff");
    if (rest.by === "cooldown") return localized("trace.reason.cooldown", "cooldown");
    if (rest.by === "quota") return localized("trace.reason.quota", "quota used up");
    return localizedErrorText(rest.error) ?? localized("trace.reason.other", "unavailable");
  }
  if (candidate.window !== void 0) return text("trace.reason.windowSize", { n: Math.round(candidate.window / 1e3) });
  if (candidate.skipReason !== void 0 && candidate.skipReason !== "") {
    const reason = candidate.skipReason.toLowerCase();
    if (reason.includes("held") || candidate.held === true) return localized("trace.reason.held", "held by key/group");
    if (reason.includes("credit") || candidate.noCredits === true) return localized("trace.reason.noCredits", "no credits policy");
    if (reason.includes("unlisted") || candidate.unlisted === true) return localized("trace.reason.unlisted", "model not listed");
    if (reason.includes("barred") || candidate.barred === true) return localized("trace.reason.barred", "model barred");
    if (reason.includes("window") || candidate.window !== void 0) return localized("trace.reason.windowTooSmall", "context window too small");
    if (candidate.noURL !== void 0) return localized("trace.reason.noURL", "no API URL");
    if (candidate.unread !== void 0) return localized("trace.reason.unread", "usage unavailable");
    return text("trace.reason.other");
  }
  if (candidate.error !== void 0 && candidate.error !== "") return localizedErrorText(candidate.error) ?? localized("trace.reason.other", "unavailable");
  if (/auth|sign.?in/i.test(candidate.fail ?? "")) return localized("trace.reason.signin", "sign-in expired");
  if (candidate.fail !== void 0 && candidate.fail !== "") return localizedFailText(candidate.fail);
  return localized("trace.reason.other", "unavailable");
}
function candidateDetail(candidate) {
  const rest = candidate.rest;
  if (rest !== void 0) {
    const back = rest.until !== void 0 ? resetParts(rest.until) : void 0;
    const countdown = back !== void 0 ? text("trace.restUntil", { d: formatDuration(back, "reset") }) : "";
    return [candidateReason(candidate), countdown].filter(Boolean).join(" \xB7 ");
  }
  if (candidate.outcome === "skipped" || candidate.outcome === "failed") {
    const reason = candidateReason(candidate);
    const renew2 = candidate.renews?.[0] !== void 0 ? resetParts(candidate.renews[0]) : void 0;
    const resetText2 = renew2 !== void 0 ? text("trace.quotaReset", { d: formatDuration(renew2, "reset") }) : "";
    return [reason, resetText2].filter(Boolean).join(" \xB7 ");
  }
  const amount = candidate.amount !== void 0 && Number.isFinite(candidate.amount) ? Math.round(candidate.amount * 100) / 100 : void 0;
  const limit = candidate.limit !== void 0 && Number.isFinite(candidate.limit) ? Math.round(candidate.limit * 100) / 100 : void 0;
  const unit = candidate.unit !== void 0 && candidate.unit !== "" ? text(`trace.unit.${candidate.unit}`) !== `trace.unit.${candidate.unit}` ? text(`trace.unit.${candidate.unit}`) : candidate.unit : "";
  const amountText = amount !== void 0 && limit !== void 0 ? text("trace.candidate.amount", { amount, limit, unit }).trim() : candidate.usedPct !== void 0 ? text("trace.candidate.used", { n: candidate.usedPct }) : "";
  const renew = candidate.renews?.[0] !== void 0 ? resetParts(candidate.renews[0]) : void 0;
  const resetText = renew !== void 0 ? text("trace.quotaReset", { d: formatDuration(renew, "reset") }) : "";
  return [amountText, resetText].filter(Boolean).join(" \xB7 ");
}
function candidateState(candidate) {
  switch (candidate.outcome) {
    case "answered":
      return { color: TONE_COLOR.ok, word: text("trace.candidate.answered") };
    case "processing":
      return { color: "var(--dsw-alias-brand-primary, #4cc9f0)", word: text("trace.candidate.processing") };
    case "failed":
      return { color: TONE_COLOR.failed, word: candidate.status !== void 0 ? String(candidate.status) : candidateReason(candidate) };
    case "resting":
      return { color: TONE_COLOR.failed, word: text("trace.candidate.resting") };
    case "skipped":
      return { color: TONE_COLOR.canceled, word: text("trace.candidate.skipped") };
    default:
      return { color: TONE_COLOR.canceled, word: text("trace.candidate.available") };
  }
}
function supplierIconName(candidate) {
  const raw = candidate.icon ?? candidate.preset;
  if (raw === void 0 || raw === "" || raw === "generic") return void 0;
  if (raw.includes("/") || raw.includes(":") || raw.includes("..")) return void 0;
  return /^[A-Za-z0-9._~-]+$/.test(raw) ? raw : void 0;
}
function ProviderLogo(props) {
  if (props.name === void 0) return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: providerLogoWrapStyle, children: TraceGenericIcon() });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: providerLogoWrapStyle, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "img",
    {
      src: `/api/magpie-icon?name=${encodeURIComponent(props.name)}`,
      alt: "",
      loading: "lazy",
      draggable: false,
      style: providerLogoStyle,
      onError: (event) => {
        event.currentTarget.style.visibility = "hidden";
      }
    }
  ) });
}
function CandidateCard(props) {
  const { candidate, active } = props;
  const state = candidateState(candidate);
  const detail = candidateDetail(candidate);
  const critical = (candidate.usedPct ?? 0) >= 90 || candidate.outcome === "resting" || candidate.outcome === "failed";
  const processing = candidate.outcome === "processing";
  const cardRef = (0, import_react4.useRef)(null);
  const [outline, setOutline] = (0, import_react4.useState)({ width: 0, height: 0 });
  (0, import_react4.useLayoutEffect)(() => {
    if (!processing) {
      setOutline({ width: 0, height: 0 });
      return;
    }
    const card = cardRef.current;
    if (card === null) return;
    const measure = () => {
      const rect = card.getBoundingClientRect();
      setOutline({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [processing, detail]);
  const border = processing ? "none" : active === true || candidate.outcome === "answered" ? "1px solid var(--dsw-alias-brand-primary, #4cc9f0)" : candidate.outcome === "resting" || candidate.outcome === "failed" || candidate.outcome === "skipped" ? "1px dashed var(--dsw-alias-state-danger-primary, rgba(248,113,113,0.55))" : "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))";
  const dotColor = active === true ? "var(--dsw-alias-brand-primary, #4cc9f0)" : state.color;
  const filledDot = active === true || candidate.outcome === "answered" || candidate.outcome === "processing" || candidate.outcome === "failed";
  const who = maskUser(candidate.who ?? candidate.name ?? candidate.provider);
  const modelLabel = candidate.model !== void 0 ? `${candidate.model}${candidate.fixed !== void 0 ? `:${candidate.fixed}` : ""}` : void 0;
  const logoName = supplierIconName(candidate);
  const detailColor = candidate.outcome === "resting" || candidate.outcome === "failed" || candidate.outcome === "skipped" ? "var(--dsw-alias-state-danger-primary, #f87171)" : "var(--dsw-alias-label-tertiary, #8a94a6)";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { ref: cardRef, style: { ...candidateCardStyle, border, ...active === true && !processing ? { boxShadow: "0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary, #4cc9f0) 20%, transparent)" } : {} }, title: candidate.error ?? candidate.rest?.error, children: [
    processing && outline.width > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { className: "dsh-magpie-connect-trace-busy-outline", viewBox: `0 0 ${outline.width} ${outline.height}`, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("rect", { x: 1, y: 1, width: Math.max(0, outline.width - 2), height: Math.max(0, outline.height - 2), rx: 9, ry: 9 }) }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: candidateHeadStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { ...dotWrapStyle, paddingTop: 0, color: dotColor }, children: filledDot ? TraceDotIcon() : TraceHollowDotIcon() }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ProviderLogo, { name: logoName }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: candidateNameStyle, children: who ?? candidate.provider }),
      candidate.plan !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: accountPlanStyle, children: candidate.plan }) : null,
      modelLabel !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: groupRefStyle, children: modelLabel }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: rowRightStyle, children: state.word })
    ] }),
    detail !== "" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { ...candidateDetailStyle, color: detailColor }, children: detail }) : null,
    candidate.usedPct !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: candidateGaugeStyle, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { display: "block", width: `${Math.min(100, Math.max(0, candidate.usedPct))}%`, height: "100%", borderRadius: "2px", background: critical ? barFillCritical : barFill } }) }) : null
  ] });
}
function MagpieTraceButton(props = {}) {
  const sessionId = typeof props.sessionId === "string" ? props.sessionId : void 0;
  const [open, setOpen] = (0, import_react4.useState)(false);
  const [view, setView] = (0, import_react4.useState)(void 0);
  const [coarse] = (0, import_react4.useState)(prefersCoarsePointer);
  const [placement, setPlacement] = (0, import_react4.useState)(null);
  const [hover, setHover] = (0, import_react4.useState)(false);
  adoptTraceStyles();
  const boxRef = (0, import_react4.useRef)(null);
  const controllerRef = (0, import_react4.useRef)(void 0);
  const openTimerRef = (0, import_react4.useRef)(void 0);
  const closeTimerRef = (0, import_react4.useRef)(void 0);
  const clearTimers = () => {
    if (openTimerRef.current !== void 0) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current !== void 0) clearTimeout(closeTimerRef.current);
    openTimerRef.current = void 0;
    closeTimerRef.current = void 0;
  };
  const load = (0, import_react4.useCallback)(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const url = sessionId !== void 0 ? `/api/magpie-trace?session=${encodeURIComponent(sessionId)}` : "/api/magpie-trace";
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const payload = await response.json();
      if (controller.signal.aborted) return;
      if (response.ok && payload?.ok === true && payload.value !== void 0 && payload.value !== null) {
        setView(payload.value);
        return;
      }
      setView({ status: "unknown", message: typeof payload?.error === "string" ? payload.error : void 0, fetchedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (error) {
      if (controller.signal.aborted) return;
      setView({ status: "network", message: error instanceof Error ? error.message : String(error), fetchedAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
  }, [sessionId]);
  (0, import_react4.useLayoutEffect)(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const measure = () => {
      const box = boxRef.current;
      if (box === null) return;
      setPlacement(computePopupPlacement(box.getBoundingClientRect(), clipBoxFor(box, readViewport())));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const visual = window.visualViewport;
    visual?.addEventListener("resize", measure);
    visual?.addEventListener("scroll", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      visual?.removeEventListener("resize", measure);
      visual?.removeEventListener("scroll", measure);
    };
  }, [open]);
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    void load();
    const interval = setInterval(() => void load(), coarse ? TOUCH_REFRESH_MS : DESKTOP_REFRESH_MS);
    return () => {
      clearInterval(interval);
      controllerRef.current?.abort();
      controllerRef.current = void 0;
    };
  }, [open, coarse, load]);
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    const onDown = (event) => {
      if (boxRef.current === null) return;
      if (!boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  (0, import_react4.useEffect)(() => () => {
    clearTimers();
    controllerRef.current?.abort();
  }, []);
  const toggle = () => {
    clearTimers();
    setOpen((value) => !value);
  };
  const onEnter = () => {
    if (coarse) return;
    if (closeTimerRef.current !== void 0) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = void 0;
      return;
    }
    if (openTimerRef.current !== void 0 || open) return;
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = void 0;
      setOpen(true);
    }, HOVER_OPEN_DELAY_MS);
  };
  const onLeave = () => {
    if (coarse) return;
    if (openTimerRef.current !== void 0) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = void 0;
      return;
    }
    if (!open) return;
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = void 0;
      setOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  };
  const failed = isFailedView(view);
  const hint = failed ? text(
    view?.status === "unconfigured" ? "trace.unconfigured" : view?.status === "unauthorized" ? "trace.unauthorized" : view?.status === "forbidden" ? "trace.forbidden" : view?.status === "network" ? "trace.network" : "trace.unknown"
  ) : "";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      ref: boxRef,
      style: { position: "relative", display: "inline-flex", flex: "none" },
      onMouseEnter: () => {
        setHover(true);
        onEnter();
      },
      onMouseLeave: () => {
        setHover(false);
        onLeave();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "button",
            onClick: toggle,
            title: text("trace.open"),
            "aria-label": text("trace.open"),
            "aria-expanded": open,
            style: {
              ...buttonStyle,
              // Same hover treatment as dsh-git-plus's composer toolbtn: the
              // shell's interactive hover background and the primary label color.
              ...hover && !coarse ? {
                background: "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.2))",
                color: "var(--dsw-alias-label-primary, #e8edf5)"
              } : {},
              ...open ? { color: "var(--dsw-alias-label-primary-bluish, #4cc9f0)" } : {}
            },
            children: TraceBirdIcon()
          }
        ),
        open && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            "data-magpie-trace-popup": true,
            "data-side": placement?.side ?? "above",
            style: placement === null ? popoverStyle : { ...popoverStyle, ...placementStyle(placement) },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: headStyle, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "a",
                  {
                    href: view?.routingUrl ?? "/?view=routing",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    "aria-label": text("trace.title"),
                    title: text("trace.title"),
                    style: headLinkStyle,
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: liveDotStyle, "aria-hidden": "true" }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: headTitleStyle, children: text("trace.title") }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { display: "inline-flex", color: "var(--dsw-alias-label-secondary, #c9d2e0)" }, children: TraceLinkIcon() })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: headUpdatedStyle, children: text("trace.fetchedAt", { time: new Date(view?.fetchedAt ?? Date.now()).toLocaleTimeString() }) })
              ] }),
              failed ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: statusStyle, children: [
                hint,
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: () => void load(),
                    style: {
                      display: "block",
                      margin: "8px 0 0",
                      padding: "4px 10px",
                      fontSize: "12px",
                      lineHeight: "18px",
                      border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))",
                      borderRadius: "8px",
                      background: "transparent",
                      color: "var(--dsw-alias-label-secondary, #c9d2e0)",
                      cursor: "pointer"
                    },
                    children: text("trace.retry")
                  }
                )
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_jsx_runtime5.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: listStyle, children: view?.sessionTrace !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FullTraceSection, { trace: view.sessionTrace }, "full-trace") : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                view?.webTraceError !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: statusStyle, title: view?.webTraceMessage, children: text(
                  view.webTraceError === "missing-key" ? "trace.webTraceMissing" : view.webTraceError === "unauthorized" ? "trace.webTraceUnauthorized" : view.webTraceError === "forbidden" ? "trace.webTraceUnavailable" : "trace.webTraceUnavailable"
                ) }) : null,
                sessionId !== void 0 && view?.sessionRoute !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: sectionLabelStyle, children: text("trace.thisSession") }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SessionRouteRow, { route: view.sessionRoute })
                ] }) : null,
                (view?.active?.length ?? 0) > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: sectionLabelStyle, children: text("trace.active") }),
                  (view?.active ?? []).map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ActiveRow, { row }, `${row.agent ?? ""}:${row.model ?? ""}:${index}`))
                ] }) : null
              ] }) }) })
            ]
          }
        )
      ]
    }
  );
}

// src/client/index.ts
async function readComposerVisible() {
  try {
    const response = await fetch("/api/magpie-settings", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok && payload?.ok === true && payload.value !== void 0 && payload.value !== null) {
      return payload.value.showComposerIcon !== false && payload.value.hasWebKey === true;
    }
  } catch {
  }
  return false;
}
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
  ctx.slots.inject(
    "settings.section.icon",
    () => ctx.slots.register(
      {
        name: "settings.section.icon",
        id: "dsh-magpie-connect",
        order: 12,
        locale: NS,
        label: () => text("nav")
      },
      MagpieSectionIcon
    )
  );
  installSettingsNavIcon(ctx, () => text("nav"));
  ctx.effect(() => {
    let dispose;
    let cancelled = false;
    void readComposerVisible().then((show) => {
      if (cancelled) return;
      if (!show) return;
      dispose = ctx.slots.inject(
        "conversation.input.right",
        () => ctx.slots.register(
          {
            name: "conversation.input.right",
            id: "magpie-trace",
            order: 100,
            locale: NS,
            label: () => text("trace.open")
          },
          MagpieTraceButton
        )
      );
    });
    return () => {
      cancelled = true;
      if (typeof dispose === "function") dispose();
    };
  }, "dsh-magpie-connect: composer trace slot");
}
var inject = ["slots", "locale"];

    return module.exports;
  }
});
