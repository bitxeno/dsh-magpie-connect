import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { NS, text, useLocaleRevision } from './i18n.ts'
import { ModelListEditor, type CandidateRow, type ModelRow } from './model-list.tsx'
import { hideOne } from './model-visibility.ts'
import { createWriteQueue } from './write-queue.ts'

export const PLUGIN_VERSION: string = __PLUGIN_VERSION__

export type { ModelRow }

const css: Record<string, Record<string, string | number>> = {
  section: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 780, paddingBottom: 32 },
  title: { margin: 0, fontSize: 22, lineHeight: '30px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
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
 * Persist one visibility change. Sends only `hiddenModels`, so an autosave can
 * never re-commit credentials the user is still editing.
 * @param hidden - the hidden set to store.
 * @returns when the host has accepted it.
 */
async function saveHiddenModels(hidden: string[]): Promise<void> {
  await request('/api/magpie-settings', 'POST', { hiddenModels: hidden })
}

export function MagpieSettings(): unknown {
  useLocaleRevision()
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hidden, setHidden] = useState<string[]>([])
  const [models, setModels] = useState<ModelRow[]>([])
  const [busy, setBusy] = useState<'idle' | 'saving' | 'testing'>('idle')
  const [error, setError] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [modelsStatus, setModelsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [modelsError, setModelsError] = useState<string | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)

  /**
   * The model list autosaves: remove and adopt are discrete, deliberate acts,
   * and the Save button lives in the card above — far enough that a user who
   * just deleted a row would reasonably never look at it. Writes go through a
   * queue so clicking remove several times cannot interleave responses and
   * leave the disk holding an older set than the screen.
   */
  const modelsQueue = useRef(
    createWriteQueue<string[]>((next) => saveHiddenModels(next), (outcome) => {
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
    Promise.all([request('/api/magpie-settings'), request('/api/magpie-models')]).then(
      ([settingsValue, modelsValue]) => {
        if (!alive) return
        const settings = settingsValue as { baseUrl: string; apiKey: string; hiddenModels: string[] }
        const listed = (modelsValue as { models: ModelRow[] }).models ?? []
        setBaseUrl(settings.baseUrl ?? '')
        setApiKey(settings.apiKey ?? '')
        setHidden(settings.hiddenModels ?? [])
        setModels(listed)
        setLoaded(true)
      },
      (cause: unknown) => {
        if (!alive) return
        setError(text('loadFailed', { message: cause instanceof Error ? cause.message : String(cause) }))
        setLoaded(true)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const hiddenSet = useMemo(() => new Set(hidden), [hidden])
  const visibleIds = useMemo(() => new Set(models.filter((row) => !hiddenSet.has(row.id)).map((row) => row.id)), [models, hiddenSet])

  const fetchCandidates = async (): Promise<readonly CandidateRow[]> => {
    const result = (await request('/api/magpie-discover', 'POST', { baseUrl, apiKey })) as { models: CandidateRow[] }
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
   * Commit a visibility change and queue it. Only `hiddenModels` is sent: the
   * credential fields are the Save button's business, and an autosave must not
   * quietly re-commit a URL or key the user is still editing.
   */
  const applyHidden = (next: string[]): void => {
    setHidden(next)
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
      const saved = (await request('/api/magpie-settings', 'POST', { baseUrl, apiKey, hiddenModels: hidden })) as {
        baseUrl: string
        apiKey: string
        hiddenModels: string[]
      }
      setBaseUrl(saved.baseUrl)
      setApiKey(saved.apiKey)
      // The response carries the pruned set; adopt it without queueing a write
      // of its own, which would be a pointless echo of what just landed.
      setHidden(saved.hiddenModels ?? [])
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
      const result = (await request('/api/magpie-test', 'POST', { baseUrl, apiKey })) as { count: number }
      setNotice(text('testOk', { count: result.count }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy('idle')
    }
  }

  const working = busy !== 'idle'
  const incomplete = baseUrl.trim() === '' || apiKey.trim() === ''

  return (
    <section style={css.section}>
      <h2 style={css.title}>{text('title')}</h2>
      <p style={css.intro}>{text('intro')}</p>

      <div style={css.card}>
        <h3 style={css.cardTitle}>{text('connection')}</h3>
        <p style={css.hint}>{text('requiredNote')}</p>
        <div style={css.field}>
          <span style={css.label}>{text('baseUrl')}</span>
          <Input value={baseUrl} placeholder={text('baseUrlPlaceholder')} disabled={working} onChange={(event: { currentTarget: { value: string } }) => setBaseUrl(event.currentTarget.value)} />
        </div>
        <div style={css.field}>
          <span style={css.label}>{text('apiKey')}</span>
          <Input type="password" value={apiKey} placeholder={text('apiKeyPlaceholder')} disabled={working} onChange={(event: { currentTarget: { value: string } }) => setApiKey(event.currentTarget.value)} />
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
        visibleIds={visibleIds}
        onFetch={fetchCandidates}
        onRefresh={refreshModels}
        onRemove={(id) => applyHidden(hideOne(hidden, id))}
        onHiddenChange={applyHidden}
        disabled={!loaded || working}
        fetchable={!incomplete}
        status={modelsStatus}
        failure={modelsError}
      />

      <p style={css.hint}>
        {text('pluginVersion')} dsh-magpie-connect v{PLUGIN_VERSION}
      </p>
    </section>
  )
}

export { NS }
