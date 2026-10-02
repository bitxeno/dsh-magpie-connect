import { useMemo, useState } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { text } from './i18n.ts'
import {
  hiddenAfterAdopt,
  initialPicked,
  toggleAllPicked,
  type CandidateRow,
  type ModelRow,
} from './model-visibility.ts'
/**
 * The model list of the Magpie gateway, plus the action that asks the gateway
 * what it serves.
 *
 * The list shows only *enabled* models: this plugin's picker is the gateway's
 * whole catalog minus a hidden set, so a hidden row would be a row that is
 * invisible everywhere it matters. Hidden models live in the fetch dialog
 * instead, which is the one surface that can both show and re-enable them.
 * That is also why a row's control is a delete button rather than a
 * checkbox — with nothing hidden on screen, unticking and deleting are the
 * same act, and only deleting reads correctly.
 *
 * Fetching asks the endpoint **the form currently shows** — including a key
 * typed but not yet saved — so filling in a gateway is one pass instead of
 * save-then-return. The reply is candidates the user picks from, never
 * configuration written behind them.
 */

export type { CandidateRow, ModelRow }

/** Props of {@link ModelListEditor}. */
export interface ModelListEditorProps {
  /** The rows as currently drafted (the gateway's directory). */
  models: readonly ModelRow[]
  /** The ids the picker currently offers (the drafted rows minus the hidden set). */
  visibleIds: ReadonlySet<string>
  /**
   * Ask the gateway for its current catalog. Rejects with a display-ready
   * message; the editor owns showing it.
   */
  onFetch: () => Promise<readonly CandidateRow[]>
  /** Hide one model (the list's delete action). */
  onRemove: (id: string) => void
  /** Replace the whole hidden set (the dialog's adopt action). */
  onHiddenChange: (hidden: string[]) => void
  /** Disable every control (a pending save/probe). */
  disabled: boolean
  /** Whether the connection fields are filled in enough to ask the gateway. */
  fetchable: boolean
  /**
   * Autosave state for the list itself. Shown inline on this card, not on the
   * connection card above: the user's eye is here when they remove a row, and
   * a write failure must land where the change was made.
   */
  status: 'idle' | 'saving' | 'saved' | 'error'
  /** Autosave failure message, when {@link status} is `error`. */
  failure?: string | undefined
}

const css: Record<string, Record<string, string | number>> = {
  card: { display: 'flex', flexDirection: 'column', gap: 14, padding: 18, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12, background: 'var(--dsw-alias-bg-layer-1)' },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heading: { display: 'flex', flexDirection: 'column', gap: 2 },
  cardTitle: { margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
  meta: { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
  linkButton: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-brand-primary)', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, fontSize: 12, lineHeight: '18px', flex: 'none' },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  hint: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' },
  error: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-error, var(--dsw-alias-state-danger-label))' },
  ok: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-state-success-label, var(--dsw-alias-label-primary))' },
  list: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflowY: 'auto', paddingRight: 4 },
  empty: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)', textAlign: 'center', padding: '12px 0' },
  item: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'transparent' },
  removeButton: { border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', padding: '3px 10px', borderRadius: 6, fontSize: 12, lineHeight: '18px', flex: 'none' },
  itemMain: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  itemId: { fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)', overflowWrap: 'anywhere', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { fontSize: 11, lineHeight: '18px', padding: '0 7px', borderRadius: 999, border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'nowrap' },
  candidateToolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  candidateSearch: { flex: 1, minWidth: 0 },
  candidateList: { display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, margin: 0, padding: 0, listStyle: 'none', overflowY: 'auto' },
  candidate: { borderRadius: 8 },
  // Mirrors the list's `item`: checkbox and a two-line text column (id, then
  // chips) so a candidate reads the same as an enabled row.
  candidateLabel: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer' },
  candidateCheckbox: { width: 15, height: 15, accentColor: 'var(--dsw-alias-brand-primary)', flex: 'none', cursor: 'pointer' },
  candidateText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  candidateId: { fontSize: 13, lineHeight: '20px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)', overflowWrap: 'anywhere', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  candidateEmpty: { margin: '24px 0', textAlign: 'center', fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary)' },
}

/** Format a token count the way the chips read it. */
function formatWindow(value?: number): string {
  if (value === undefined) return ''
  if (value >= 1000000) return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return String(value)
}

/** The capability chips one row shows, shared by the list and the candidate picker. */
function chipsFor(row: CandidateRow): Array<{ key: string; label: string }> {
  const chips: Array<{ key: string; label: string }> = []
  if (row.image) chips.push({ key: 'image', label: text('image') })
  if (row.responsesOnly) chips.push({ key: 'responses', label: text('responses') })
  if (row.reasoning) chips.push({ key: 'reasoning', label: `${text('reasoning')} · ${row.efforts.length}` })
  if (row.contextWindow !== undefined) chips.push({ key: 'context', label: text('context', { window: formatWindow(row.contextWindow) }) })
  return chips
}

/**
 * Render the model list with its fetch action.
 * @param props - the drafted rows, the current visibility set, and the fetch/toggle callbacks.
 * @returns the model-list editor.
 */
export function ModelListEditor(props: ModelListEditorProps): unknown {
  const { models, visibleIds, onFetch, onRemove, onHiddenChange, disabled, fetchable, status } = props
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  /** Fetch/discovery failure — distinct from the autosave failure in `props.failure`. */
  const [fetchFailure, setFetchFailure] = useState<string | undefined>(undefined)
  const [candidates, setCandidates] = useState<readonly CandidateRow[] | undefined>(undefined)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [candidateQuery, setCandidateQuery] = useState('')

  // Only enabled models are listed; hidden ones are the dialog's business.
  const enabledRows = useMemo(() => models.filter((row) => visibleIds.has(row.id)), [models, visibleIds])
  const visibleRows = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (needle === '') return enabledRows
    return enabledRows.filter((row) => row.id.toLowerCase().includes(needle) || row.displayName.toLowerCase().includes(needle))
  }, [enabledRows, filter])

  const togglePicked = (id: string): void => {
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  const visibleCandidates = useMemo(() => {
    const needle = candidateQuery.trim().toLowerCase()
    if (candidates === undefined) return []
    if (needle === '') return candidates
    return candidates.filter(
      (candidate) => candidate.id.toLowerCase().includes(needle) || candidate.displayName.toLowerCase().includes(needle),
    )
  }, [candidates, candidateQuery])
  const allVisiblePicked = visibleCandidates.length > 0 && visibleCandidates.every((candidate) => picked.has(candidate.id))

  const closePicker = (): void => {
    setCandidates(undefined)
    setPicked(new Set())
    setCandidateQuery('')
  }

  const fetchModels = async (): Promise<void> => {
    setBusy(true)
    setFetchFailure(undefined)
    try {
      const found = await onFetch()
      if (found.length === 0) {
        setFetchFailure(text('fetchEmpty'))
        return
      }
      setCandidateQuery('')
      setCandidates(found)
      setPicked(initialPicked(found, visibleIds))
    } catch (cause) {
      setFetchFailure(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const adoptPicked = (): void => {
    if (candidates === undefined) return
    onHiddenChange(hiddenAfterAdopt(candidates, picked))
    closePicker()
  }

  const working = disabled || busy

  return (
    <div style={css.card}>
      <div style={css.head}>
        <div style={css.heading}>
          <h3 style={css.cardTitle}>{text('models')}</h3>
          <p style={css.meta}>{text('enabled', { count: enabledRows.length })}</p>
        </div>
        <button
          type="button"
          style={{ ...css.linkButton, ...(working || !fetchable ? { opacity: 0.5, cursor: 'default' } : {}) }}
          disabled={working || !fetchable}
          title={fetchable ? undefined : text('fetchNeedsConfig')}
          onClick={() => void fetchModels()}
        >
          {busy ? text('fetching') : text('fetchModels')}
        </button>
      </div>

      <p style={css.hint}>{text('saveHint')}</p>

      <Input
        value={filter}
        placeholder={text('search')}
        disabled={disabled}
        onChange={(event: { currentTarget: { value: string } }) => setFilter(event.currentTarget.value)}
      />

      {enabledRows.length === 0 ? <p style={css.empty}>{models.length === 0 ? text('fetchEmpty') : text('allHidden')}</p> : null}
      <div style={css.list}>
        {visibleRows.map((row) => (
          <div key={row.id} style={css.item}>
            <span style={css.itemMain}>
              <span style={css.itemId}>{row.id}</span>
              <span style={css.chips}>
                {chipsFor(row).map((chip) => (
                  <span key={chip.key} style={css.chip}>
                    {chip.label}
                  </span>
                ))}
              </span>
            </span>
            <button
              type="button"
              style={{ ...css.removeButton, ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}) }}
              disabled={disabled}
              title={text('removeHint')}
              aria-label={`${text('remove')} ${row.id}`}
              onClick={() => onRemove(row.id)}
            >
              {text('remove')}
            </button>
          </div>
        ))}
      </div>

      {fetchFailure === undefined ? null : (
        <p role="alert" style={css.error}>
          {fetchFailure}
        </p>
      )}

      {/* Autosave feedback lives on this card: the change was made here, so a
          failure has to be readable without scrolling back up to the form. */}
      {status === 'saving' ? <p style={css.hint}>{text('savingModels')}</p> : null}
      {status === 'saved' ? <p style={css.ok}>{text('modelsSaved')}</p> : null}
      {status === 'error' && props.failure !== undefined ? (
        <p role="alert" style={css.error}>
          {props.failure}
        </p>
      ) : null}

      <Modal
        open={candidates !== undefined}
        onClose={closePicker}
        title={text('fetchTitle')}
        closeLabel={text('close')}
        description={text('fetchDescription')}
        footer={
          <>
            <Button variant="outline" onClick={closePicker}>
              {text('cancel')}
            </Button>
            <Button variant="primary" onClick={adoptPicked}>
              {text('fetchAdopt')}
            </Button>
          </>
        }
      >
        <div style={css.candidateToolbar}>
          <Input
            type="search"
            value={candidateQuery}
            placeholder={text('fetchSearch')}
            aria-label={text('fetchSearch')}
            onChange={(event: { currentTarget: { value: string } }) => setCandidateQuery(event.currentTarget.value)}
            style={css.candidateSearch}
          />
          <Button variant="ghost" size="sm" disabled={visibleCandidates.length === 0} onClick={() => setPicked((current) => toggleAllPicked(current, visibleCandidates))}>
            {allVisiblePicked ? text('fetchDeselectAll') : text('fetchSelectAll')}
          </Button>
        </div>
        {visibleCandidates.length === 0 ? (
          <p style={css.candidateEmpty} role="status">
            {text('fetchNoMatches')}
          </p>
        ) : (
          <ul style={css.candidateList}>
            {visibleCandidates.map((candidate) => (
              <li key={candidate.id} style={css.candidate}>
                <label style={css.candidateLabel}>
                  <input
                    type="checkbox"
                    style={css.candidateCheckbox}
                    checked={picked.has(candidate.id)}
                    onChange={() => togglePicked(candidate.id)}
                  />
                  <span style={css.candidateText}>
                    <span style={css.candidateId} title={candidate.id}>
                      {candidate.id}
                    </span>
                    {/* Second line, mirroring the list's rows: the chips read as
                        metadata under the id rather than competing with it. The
                        gateway's display name is deliberately not shown — it is
                        always present, and for every model this deployment
                        serves it only respells the id. */}
                    <span style={css.chips}>
                      {chipsFor(candidate).map((chip) => (
                        <span key={chip.key} style={css.chip}>
                          {chip.label}
                        </span>
                      ))}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
