import { useSyncExternalStore } from 'react'

export const NS = 'magpie-connect'

type Dict = Record<string, string>

export const EN: Dict = {
  nav: 'Magpie',
  title: 'Magpie gateway',
  intro: 'Connect DSH to the Magpie model gateway. Changes save to this machine and apply immediately — no restart needed.',
  connection: 'Connection',
  baseUrl: 'API URL',
  baseUrlPlaceholder: 'http://127.0.0.1:3425/v1',
  apiKey: 'API key',
  apiKeyPlaceholder: 'required',
  requiredNote: 'API URL and API key are both required. Include the version segment (e.g. /v1) — the URL is used exactly as written.',
  test: 'Test connection',
  testing: 'Testing…',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved — live already.',
  savingModels: 'Saving models…',
  modelsSaved: 'Models saved — the picker is up to date.',
  testOk: 'Connection OK: {count} models found.',
  models: 'Models',
  modelsInherited: 'Using the gateway\u2019s full catalog.',
  modelsCustomized: '{count} models offered by the picker.',
  resetModels: 'Restore defaults',
  allRemoved: 'No model is offered right now — fetch available models to add some, or restore defaults.',
  remove: 'Remove',
  removeHint: 'Remove this model from the picker. Fetch available models and tick it again to bring it back.',
  sourceStatic: 'built-in snapshot',
  sourceStale: 'not listed by gateway',
  search: 'Filter models…',
  fetchModels: 'Fetch available models',
  fetching: 'Fetching…',
  fetchTitle: 'Available models',
  fetchDescription: 'Models the gateway lists right now. Tick the ones the picker should offer — applying replaces the list with exactly your selection.',
  fetchSearch: 'Search models…',
  fetchSelectAll: 'Select all',
  fetchDeselectAll: 'Deselect all',
  fetchAdopt: 'Apply selection',
  fetchEmpty: 'The gateway listed no models.',
  fetchNoMatches: 'No matching models.',
  fetchNeedsConfig: 'Set the API URL and key before fetching.',
  fetchFound: '{count} models found — {picked} selected.',
  cancel: 'Cancel',
  close: 'Close',
  image: 'image',
  responses: 'responses',
  reasoning: 'reasoning',
  context: '{window} ctx',
  saveHint: 'These are the models the picker offers; the gateway\u2019s catalog is not shown until you add from it. Changes save on their own — the credential fields above still need Save.',
  notConfigured: 'Not fully configured: the model picker stays empty and calls fail until both fields are saved.',
  pluginVersion: 'Plugin version:',
  loadFailed: 'Failed to load settings: {message}',
  requestFailed: 'Request failed (HTTP {status})',
  requestTimeout: 'Request timed out. Check the gateway address and try again.',
}

export const ZH: Dict = {
  nav: 'Magpie 网关',
  title: 'Magpie 网关',
  intro: '把 DSH 接入 Magpie 模型网关。修改保存在本机并立即生效，无需重启。',
  connection: '连接',
  baseUrl: 'API 地址',
  baseUrlPlaceholder: 'http://127.0.0.1:3425/v1',
  apiKey: 'API Key',
  apiKeyPlaceholder: '必填',
  requiredNote: 'API 地址与 Key 均为必填。地址需包含版本段（如 /v1），插件按你填写的原样使用。',
  test: '测试连接',
  testing: '测试中…',
  save: '保存',
  saving: '保存中…',
  saved: '已保存并实时生效。',
  savingModels: '正在保存模型…',
  modelsSaved: '模型已保存，选择器已更新。',
  testOk: '连接正常，共发现 {count} 个模型。',
  models: '模型列表',
  modelsInherited: '正在使用网关的完整目录。',
  modelsCustomized: '选择器中提供 {count} 个模型。',
  resetModels: '恢复默认模型',
  allRemoved: '当前没有提供任何模型——用“获取可用模型”添加，或恢复默认。',
  remove: '删除',
  removeHint: '从选择器中移除该模型；用“获取可用模型”重新勾选即可加回。',
  sourceStatic: '内置快照',
  sourceStale: '网关未列出',
  search: '筛选模型…',
  fetchModels: '获取可用模型',
  fetching: '获取中…',
  fetchTitle: '可用模型',
  fetchDescription: '网关此刻列出的模型。勾选需要出现在选择器中的那些——应用后列表就正好是这些。',
  fetchSearch: '搜索模型…',
  fetchSelectAll: '全选',
  fetchDeselectAll: '取消全选',
  fetchAdopt: '应用选择',
  fetchEmpty: '网关没有列出任何模型。',
  fetchNoMatches: '没有匹配的模型。',
  fetchNeedsConfig: '请先填写 API 地址与 Key。',
  fetchFound: '共发现 {count} 个模型，已选 {picked} 个。',
  cancel: '取消',
  close: '关闭',
  image: '图片',
  responses: 'responses',
  reasoning: '思考',
  context: '{window} 上下文',
  saveHint: '以下即选择器提供的模型，网关目录里的其余模型不会自动出现；改动会自动保存，上方的地址与 Key 仍需点“保存”。',
  notConfigured: '配置不完整：两个字段都保存后，模型选择器才会有内容，调用才会放行。',
  pluginVersion: '插件版本：',
  loadFailed: '加载设置失败：{message}',
  requestFailed: '请求失败（HTTP {status}）',
  requestTimeout: '请求超时，请检查网关地址后重试。',
}

export interface LocaleRuntime {
  subscribe(listener: () => void): () => void
  getSnapshot(): { active?: string; revision?: number }
}

let localeRuntime: LocaleRuntime | undefined

export function setLocaleRuntime(runtime: LocaleRuntime | undefined): void {
  localeRuntime = runtime
}

function format(template: string, params?: Record<string, unknown>): string {
  if (!params) return template
  return template.replace(/\{([^}]+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match))
}

export function text(key: string, params?: Record<string, unknown>): string {
  const active = localeRuntime?.getSnapshot().active
  const dictionary = active === 'zh' ? ZH : EN
  return format(dictionary[key] ?? EN[key] ?? key, params)
}

function subscribe(listener: () => void): () => void {
  return localeRuntime === undefined ? () => {} : localeRuntime.subscribe(listener)
}

function snapshot(): number {
  return localeRuntime?.getSnapshot().revision ?? 0
}

export function useLocaleRevision(): void {
  useSyncExternalStore(subscribe, snapshot, () => 0)
}
