import { useEffect, useMemo, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { NS, text, useLocaleRevision } from './i18n.ts'

export const PLUGIN_VERSION: string = __PLUGIN_VERSION__

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
  body: { margin: 0, fontSize: 14, lineHeight: '22px', color: 'var(--dsw-alias-label-primary)' },
  error: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-error, var(--dsw-alias-state-danger-label))' },
  ok: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-state-success-label, var(--dsw-alias-label-primary))' },
  list: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflowY: 'auto', paddingRight: 4 },
  item: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'transparent' },
  itemHidden: { opacity: 0.55 },
  checkbox: { marginTop: 3, width: 15, height: 15, accentColor: 'var(--dsw-alias-brand-primary)', flex: 'none', cursor: 'pointer' },
  itemMain: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  itemId: { fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)', overflowWrap: 'anywhere', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { fontSize: 11, lineHeight: '18px', padding: '0 7px', borderRadius: 999, border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'nowrap' },
  versionLink: { color: 'var(--dsw-alias-brand-primary)' },
}

export interface ModelRow {
  id: string
  displayName: string
  contextWindow?: number
  maxTokens?: number
  image: boolean
  responsesOnly: boolean
  reasoning: boolean
  efforts: string[]
  hidden: boolean
}

interface Envelope {
  ok: boolean
  value?: unknown
  error?: string
}

async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method,
    headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    cache: 'no-store',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
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

function formatWindow(value?: number): string {
  if (value === undefined) return ''
  if (value >= 1000000) return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return String(value)
}

export function MagpieSettings(): unknown {
  useLocaleRevision()
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hidden, setHidden] = useState<string[]>([])
  const [models, setModels] = useState<ModelRow[]>([])
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState<'idle' | 'saving' | 'testing'>('idle')
  const [error, setError] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)

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
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const rows = needle === '' ? models : models.filter((row) => row.id.toLowerCase().includes(needle) || row.displayName.toLowerCase().includes(needle))
    return rows
  }, [models, filter])
  const shownCount = models.length - hiddenSet.size

  const toggle = (id: string): void => {
    setHidden((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]))
    setNotice(undefined)
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
      setHidden(saved.hiddenModels ?? [])
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

      <div style={css.card}>
        <h3 style={css.cardTitle}>{text('models')}</h3>
        <p style={css.hint}>
          {text('showing', { shown: Math.max(shownCount, 0), total: models.length })} {text('saveHint')}
        </p>
        <div style={css.row}>
          <Input value={filter} placeholder={text('search')} disabled={!loaded} onChange={(event: { currentTarget: { value: string } }) => setFilter(event.currentTarget.value)} style={{ flex: 1, minWidth: 180 }} />
          <Button
            variant="outline"
            disabled={!loaded}
            onClick={() => {
              setHidden([])
              setNotice(undefined)
            }}
          >
            {text('showAll')}
          </Button>
          <Button
            variant="outline"
            disabled={!loaded}
            onClick={() => {
              setHidden(models.map((row) => row.id))
              setNotice(undefined)
            }}
          >
            {text('hideAll')}
          </Button>
        </div>
        <div style={css.list}>
          {visible.map((row) => {
            const isHidden = hiddenSet.has(row.id)
            return (
              <label key={row.id} style={{ ...css.item, ...(isHidden ? css.itemHidden : {}) }}>
                <input type="checkbox" style={css.checkbox} checked={!isHidden} onChange={() => toggle(row.id)} aria-label={row.id} />
                <span style={css.itemMain}>
                  <span style={css.itemId}>{row.id}</span>
                  <span style={css.chips}>
                    {row.image ? <span style={css.chip}>{text('image')}</span> : null}
                    {row.responsesOnly ? <span style={css.chip}>{text('responses')}</span> : null}
                    {row.reasoning ? <span style={css.chip}>{`${text('reasoning')} · ${row.efforts.length}`}</span> : null}
                    {row.contextWindow !== undefined ? <span style={css.chip}>{text('context', { window: formatWindow(row.contextWindow) })}</span> : null}
                    {isHidden ? <span style={css.chip}>{text('hidden')}</span> : null}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <p style={css.hint}>
        {text('pluginVersion')} dsh-magpie-connect v{PLUGIN_VERSION}
      </p>
    </section>
  )
}

export { NS }
