import { useEffect, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { NS, text, useLocaleRevision } from './i18n.ts'
import { ModelListEditor, type CandidateRow, type ModelRow } from './model-list.tsx'
import { createWriteQueue } from './write-queue.ts'
import { PENDING_RETRY_DELAY_MS, shouldRetryPending, type SnapshotStatus } from './load-retry.ts'
import type { MagpieSearchMode, MagpieSettingsView } from '../settings.ts'

export const PLUGIN_VERSION: string = __PLUGIN_VERSION__

/** 搜索模型下拉框中触发手动输入自定义模型 ID 的哨兵值。 */
const CUSTOM_SEARCH_MODEL = '__custom__'

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
  select: {
    width: '100%',
    height: 36,
    padding: '0 10px',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: 8,
    background: 'var(--dsw-alias-bg-layer-1)',
    color: 'var(--dsw-alias-label-primary)',
    fontSize: 13,
    lineHeight: '20px',
    boxSizing: 'border-box',
  },
  hint: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' },
  error: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-error, var(--dsw-alias-state-danger-label))' },
  ok: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-state-success-label, var(--dsw-alias-label-primary))' },
  switchRow: { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' },
  switchBox: { width: 16, height: 16, margin: '2px 0 0', accentColor: 'var(--dsw-alias-brand-primary, #4c6ef5)', cursor: 'pointer', flex: 'none' },
  switchText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  switchLabel: { fontSize: 14, lineHeight: '20px', color: 'var(--dsw-alias-label-primary)' },
  switchHint: { fontSize: 12, lineHeight: '17px', color: 'var(--dsw-alias-label-tertiary)' },
  collapseHead: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' },
  /** Status + chevron grouped at the right edge, so a card without a status still pins its chevron. */
  collapseMeta: { display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flex: 'none' },
  collapseStatus: { fontSize: 12, lineHeight: '17px', whiteSpace: 'nowrap', color: 'var(--dsw-alias-label-tertiary)' },
  collapseStatusOn: { color: 'var(--dsw-alias-state-success-label, var(--dsw-alias-label-secondary))' },
  collapseChevron: { flex: 'none', color: 'var(--dsw-alias-label-tertiary)', transition: 'transform 0.16s', display: 'inline-flex' },
  collapseChevronOpen: { transform: 'rotate(180deg)' },
  collapseBody: { display: 'flex', flexDirection: 'column', gap: 14 },
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

/**
 * Persist the composer-icon toggle. Sent alone, so flipping it can never
 * re-commit credentials the user is still editing (the same rule the model
 * list's autosave follows).
 */
async function saveShowComposerIcon(show: boolean): Promise<void> {
  await request('/api/magpie-settings', 'POST', { showComposerIcon: show })
}

/** Persist only the Web Key, so it never re-commits URL/API key fields. */
async function saveWebKey(webKey: string): Promise<MagpieSettingsView> {
  return (await request('/api/magpie-settings', 'POST', { webKey })) as MagpieSettingsView
}

/** 单独保存网页搜索设置（与连接凭据隔离，不会误提交编辑中的地址或 Key）。 */
async function saveSearchSettings(payload: {
  searchMode?: MagpieSearchMode
  searchModel?: string
  searchActive?: boolean
}): Promise<MagpieSettingsView> {
  return (await request('/api/magpie-settings', 'POST', payload)) as MagpieSettingsView
}

/** Props of {@link CollapsibleCard}. */
interface CollapsibleCardProps {
  /** Card heading; the only thing visible while collapsed. */
  title: string
  /** Short state summary left of the chevron, visible whether open or collapsed. */
  status?: string
  /** Tint the status as active; off/unset/unavailable stay muted. */
  statusOn?: boolean
  open: boolean
  onToggle: () => void
  /** Card content; unmounted rather than hidden while collapsed. */
  children: unknown
}

/**
 * A settings card whose body folds away behind its title row.
 *
 * Secondary cards start collapsed so the page opens on the controls that
 * matter first. The whole title row is a `<button>` (keyboard reachable) and
 * carries `aria-expanded`, so the state is not conveyed by the chevron alone;
 * the body is unmounted rather than visually hidden, so a collapsed card
 * cannot hold focus or be read by a screen reader.
 */
function CollapsibleCard({ title, status, statusOn, open, onToggle, children }: CollapsibleCardProps): unknown {
  return (
    <div style={{ ...css.card, gap: open ? 14 : 0 }}>
      <button type="button" aria-expanded={open} onClick={onToggle} style={css.collapseHead}>
        <h3 style={css.cardTitle}>{title}</h3>
        <span style={css.collapseMeta}>
          {status === undefined ? null : (
            <span style={{ ...css.collapseStatus, ...(statusOn === true ? css.collapseStatusOn : {}) }}>{status}</span>
          )}
          <span style={{ ...css.collapseChevron, ...(open ? css.collapseChevronOpen : {}) }} aria-hidden="true">
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </span>
        </span>
      </button>
      {open ? <div style={css.collapseBody}>{children}</div> : null}
    </div>
  )
}

export function MagpieSettings(): unknown {
  useLocaleRevision()
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [webKey, setWebKey] = useState('')
  /** Secrets remain server-side; the page only learns whether each exists. */
  const [hasApiKey, setHasApiKey] = useState(false)
  const [hasWebKey, setHasWebKey] = useState(false)
  /** `undefined` = inherit the gateway directory; an array = exactly those ids. */
  const [enabled, setEnabled] = useState<string[] | undefined>(undefined)
  const [models, setModels] = useState<ModelRow[]>([])
  const [busy, setBusy] = useState<'idle' | 'saving' | 'testing'>('idle')
  const [error, setError] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [modelsStatus, setModelsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [modelsError, setModelsError] = useState<string | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)
  /** Whether the composer's routing icon shows; the switch writes through immediately. */
  const [showComposerIcon, setShowComposerIcon] = useState(true)
  const [iconStatus, setIconStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [iconError, setIconError] = useState<string | undefined>(undefined)
  const [webKeyStatus, setWebKeyStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [webKeyError, setWebKeyError] = useState<string | undefined>(undefined)
  /** The interface card is secondary; keep the settings page's core controls first. */
  const [enhancementsOpen, setEnhancementsOpen] = useState(false)
  /** 网页搜索同样是可选功能，默认收缩，让连接配置与模型列表先被看到。 */
  const [searchOpen, setSearchOpen] = useState(false)
  /** 网页搜索相关设置与 DSH 绑定状态。 */
  const [searchMode, setSearchMode] = useState<MagpieSearchMode>('mcp')
  const [searchModel, setSearchModel] = useState('')
  const [searchCustomModel, setSearchCustomModel] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const [searchRegistered, setSearchRegistered] = useState(false)
  const [searchSwitchable, setSearchSwitchable] = useState(false)
  const [activeSearchProvider, setActiveSearchProvider] = useState<string | undefined>(undefined)
  const [searchBusy, setSearchBusy] = useState<'idle' | 'saving' | 'testing'>('idle')
  const [searchNotice, setSearchNotice] = useState<string | undefined>(undefined)
  const [searchError, setSearchError] = useState<string | undefined>(undefined)
  /**
   * Set the moment the user touches either credential field. The first read
   * and any in-flight warm-up then leave those fields alone, so a slow load
   * cannot overwrite characters typed while it was still on the wire.
   */
  const credentialsDirty = useRef(false)
  /** 用户开始编辑搜索设置后，阻止慢加载回写覆盖表单。 */
  const searchDirty = useRef(false)

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
      setHasWebKey(settings.hasWebKey === true)
      setEnabled(settings.enabledModels)
      setShowComposerIcon(settings.showComposerIcon !== false)
      if (!searchDirty.current) {
        const mode = settings.searchMode === 'model' ? 'model' : 'mcp'
        const model = settings.searchModel ?? ''
        setSearchMode(mode)
        setSearchModel(model)
        setSearchCustomModel(false)
      }
      setSearchActive(settings.searchActive === true)
      setSearchRegistered(settings.searchRegistered === true)
      setSearchSwitchable(settings.searchSwitchable === true)
      setActiveSearchProvider(settings.activeSearchProvider)
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

  /**
   * Flip the composer icon and persist immediately (one deliberate act, like
   * the model rows' remove). The client half re-reads this setting when its
   * host page remounts, so the change lands without a restart.
   */
  const applyShowComposerIcon = (show: boolean): void => {
    setShowComposerIcon(show)
    setIconStatus('saving')
    setIconError(undefined)
    saveShowComposerIcon(show).then(
      () => setIconStatus('saved'),
      (cause: unknown) => {
        setIconStatus('error')
        setIconError(cause instanceof Error ? cause.message : String(cause))
        // The stored value did not move; read the truth back.
        setShowComposerIcon((previous) => !previous)
      },
    )
  }

  /** Save the Web Key alone; the bare save button remains for URL/API key. */
  const applyWebKey = (): void => {
    if (webKey.trim() === '') return
    setWebKeyStatus('saving')
    setWebKeyError(undefined)
    saveWebKey(webKey.trim()).then(
      (saved) => {
        setHasWebKey(saved.hasWebKey === true)
        setWebKey('')
        setWebKeyStatus('saved')
      },
      (cause: unknown) => {
        setWebKeyStatus('error')
        setWebKeyError(cause instanceof Error ? cause.message : String(cause))
      },
    )
  }

  /** 将服务端返回的最新搜索绑定状态同步到本地 state。 */
  const syncSearchState = (saved: MagpieSettingsView): void => {
    const mode = saved.searchMode === 'model' ? 'model' : 'mcp'
    const model = saved.searchModel ?? ''
    setSearchMode(mode)
    setSearchModel(model)
    setSearchActive(saved.searchActive === true)
    setSearchRegistered(saved.searchRegistered === true)
    setSearchSwitchable(saved.searchSwitchable === true)
    setActiveSearchProvider(saved.activeSearchProvider)
  }

  /** 切换 DSH 的 `web.searchProvider` 开关；开启时顺带提交当前选中的模式与模型。 */
  const toggleSearchActive = (nextActive: boolean): void => {
    setSearchBusy('saving')
    setSearchError(undefined)
    setSearchNotice(undefined)
    const payload = nextActive
      ? { searchMode, searchModel: searchModel.trim(), searchActive: true }
      : { searchActive: false }
    saveSearchSettings(payload).then(
      (saved) => {
        searchDirty.current = false
        syncSearchState(saved)
        setSearchNotice(text(nextActive ? 'webSearchSwitchedOn' : 'webSearchSwitchedOff'))
      },
      (cause: unknown) => {
        setSearchError(text('webSearchFailed', { message: cause instanceof Error ? cause.message : String(cause) }))
      },
    ).finally(() => {
      setSearchBusy('idle')
    })
  }

  /** 单独保存网页搜索模式与模型。 */
  const commitSearchSettings = (): void => {
    setSearchBusy('saving')
    setSearchError(undefined)
    setSearchNotice(undefined)
    saveSearchSettings({ searchMode, searchModel: searchModel.trim() }).then(
      (saved) => {
        searchDirty.current = false
        syncSearchState(saved)
        setSearchNotice(text('webSearchSaved'))
      },
      (cause: unknown) => {
        setSearchError(text('webSearchFailed', { message: cause instanceof Error ? cause.message : String(cause) }))
      },
    ).finally(() => {
      setSearchBusy('idle')
    })
  }

  /** 使用当前表单（或已保存）凭据与搜索配置执行一次测试搜索。 */
  const testSearch = (): void => {
    setSearchBusy('testing')
    setSearchError(undefined)
    setSearchNotice(undefined)
    void (async () => {
      try {
        const result = (await request('/api/magpie-search-test', 'POST', {
          baseUrl,
          ...(apiKey.trim() === '' ? {} : { apiKey }),
          searchMode,
          searchModel: searchModel.trim(),
        })) as { count: number; hasContent?: boolean }
        setSearchNotice(
          result.count === 0 && result.hasContent === true
            ? text('webSearchTestOkContent')
            : text('webSearchTestOk', { count: result.count }),
        )
      } catch (cause: unknown) {
        setSearchError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        setSearchBusy('idle')
      }
    })()
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
      setHasWebKey(saved.hasWebKey)
      setSearchActive(saved.searchActive === true)
      setSearchRegistered(saved.searchRegistered === true)
      setSearchSwitchable(saved.searchSwitchable === true)
      setActiveSearchProvider(saved.activeSearchProvider)
      // Never keep typed secrets in component state after they are stored.
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
  const searchWorking = searchBusy !== 'idle'
  const searchNeedsModel = searchMode === 'model' && searchModel.trim() === ''
  const searchReadyToEnable = hasApiKey && baseUrl.trim() !== '' && !searchNeedsModel
  const knownSearchModel = searchModel !== '' && models.some((row) => row.id === searchModel)
  const showCustomModelInput = searchCustomModel || (searchModel !== '' && !knownSearchModel)
  const modelSelectValue = showCustomModelInput ? CUSTOM_SEARCH_MODEL : searchModel
  const searchToggleHint = !searchRegistered
    ? text('webSearchUnavailable')
    : !searchSwitchable
      ? text('webSearchManualSwitchHint')
      : searchActive
        ? text('webSearchActiveHint')
        : !hasApiKey || baseUrl.trim() === ''
          ? text('webSearchNeedsCredentials')
          : searchNeedsModel
            ? text('webSearchNeedsModel')
            : activeSearchProvider !== undefined
              ? text('webSearchOtherProviderHint', { provider: activeSearchProvider })
              : text('webSearchInactiveHint')

  /**
   * 标题右侧的一句话状态：收缩时也能看出该区块是否已经生效。首次读取完成前
   * 不显示，否则初始的 `false` 会先闪一下「不可用」。
   */
  const searchStatus: { text: string; on?: boolean } | undefined = !loaded
    ? undefined
    : !searchRegistered
      ? { text: text('statusUnavailable') }
      : searchActive
        ? { text: text('statusOn'), on: true }
        : { text: text('statusOff') }
  /** 界面增强的主体是输入框路由图标；Web Key 未保存时整块不可用。 */
  const enhancementsStatus: { text: string; on?: boolean } | undefined = !loaded
    ? undefined
    : !hasWebKey
      ? { text: text('statusUnset') }
      : showComposerIcon
        ? { text: text('statusOn'), on: true }
        : { text: text('statusOff') }

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

      <CollapsibleCard
        title={text('webSearch')}
        status={searchStatus?.text}
        statusOn={searchStatus?.on}
        open={searchOpen}
        onToggle={() => setSearchOpen((open) => !open)}
      >
        <p style={css.hint}>{text('webSearchIntro')}</p>
        <label style={css.switchRow}>
          <input
            type="checkbox"
            style={css.switchBox}
            checked={searchActive}
            disabled={!loaded || working || searchWorking || !searchRegistered || !searchSwitchable || (!searchActive && !searchReadyToEnable)}
            onChange={(event: { currentTarget: { checked: boolean } }) => toggleSearchActive(event.currentTarget.checked)}
          />
          <span style={css.switchText}>
            <span style={css.switchLabel}>{text('webSearchToggle')}</span>
            <span style={css.switchHint}>{searchToggleHint}</span>
          </span>
        </label>
        <div style={css.field}>
          <span style={css.label}>{text('webSearchMode')}</span>
          <select
            style={css.select}
            value={searchMode}
            disabled={!loaded || working || searchWorking}
            onChange={(event: { currentTarget: { value: string } }) => {
              searchDirty.current = true
              setSearchError(undefined)
              setSearchNotice(undefined)
              setSearchMode(event.currentTarget.value === 'model' ? 'model' : 'mcp')
            }}
          >
            <option value="mcp">{text('webSearchModeMcp')}</option>
            <option value="model">{text('webSearchModeModel')}</option>
          </select>
          <p style={css.hint}>
            {searchMode === 'mcp'
              ? text('webSearchModeMcpHint')
              : text('webSearchModeModelHint', { baseUrl: baseUrl.trim().replace(/\/+$/, '') || 'http://127.0.0.1:3425/v1' })}
          </p>
        </div>
        {searchMode === 'model' ? (
          <div style={css.field}>
            <span style={css.label}>{text('webSearchModel')}</span>
            <select
              style={css.select}
              value={modelSelectValue}
              disabled={!loaded || working || searchWorking}
              onChange={(event: { currentTarget: { value: string } }) => {
                const picked = event.currentTarget.value
                searchDirty.current = true
                setSearchError(undefined)
                setSearchNotice(undefined)
                if (picked === CUSTOM_SEARCH_MODEL) {
                  setSearchCustomModel(true)
                  return
                }
                setSearchCustomModel(false)
                setSearchModel(picked)
              }}
            >
              <option value="">{text('webSearchModelPlaceholder')}</option>
              {models.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.displayName}
                </option>
              ))}
              <option value={CUSTOM_SEARCH_MODEL}>{text('webSearchModelCustomOption')}</option>
            </select>
            {showCustomModelInput ? (
              <Input
                value={searchModel}
                placeholder={text('webSearchModelCustomPlaceholder')}
                disabled={!loaded || working || searchWorking}
                onChange={(event: { currentTarget: { value: string } }) => {
                  searchDirty.current = true
                  setSearchError(undefined)
                  setSearchNotice(undefined)
                  setSearchModel(event.currentTarget.value)
                }}
              />
            ) : null}
          </div>
        ) : null}
        <div style={css.row}>
          <Button
            variant="outline"
            disabled={!loaded || working || searchWorking || searchNeedsModel}
            onClick={() => commitSearchSettings()}
          >
            {searchBusy === 'saving' ? text('saving') : text('webSearchSave')}
          </Button>
          <Button
            variant="outline"
            disabled={!loaded || working || searchWorking || incomplete || searchNeedsModel}
            onClick={() => testSearch()}
          >
            {searchBusy === 'testing' ? text('webSearchTesting') : text('webSearchTest')}
          </Button>
        </div>
        {searchError === undefined ? null : (
          <p role="alert" style={css.error}>
            {searchError}
          </p>
        )}
        {searchNotice === undefined ? null : <p style={css.ok}>{searchNotice}</p>}
      </CollapsibleCard>

      <CollapsibleCard
        title={text('enhancements')}
        status={enhancementsStatus?.text}
        statusOn={enhancementsStatus?.on}
        open={enhancementsOpen}
        onToggle={() => setEnhancementsOpen((open) => !open)}
      >
        <div style={css.field}>
          <span style={css.label}>{text('webKey')}</span>
          <Input type="password" value={webKey} placeholder={text(hasWebKey ? 'webKeySavedPlaceholder' : 'webKeyPlaceholder')} disabled={working || webKeyStatus === 'saving'} onChange={(event: { currentTarget: { value: string } }) => setWebKey(event.currentTarget.value)} />
          <p style={css.hint}>{text('webKeyHint')}</p>
        </div>
        <label style={css.switchRow}>
          <input
            type="checkbox"
            style={css.switchBox}
            checked={showComposerIcon}
            disabled={iconStatus === 'saving' || !hasWebKey}
            onChange={(event: { currentTarget: { checked: boolean } }) => applyShowComposerIcon(event.currentTarget.checked)}
          />
          <span style={css.switchText}>
            <span style={css.switchLabel}>{text('composerIcon')}</span>
            <span style={css.switchHint}>{hasWebKey ? text('composerIconHint') : text('composerIconNeedsWebKey')}</span>
          </span>
        </label>
        <div style={css.row}>
          <Button variant="outline" disabled={working || webKeyStatus === 'saving' || webKey.trim() === ''} onClick={() => applyWebKey()}>
            {webKeyStatus === 'saving' ? text('saving') : text('save')}
          </Button>
          {webKeyStatus === 'saved' ? <span style={css.ok}>{text('webKeySaved')}</span> : null}
        </div>
        {iconStatus === 'saved' ? <p style={css.ok}>{text('composerIconSaved')}</p> : null}
        {webKeyError === undefined ? null : (
          <p role="alert" style={css.error}>
            {text('composerIconFailed', { message: webKeyError })}
          </p>
        )}
        {iconError === undefined ? null : (
          <p role="alert" style={css.error}>
            {text('composerIconFailed', { message: iconError })}
          </p>
        )}
      </CollapsibleCard>

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
