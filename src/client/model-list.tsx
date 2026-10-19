import { useMemo, useState } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { text } from './i18n.ts'
import {
  disableOne,
  enabledAfterAdopt,
  initialPicked,
  toggleAllPicked,
  toggleAllWouldClear,
  type CandidateRow,
  type ModelRow,
} from './model-visibility.ts'
/**
 * The model list of the Magpie gateway, plus the action that asks the gateway
 * what it serves.
 *
 * The list is the **allowlist**, matching DSH's own Models settings: every row is
 * a model the picker offers, and a model absent from the list is not offered.
 * Removing a row is therefore a real removal, not a visibility toggle, and a
 * model the gateway re-lists later stays out until it is added again.
 *
 * "Restore defaults" drops the stored list entirely, which means "inherit the
 * gateway directory" — the same meaning an absent list has in the built-in
 * editor. Without that action an empty allowlist would be a one-way door.
 *
 * The dialog offers the gateway's live directory; ticking rows and applying
 * replaces the allowlist with exactly those rows.
 *
 * Fetching asks the endpoint **the form currently shows** — including a key
 * typed but not yet saved — so filling in a gateway is one pass instead of
 * save-then-return. The reply is candidates the user picks from, never
 * configuration written behind them.
 */

export type { CandidateRow, ModelRow }

/** Props of {@link ModelListEditor}. */
export interface ModelListEditorProps {
  /** One row per model the gateway directory holds, each flagged with its allowlist state. */
  models: readonly ModelRow[]
  /**
   * The stored allowlist: `undefined` = inherit the whole directory, otherwise
   * exactly these ids. Three-state, so it cannot collapse to a plain array.
   */
  enabled: readonly string[] | undefined
  /**
   * Ask the gateway for its current catalog. Rejects with a display-ready
   * message; the editor owns showing it.
   */
  onFetch: () => Promise<readonly CandidateRow[]>
  /**
   * Re-read the gateway's directory into the list. The dialog asks the endpoint
   * the form shows — which may be newer than the one the list was read from —
   * so after a successful fetch the list is re-read and a model the user ticks
   * has a row to appear in.
   */
  onRefresh: () => Promise<void>
  /** Replace the allowlist (`undefined` = restore inheritance). */
  onEnabledChange: (enabled: string[] | undefined) => void
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
  // A row the live gateway does not list is informational, not a capability the
  // user is choosing: read it as dimmer than the capability chips.
  chipStale: { color: 'var(--dsw-alias-label-tertiary)', borderStyle: 'dashed' },
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
 * The chip that says where a row is coming from, when that is not the live
 * gateway: with an unreachable gateway the rows are the built-in snapshot, and
 * the difference has to be readable.
 */
function sourceChip(row: ModelRow): { key: string; label: string } | undefined {
  if (row.source === 'static') return { key: 'source', label: text('sourceStatic') }
  if (row.source === 'none') return { key: 'source', label: text('sourceStale') }
  return undefined
}

/**
 * Filter rows by the card-wide query, against either section.
 * @param rows - the section's rows.
 * @param query - the filter text as typed.
 * @returns the rows whose id or display name matches.
 */
function filterRows(rows: readonly ModelRow[], query: string): readonly ModelRow[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return rows
  return rows.filter((row) => row.id.toLowerCase().includes(needle) || row.displayName.toLowerCase().includes(needle))
}

/**
 * Render the model list with its fetch action.
 * @param props - the drafted rows, the current visibility set, and the fetch/toggle callbacks.
 * @returns the model-list editor.
 */
export function ModelListEditor(props: ModelListEditorProps): unknown {
  const { models, enabled, onFetch, onRefresh, onEnabledChange, disabled, fetchable, status } = props
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  /** Fetch/discovery failure — distinct from the autosave failure in `props.failure`. */
  const [fetchFailure, setFetchFailure] = useState<string | undefined>(undefined)
  const [candidates, setCandidates] = useState<readonly CandidateRow[] | undefined>(undefined)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [candidateQuery, setCandidateQuery] = useState('')

  // The allowlist is the source of truth for membership; `models` only supplies
  // the rows (id + capabilities) the directory currently knows about.
  //
  // `enabled` is the *drafted* list, so it has to win over `row.enabled`, which
  // is the server's copy of the same fact as of the last read. Rendering from
  // the row made a delete invisible until the next refresh re-read the list.
  const inheriting = enabled === undefined
  const offeredIds = useMemo(
    () => (enabled === undefined ? new Set(models.filter((row) => row.enabled).map((row) => row.id)) : new Set(enabled)),
    [models, enabled],
  )
  const enabledRows = useMemo(() => models.filter((row) => offeredIds.has(row.id)), [models, offeredIds])
  const visibleRows = useMemo(() => filterRows(enabledRows, filter), [enabledRows, filter])

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
  const wouldClear = useMemo(() => toggleAllWouldClear(visibleCandidates, picked), [visibleCandidates, picked])

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
      // The dialog asked the endpoint the form shows, so the list may be
      // holding an older directory. Re-read it before the user adopts: a model
      // they tick here needs a row to land in.
      await onRefresh().catch(() => {})
      setCandidateQuery('')
      setCandidates(found)
      setPicked(initialPicked(found, offeredIds))
    } catch (cause) {
      setFetchFailure(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const adoptPicked = (): void => {
    if (candidates === undefined) return
    // The selection replaces the allowlist: only what is ticked here is offered
    // afterwards. A model the gateway stopped listing is therefore dropped from
    // the list, and cannot return until it is added again.
    onEnabledChange(enabledAfterAdopt(candidates, picked))
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

      <p style={css.meta}>
        {inheriting ? text('modelsInherited') : text('modelsCustomized', { count: enabledRows.length })}
        {inheriting || disabled ? null : (
          <button
            type="button"
            style={css.linkButton}
            disabled={disabled}
            onClick={() => onEnabledChange(undefined)}
          >
            {text('resetModels')}
          </button>
        )}
      </p>

      {enabledRows.length === 0 ? (
        <p style={css.empty}>{models.length === 0 ? text('fetchEmpty') : text('allRemoved')}</p>
      ) : null}
      <div style={css.list}>
        {visibleRows.map((row) => {
          const source = sourceChip(row)
          return (
            <div key={row.id} style={css.item}>
              <span style={css.itemMain}>
                <span style={css.itemId}>{row.id}</span>
                <span style={css.chips}>
                  {chipsFor(row).map((chip) => (
                    <span key={chip.key} style={css.chip}>
                      {chip.label}
                    </span>
                  ))}
                  {source === undefined ? null : (
                    <span key={source.key} style={{ ...css.chip, ...css.chipStale }}>
                      {source.label}
                    </span>
                  )}
                </span>
              </span>
              <button
                type="button"
                style={{ ...css.removeButton, ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}) }}
                disabled={disabled}
                title={text('removeHint')}
                aria-label={`${text('remove')} ${row.id}`}
                onClick={() => onEnabledChange(disableOne(enabled ?? [], row.id))}
              >
                {text('remove')}
              </button>
            </div>
          )
        })}
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
            {wouldClear ? text('fetchDeselectAll') : text('fetchSelectAll')}
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
