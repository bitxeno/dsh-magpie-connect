import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Page-owned runtime settings, persisted to a local JSON file.
 *
 * Precedence for the effective endpoint: settings page (this file, only the
 * fields the user actually saved) > cordis patch config > built-in defaults.
 * Hidden models only ever come from this file — the patch config has no such
 * field, so an empty/absent list means "show everything".
 */

export interface MagpiePageSettings {
  baseUrl?: string
  apiKey?: string
  hiddenModels?: string[]
}

export interface EffectiveEndpoint {
  baseUrl: string
  apiKey: string
}

export const SETTINGS_FILE = 'settings.json'

export function defaultSettingsPath(dataDir: string): string {
  return join(dataDir, SETTINGS_FILE)
}

/** Normalize an origin: must be http(s), no trailing slash. Throws on invalid. */
export function normalizeBaseUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') throw new Error('dsh-magpie-connect: baseUrl must be a non-empty http(s) URL')
  const trimmed = raw.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(`dsh-magpie-connect: baseUrl is not a valid URL: ${trimmed}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`dsh-magpie-connect: baseUrl must use http(s): ${trimmed}`)
  }
  return url.origin
}

/** Normalize a hidden-model list: strings only, deduped, order kept. */
export function normalizeHiddenModels(raw: unknown): string[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) throw new Error('dsh-magpie-connect: hiddenModels must be an array of model ids')
  const out: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') throw new Error('dsh-magpie-connect: hiddenModels must be an array of model ids')
    const id = entry.trim()
    if (id !== '' && !out.includes(id)) out.push(id)
  }
  return out
}

/** Validate + normalize a page payload (full or partial). Unknown keys are dropped. */
export function normalizePageSettings(raw: unknown): MagpiePageSettings {
  if (!raw || typeof raw !== 'object') throw new Error('dsh-magpie-connect: settings payload must be an object')
  const record = raw as Record<string, unknown>
  const out: MagpiePageSettings = {}
  if (record.baseUrl !== undefined) out.baseUrl = normalizeBaseUrl(record.baseUrl)
  if (record.apiKey !== undefined) {
    if (typeof record.apiKey !== 'string' || record.apiKey.trim() === '') {
      throw new Error('dsh-magpie-connect: apiKey is required and must not be empty')
    }
    // Surrounding whitespace is always a paste artifact in Bearer keys.
    out.apiKey = record.apiKey.trim()
  }
  if (record.hiddenModels !== undefined) out.hiddenModels = normalizeHiddenModels(record.hiddenModels)
  return out
}

/**
 * Merge patch config with page settings: page wins per-field, but only for
 * fields it actually saved (absent page fields fall back to patch/defaults).
 */
export function resolveEffectiveEndpoint(
  patch: { baseUrl: string; apiKey: string },
  page: MagpiePageSettings,
): EffectiveEndpoint {
  return {
    baseUrl: page.baseUrl ?? patch.baseUrl,
    apiKey: page.apiKey ?? patch.apiKey,
  }
}

/** Fully configured only when both URL and key are present. Either missing gates everything. */
export function isConfigured(endpoint: EffectiveEndpoint): boolean {
  return endpoint.baseUrl !== '' && endpoint.apiKey !== ''
}

/** In-memory settings with file persistence. Synchronous reads for the hot path. */
export class SettingsStore {
  #path?: string
  #settings: MagpiePageSettings = {}
  #listeners = new Set<() => void>()

  constructor(options: { path?: string } = {}) {
    this.#path = options.path
  }

  /** Load persisted settings (missing/corrupt file reads as empty, never throws). */
  async load(): Promise<MagpiePageSettings> {
    if (!this.#path) return this.get()
    try {
      const raw = JSON.parse(await readFile(this.#path, 'utf8')) as unknown
      this.#settings = normalizePageSettings(raw)
    } catch {
      this.#settings = {}
    }
    return this.get()
  }

  get(): MagpiePageSettings {
    return { ...this.#settings, hiddenModels: [...(this.#settings.hiddenModels ?? [])] }
  }

  /** Merge a partial payload, persist, and notify listeners. */
  async save(partial: unknown): Promise<MagpiePageSettings> {
    const normalized = normalizePageSettings(partial)
    this.#settings = { ...this.#settings, ...normalized }
    await this.persist()
    this.#emit()
    return this.get()
  }

  /** Replace the whole document (used at startup after load). */
  replace(next: MagpiePageSettings): void {
    this.#settings = { ...next, hiddenModels: [...(next.hiddenModels ?? [])] }
    this.#emit()
  }

  onChange(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  async persist(): Promise<void> {
    if (!this.#path) return
    const tmp = `${this.#path}.${process.pid}.tmp`
    await mkdir(dirname(this.#path), { recursive: true })
    await writeFile(tmp, JSON.stringify(this.#settings, null, 2), 'utf8')
    await rm(this.#path, { force: true })
    await rename(tmp, this.#path)
  }

  #emit(): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener()
      } catch {
        // listeners must never break the save path
      }
    }
  }
}
