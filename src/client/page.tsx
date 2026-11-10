import { useEffect, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { NS, text, useLocaleRevision } from './i18n.ts'
import { ModelListEditor, type CandidateRow, type ModelRow } from './model-list.tsx'
import { createWriteQueue } from './write-queue.ts'
import { PENDING_RETRY_DELAY_MS, shouldRetryPending, type SnapshotStatus } from './load-retry.ts'
import type { MagpieSettingsView } from '../settings.ts'

export const PLUGIN_VERSION: string = __PLUGIN_VERSION__

export type { ModelRow }

/** Where the GitHub mark points: the plugin's public repository. */
const REPO_URL = 'https://github.com/bitxeno/dsh-magpie-connect'

const css: Record<string, Record<string, string | number>> = {
  section: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 780, paddingBottom: 32 },
  /**
   * Title row: brand block (title + version, then the intro) on the left, the
   * GitHub action pinned right. Sits where the bare `<h2>` used to, so the rest
   * of the page keeps its spacing.
   */
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, margin: 0 },
  brand: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  heading: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 22, lineHeight: '30px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
  version: { fontSize: 11, lineHeight: '16px', fontWeight: 500, letterSpacing: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'var(--dsw-alias-label-tertiary)' },
  actions: { display: 'flex', alignItems: 'center', gap: 8, flex: 'none' },
  iconLink: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 30,
    height: 30,
    padding: 0,
    boxSizing: 'border-box',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: 8,
    color: 'var(--dsw-alias-label-secondary)',
    background: 'var(--dsw-alias-bg-layer-1)',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  intro: { margin: 0, fontSize: 14, lineHeight: '22px', color: 'var(--dsw-alias-label-secondary)' },
  card: { display: 'flex', flexDirection: 'column', gap: 14, padding: 18, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12, background: 'var(--dsw-alias-bg-layer-1)' },
  cardTitle: { margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-secondary)' },
  hint: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' },
  error: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-error, var(--dsw-alias-state-danger-label))' },
  ok: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-state-success-label, var(--dsw-alias-label-primary))' },
}

interface Envelope {
  ok: boolean
  value?: unknown
  error?: string
}

/**
 * Client cap for one settings request. Without it a gateway probe that never
 * answers leaves the card stuck in "Saving…"/"Testing…" with every control
 * disabled — the state the page showed while the POST route was missing.
 */
const REQUEST_TIMEOUT_MS = 30_000

async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      cache: 'no-store',
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (cause) {
    // A 404 body from an unregistered route is a real answer, so this branch
    // is network-level or an abort — report it rather than hanging.
    throw new Error(cause instanceof Error && cause.name === 'AbortError' ? text('requestTimeout') : String(cause))
  } finally {
    clearTimeout(timer)
  }
  let payload: Envelope
  try {
    payload = (await response.json()) as Envelope
  } catch {
    throw new Error(text('requestFailed', { status: response.status }))
  }
  if (!response.ok || payload?.ok !== true) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : text('requestFailed', { status: response.status }))
  }
  return payload.value
}

/**
 * Persist one allowlist change. Sends only `enabledModels`, so an autosave can
 * never re-commit credentials the user is still editing.
 * @param enabled - the allowlist to store (`undefined` = inherit the directory).
 * @returns when the host has accepted it.
 */
async function saveEnabledModels(enabled: string[] | undefined): Promise<void> {
  // JSON has no `undefined`, so inheritance is expressed by omitting the key —
  // which is how the route reads "no opinion" for a partial payload.
  await request('/api/magpie-settings', 'POST', enabled === undefined ? {} : { enabledModels: enabled })
}

export function MagpieSettings(): unknown {
  useLocaleRevision()
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  /** Whether a key is stored server-side; the value itself never reaches the page. */
  const [hasApiKey, setHasApiKey] = useState(false)
  /** `undefined` = inherit the gateway directory; an array = exactly those ids. */
  const [enabled, setEnabled] = useState<string[] | undefined>(undefined)
  const [models, setModels] = useState<ModelRow[]>([])
  const [busy, setBusy] = useState<'idle' | 'saving' | 'testing'>('idle')
  const [error, setError] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [modelsStatus, setModelsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [modelsError, setModelsError] = useState<string | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)
  /**
   * Set the moment the user touches either credential field. The first read
   * and any in-flight warm-up then leave those fields alone, so a slow load
   * cannot overwrite characters typed while it was still on the wire.
   */
  const credentialsDirty = useRef(false)

  /**
   * The model list autosaves: remove and adopt are discrete, deliberate acts,
   * and the Save button lives in the card above — far enough that a user who
   * just deleted a row would reasonably never look at it. Writes go through a
   * queue so clicking remove several times cannot interleave responses and
   * leave the disk holding an older set than the screen.
   */
  const modelsQueue = useRef(
    createWriteQueue<string[] | undefined>((next) => saveEnabledModels(next), (outcome) => {
      if (outcome.ok) {
        setModelsStatus('saved')
        setModelsError(undefined)
        return
      }
      setModelsStatus('error')
      setModelsError(outcome.error instanceof Error ? outcome.error.message : String(outcome.error))
    }),
  ).current

  useEffect(() => {
    let alive = true
    let retry: ReturnType<typeof setTimeout> | undefined
    /** Bound the retries: a gateway that stays down is a status line, not a spin. */
    let attempts = 0

    /**
     * Re-read **only** the model list while the catalog is still warming up.
     *
     * Deliberately does not touch `baseUrl`/`apiKey`: the earlier version
     * re-ran the whole load on every pending tick, which wrote the stored URL
     * and key back into the form about once a second — typing in the API URL
     * field looked like it kept re-typing itself. Credentials belong to the
     * first load and the user's own edits; the model rows are all a warm-up
     * re-read has any business changing.
     */
    const rereadModels = async (): Promise<void> => {
      const value = (await request('/api/magpie-models')) as { models: ModelRow[]; snapshot?: SnapshotStatus }
      if (!alive) return
      setModels(value.models ?? [])
      if (shouldRetryPending(value.snapshot, attempts)) {
        attempts += 1
        retry = setTimeout(() => void rereadModels().catch(() => {}), PENDING_RETRY_DELAY_MS)
      }
    }

    const load = async (): Promise<void> => {
      const [settingsValue, modelsValue] = await Promise.all([
        request('/api/magpie-settings'),
        request('/api/magpie-models'),
      ])
      if (!alive) return
      const settings = settingsValue as MagpieSettingsView
      const listed = (modelsValue as { models: ModelRow[] }).models ?? []
      const snapshot = (modelsValue as { snapshot?: SnapshotStatus }).snapshot
      // A slow first read must not clobber what the user typed meanwhile.
      if (!credentialsDirty.current) setBaseUrl(settings.baseUrl ?? '')
      // The credential never comes back; only whether one exists. The input
      // stays empty and its placeholder says the saved key will be kept.
      setHasApiKey(settings.hasApiKey === true)
      setEnabled(settings.enabledModels)
      setModels(listed)
      setLoaded(true)
      // The Host answers before its catalog has warmed up, and the first
      // paint would otherwise freeze on the built-in snapshot — a short list
      // that looks like the user's saved models were lost. Re-read the rows
      // until the live directory has landed; never the credentials above.
      if (shouldRetryPending(snapshot, attempts)) {
        attempts += 1
        retry = setTimeout(() => void rereadModels().catch(() => {}), PENDING_RETRY_DELAY_MS)
      }
    }

    void load().catch((cause: unknown) => {
      if (!alive) return
      setError(text('loadFailed', { message: cause instanceof Error ? cause.message : String(cause) }))
      setLoaded(true)
    })
    return () => {
      alive = false
      if (retry !== undefined) clearTimeout(retry)
    }
  }, [])

  const fetchCandidates = async (): Promise<readonly CandidateRow[]> => {
    const result = (await request('/api/magpie-discover', 'POST', { baseUrl, ...(apiKey.trim() === '' ? {} : { apiKey }) })) as { models: CandidateRow[] }
    return result.models ?? []
  }

  /**
   * Re-read the gateway's directory into the list.
   *
   * Discovery asks the endpoint the form shows, which can be newer than the one
   * the list was read from (an unsaved URL, or a key typed after the page
   * loaded). The list must hold the same directory the dialog is offering,
   * otherwise a model the user just ticked has no row to appear in.
   */
  const refreshModels = async (): Promise<void> => {
    const value = (await request('/api/magpie-models')) as { models: ModelRow[] }
    setModels(value.models ?? [])
  }

  /**
   * Commit an allowlist change and queue it. Only `enabledModels` is sent: the
   * credential fields are the Save button's business, and an autosave must not
   * quietly re-commit a URL or key the user is still editing.
   */
  const applyEnabled = (next: string[] | undefined): void => {
    setEnabled(next)
    setNotice(undefined)
    setModelsStatus('saving')
    setModelsError(undefined)
    modelsQueue.push(next)
  }

  const save = async (): Promise<void> => {
    setBusy('saving')
    setError(undefined)
    setNotice(undefined)
    try {
      const saved = (await request('/api/magpie-settings', 'POST', {
        baseUrl,
        ...(apiKey.trim() === '' ? {} : { apiKey }),
        ...(enabled === undefined ? {} : { enabledModels: enabled }),
      })) as MagpieSettingsView
      setBaseUrl(saved.baseUrl)
      setHasApiKey(saved.hasApiKey)
      // Never keep the typed secret in component state after it is stored.
      setApiKey('')
      // Adopt what the server stored, without queueing a write of its own —
      // that would be a pointless echo of what just landed. The set comes back
      // as submitted: the store no longer drops ids the directory omits.
      setEnabled(saved.enabledModels)
      // A save can move the origin, the key, or the visible set: re-read the
      // rows so the list matches the picker the save just pushed out.
      await refreshModels()
      setNotice(text('saved'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy('idle')
    }
  }

  const testConnection = async (): Promise<void> => {
    setBusy('testing')
    setError(undefined)
    setNotice(undefined)
    try {
      const result = (await request('/api/magpie-test', 'POST', { baseUrl, ...(apiKey.trim() === '' ? {} : { apiKey }) })) as { count: number }
      setNotice(text('testOk', { count: result.count }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy('idle')
    }
  }

  const working = busy !== 'idle'
  const incomplete = baseUrl.trim() === '' || (!hasApiKey && apiKey.trim() === '')

  return (
    <section style={css.section}>
      <header style={css.header}>
        <div style={css.brand}>
          <div style={css.heading}>
            <h2 style={css.title}>{text('title')}</h2>
            <span style={css.version}>v{PLUGIN_VERSION}</span>
          </div>
          <p style={css.intro}>{text('intro')}</p>
        </div>
        <div style={css.actions}>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={text('github')}
            title={text('github')}
            style={css.iconLink}
          >
            <svg width={18} height={18} viewBox="0 0 16 16" fill="currentColor" focusable="false" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </div>
      </header>

      <div style={css.card}>
        <h3 style={css.cardTitle}>{text('connection')}</h3>
        <p style={css.hint}>{text('requiredNote')}</p>
        <div style={css.field}>
          <span style={css.label}>{text('baseUrl')}</span>
          <Input value={baseUrl} placeholder={text('baseUrlPlaceholder')} disabled={working} onChange={(event: { currentTarget: { value: string } }) => { credentialsDirty.current = true; setBaseUrl(event.currentTarget.value) }} />
        </div>
        <div style={css.field}>
          <span style={css.label}>{text('apiKey')}</span>
          <Input type="password" value={apiKey} placeholder={text(hasApiKey ? 'apiKeySavedPlaceholder' : 'apiKeyPlaceholder')} disabled={working} onChange={(event: { currentTarget: { value: string } }) => { credentialsDirty.current = true; setApiKey(event.currentTarget.value) }} />
        </div>
        <div style={css.row}>
          <Button variant="primary" disabled={working || incomplete} onClick={() => void save()}>
            {busy === 'saving' ? text('saving') : text('save')}
          </Button>
          <Button variant="outline" disabled={working || incomplete} onClick={() => void testConnection()}>
            {busy === 'testing' ? text('testing') : text('test')}
          </Button>
        </div>
        {error === undefined ? null : (
          <p role="alert" style={css.error}>
            {error}
          </p>
        )}
        {notice === undefined ? null : <p style={css.ok}>{notice}</p>}
        {loaded && incomplete ? <p style={css.hint}>{text('notConfigured')}</p> : null}
      </div>

      <ModelListEditor
        models={models}
        enabled={enabled}
        onFetch={fetchCandidates}
        onRefresh={refreshModels}
        onEnabledChange={applyEnabled}
        disabled={!loaded || working}
        fetchable={!incomplete}
        status={modelsStatus}
        failure={modelsError}
      />

    </section>
  )
}

export { NS }
