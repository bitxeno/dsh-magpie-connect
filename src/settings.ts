import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Page-owned runtime settings, persisted to a local JSON file.
 *
 * Precedence for the effective endpoint: settings page (this file, only the
 * fields the user actually saved) > cordis patch config > built-in defaults.
 *
 * `enabledModels` is an **allowlist**, matching DSH's own Models settings: the
 * picker offers the intersection of the gateway directory and this list. `null`
 * (absent) means "inherit the whole directory", `[]` means "offer nothing", and
 * a populated array means exactly those ids. The old blacklist
 * (`hiddenModels`) could not express "the gateway added a model I don't want
 * yet"; an allowlist can, and it is why a model the gateway re-lists never
 * comes back on its own.
 */

export interface MagpiePageSettings {
  baseUrl?: string
  apiKey?: string
  /**
   * Allowlist of model ids the picker offers. `undefined` = inherit every model
   * the gateway serves; `[]` = offer none; otherwise exactly these ids.
   */
  enabledModels?: string[]
  /**
   * Set once the `hiddenModels` (blacklist) document has been converted to
   * `enabledModels`. Its presence stops the migration from running twice — a
   * second run would read an already-allowlisted document as if it were a
   * blacklist and invert it into nonsense.
   */
  migratedFromHiddenModels?: true
}

export interface EffectiveEndpoint {
  baseUrl: string
  apiKey: string
}

export const SETTINGS_FILE = 'settings.json'

export function defaultSettingsPath(dataDir: string): string {
  return join(dataDir, SETTINGS_FILE)
}

/**
 * Normalize an API base URL: must be http(s), no trailing slash, path kept.
 *
 * The path is load-bearing, not a mistake to be trimmed: the gateway versions
 * its API (`/v1`, and later `/v2`, `/v3`), so this value *is* the prefix every
 * request is built on. The plugin appends only the resource (`/models`,
 * `/chat/completions`), never a version of its own — an origin-only value
 * would make a future `/v2` unreachable.
 */
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
  // Query and fragment are never part of a base URL and would corrupt every
  // appended path; drop them rather than storing a value the wire ignores.
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

/** Normalize an enabled-model allowlist: strings only, deduped, order kept. */
export function normalizeEnabledModels(raw: unknown): string[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) throw new Error('dsh-magpie-connect: enabledModels must be an array of model ids')
  const out: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') throw new Error('dsh-magpie-connect: enabledModels must be an array of model ids')
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
  if (record.enabledModels !== undefined) out.enabledModels = normalizeEnabledModels(record.enabledModels)
  if (record.migratedFromHiddenModels === true) out.migratedFromHiddenModels = true
  return out
}

/** Deep copy so a caller cannot mutate the store through a returned object. */
function cloneSettings(source: MagpiePageSettings): MagpiePageSettings {
  return {
    ...source,
    ...(source.enabledModels === undefined ? {} : { enabledModels: [...source.enabledModels] }),
  }
}

/**
 * One-time conversion from the old blacklist document to the allowlist.
 *
 * The legacy file stored `hiddenModels` (ids to *exclude*). The new shape stores
 * `enabledModels` (ids to *include*), so the two are not interchangeable: an
 * unconverted file would be read as "offer exactly the models I had hidden",
 * which is the precise inverse of what the user asked for.
 *
 * `known` is the ids the picker would have offered under the old rules — the
 * gateway directory (live, else cached, else the built-in snapshot) minus the
 * hidden set. The conversion can only be computed from it, so the caller passes
 * whatever directory it has; when nothing is known yet (unconfigured, cold
 * cache), `enabledModels` is left absent, which means "inherit everything" —
 * the only reading that cannot silently drop models the user can still use.
 *
 * The marker `migratedFromHiddenModels` is written even when the list could not
 * be computed: the blacklist is gone either way, and re-running the conversion
 * later would invert an already-converted document.
 * @param raw - the parsed settings document.
 * @param known - ids the old rules would have offered, or `undefined` when unknown.
 * @returns the converted document and whether anything changed.
 */
export function migrateLegacySettings(
  raw: unknown,
  known?: readonly string[],
): { settings: MagpiePageSettings; migrated: boolean } {
  if (!raw || typeof raw !== 'object') return { settings: {}, migrated: false }
  const record = raw as Record<string, unknown>
  const legacy = record.hiddenModels
  if (record.migratedFromHiddenModels === true || !Array.isArray(legacy)) {
    return { settings: normalizePageSettings(raw), migrated: false }
  }
  const hidden = new Set(legacy.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter((entry) => entry !== ''))
  const base: Record<string, unknown> = { ...record, migratedFromHiddenModels: true }
  delete base.hiddenModels
  if (known !== undefined) base.enabledModels = known.filter((id) => !hidden.has(id))
  const settings = normalizePageSettings(base)
  return { settings, migrated: true }
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

  /**
   * Read and normalize the persisted document (missing/corrupt reads as empty,
   * never throws). Does not touch memory or disk.
   *
   * Separate from {@link load} because the legacy conversion needs the gateway
   * directory, and that can only be read once the persisted endpoint is known:
   * the process starts with the patch/default endpoint, not the user's.
   */
  async read(): Promise<MagpiePageSettings> {
    if (!this.#path) return {}
    try {
      const raw = JSON.parse(await readFile(this.#path, 'utf8')) as unknown
      return normalizePageSettings(raw)
    } catch {
      return {}
    }
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
  async load(known?: readonly string[]): Promise<MagpiePageSettings> {
    if (!this.#path) return this.get()
    let raw: unknown
    try {
      raw = JSON.parse(await readFile(this.#path, 'utf8'))
    } catch {
      this.#settings = {}
      return this.get()
    }
    const { settings, migrated } = migrateLegacySettings(raw, known)
    this.#settings = settings
    if (migrated) await this.persist().catch(() => {})
    return this.get()
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
  async hydrate(raw: MagpiePageSettings, known?: readonly string[]): Promise<MagpiePageSettings> {
    const { settings, migrated } = migrateLegacySettings(raw, known)
    this.#settings = settings
    if (migrated) await this.persist().catch(() => {})
    this.#emit()
    return this.get()
  }

  get(): MagpiePageSettings {
    return cloneSettings(this.#settings)
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
    this.#settings = cloneSettings(next)
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
