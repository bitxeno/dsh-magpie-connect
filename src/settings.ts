import { randomBytes } from 'node:crypto'
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
  /**
   * Pre-0.5 settings file (`~/.dsh-magpie-connect/settings.json`), or
   * `undefined` when no read-through-and-migrate is wanted (an explicit
   * `dataDir` means the user owns the path — never fall back, never delete).
   *
   * Read-only until the first successful write: settings are only moved to the
   * new location when the user saves something, so an upgrade that changes no
   * setting touches no file at all.
   */
  #legacyPath?: string
  /** True while the live state came from {@link #legacyPath}, not {@link #path}. */
  #legacySource = false
  /**
   * Set when the settings file exists but could not be read/parsed at startup.
   * Blocks a partial save (e.g. the model-list autosave that posts only
   * `enabledModels`) from writing the empty in-memory state over a file whose
   * credentials we simply failed to load — that is how a key silently vanished.
   */
  #loadFailed = false
  #settings: MagpiePageSettings = {}
  /** Serializes writes: one persist in flight, so two generations cannot interleave. */
  #writeChain: Promise<void> = Promise.resolve()
  #listeners = new Set<() => void>()

  constructor(options: { path?: string; legacyPath?: string } = {}) {
    this.#path = options.path
    this.#legacyPath = options.legacyPath
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
  async #readFile(path?: string): Promise<{ exists: boolean; raw?: unknown; error?: unknown }> {
    if (!path) return { exists: false }
    let text: string
    try {
      text = await readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false }
      return { exists: true, error }
    }
    try {
      return { exists: true, raw: JSON.parse(text) as unknown }
    } catch (error) {
      return { exists: true, error }
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
  async #resolveRaw(): Promise<{ exists: boolean; raw?: unknown; error?: unknown }> {
    const fromNew = await this.#readFile(this.#path)
    if (fromNew.raw !== undefined) return fromNew
    if (fromNew.exists) return fromNew
    const fromOld = await this.#readFile(this.#legacyPath)
    if (fromOld.raw !== undefined) {
      this.#legacySource = true
      return fromOld
    }
    return fromOld
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
  async read(): Promise<MagpiePageSettings> {
    const resolved = await this.#resolveRaw()
    if (resolved.raw !== undefined) {
      try {
        return normalizePageSettings(resolved.raw)
      } catch {
        this.#loadFailed = true
        return {}
      }
    }
    if (resolved.exists) this.#loadFailed = true
    return {}
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
    // Use the RAW document, not the normalized one: the legacy `hiddenModels`
    // conversion needs the field `normalizePageSettings` would drop.
    const resolved = await this.#resolveRaw()
    if (resolved.raw === undefined) {
      if (resolved.exists) this.#loadFailed = true
      this.#settings = {}
      return this.get()
    }
    const { settings, migrated } = migrateLegacySettings(resolved.raw, known)
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
    // Guard: after a failed startup read, refuse a partial save (the model-list
    // autosave posts only `enabledModels`) — persisting the blank in-memory
    // state would erase credentials we merely failed to load.
    if (this.#loadFailed && normalized.baseUrl === undefined && normalized.apiKey === undefined) {
      throw new Error(
        'dsh-magpie-connect: settings file was unreadable; refusing to overwrite it with a partial save — reload the settings page or restore settings.json',
      )
    }
    this.#settings = { ...this.#settings, ...normalized }
    await this.persist()
    // A complete save (both credentials present) proves the state is trustworthy again.
    if (normalized.baseUrl !== undefined && normalized.apiKey !== undefined) this.#loadFailed = false
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
    // Serialize: one write in flight, so overlapping generations cannot
    // interleave a read-modify-write or clobber each other's temp file.
    this.#writeChain = this.#writeChain.then(
      () => this.#writeNow(),
      () => this.#writeNow(),
    )
    await this.#writeChain
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
  async #writeNow(): Promise<void> {
    const target = this.#path
    if (!target) return
    await mkdir(dirname(target), { recursive: true })
    const tmp = `${target}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
    try {
      await writeFile(tmp, JSON.stringify(this.#settings, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      await rename(tmp, target)
    } finally {
      await rm(tmp, { force: true }).catch(() => {})
    }
    // The new file is durable now; only then drop the legacy one. A failed
    // delete is harmless (the new file is authoritative) and is retried on the
    // next save because `#legacySource` stays true.
    if (this.#legacySource && this.#legacyPath) {
      await rm(this.#legacyPath, { force: true })
        .then(() => {
          this.#legacySource = false
        })
        .catch(() => {
          // keep #legacySource so a later save retries the cleanup
        })
    }
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
