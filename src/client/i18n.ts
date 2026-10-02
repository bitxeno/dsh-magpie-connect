import { useSyncExternalStore } from 'react'

export const NS = 'magpie-connect'

type Dict = Record<string, string>

export const EN: Dict = {
  nav: 'Magpie',
  title: 'Magpie gateway',
  intro: 'Connect DSH to the Magpie LAN model gateway. Changes save to this machine and apply immediately — no restart needed.',
  connection: 'Connection',
  baseUrl: 'API URL',
  baseUrlPlaceholder: 'http://127.0.0.1:3425/v1',
  apiKey: 'API key',
  apiKeyPlaceholder: 'required',
  requiredNote: 'API URL and API key are both required.',
  test: 'Test connection',
  testing: 'Testing…',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved — live already.',
  testOk: 'Connection OK: {count} models found.',
  models: 'Models',
  showing: 'Showing {shown} of {total} in the picker.',
  search: 'Filter models…',
  showAll: 'Show all',
  hideAll: 'Hide all',
  image: 'image',
  responses: 'responses',
  reasoning: 'reasoning',
  context: '{window} ctx',
  hidden: 'hidden',
  saveHint: 'Untick a model to hide it from the model picker. Saved instantly.',
  notConfigured: 'Not fully configured: the model picker stays empty and calls fail until both fields are saved.',
  pluginVersion: 'Plugin version:',
  loadFailed: 'Failed to load settings: {message}',
  requestFailed: 'Request failed (HTTP {status})',
}

export const ZH: Dict = {
  nav: 'Magpie 网关',
  title: 'Magpie 网关',
  intro: '把 DSH 接入 Magpie 局域网模型网关。修改保存在本机并立即生效，无需重启。',
  connection: '连接',
  baseUrl: 'API 地址',
  baseUrlPlaceholder: 'http://127.0.0.1:3425/v1',
  apiKey: 'API Key',
  apiKeyPlaceholder: '必填',
  requiredNote: 'API 地址与 Key 均为必填。',
  test: '测试连接',
  testing: '测试中…',
  save: '保存',
  saving: '保存中…',
  saved: '已保存并实时生效。',
  testOk: '连接正常，共发现 {count} 个模型。',
  models: '模型列表',
  showing: '选择器中显示 {shown} / {total} 个。',
  search: '筛选模型…',
  showAll: '全部显示',
  hideAll: '全部隐藏',
  image: '图片',
  responses: 'responses',
  reasoning: '思考',
  context: '{window} 上下文',
  hidden: '已隐藏',
  saveHint: '取消勾选即在模型选择器中隐藏该模型，保存后立即生效。',
  notConfigured: '配置不完整：两个字段都保存后，模型选择器才会有内容，调用才会放行。',
  pluginVersion: '插件版本：',
  loadFailed: '加载设置失败：{message}',
  requestFailed: '请求失败（HTTP {status}）',
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
