/**
 * Pure decisions behind the model-list editor.
 *
 * Kept out of the `.tsx` component so `node --test` can import them directly
 * (Node runs `.ts` but not `.tsx`), which is where the visibility rules that
 * the dialog actually depends on get their coverage.
 */

/** One model row as the models route reports it. */
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

/** One discovered candidate: a {@link ModelRow} without this plugin's own visibility flag. */
export type CandidateRow = Omit<ModelRow, 'hidden'>

/**
 * Which candidates a fresh fetch should start checked.
 *
 * This plugin's list decides *visibility*, not membership, so the dialog
 * answers "which models should the picker offer" and every candidate the
 * picker already offers starts ticked. The upstream pi-ai editor inverts this
 * (known rows start unchecked) because there a row is an explicit catalog
 * entry — adopting there would rewrite the user's own capacities.
 * @param candidates - the models the gateway just listed.
 * @param visibleIds - ids the picker currently offers.
 * @returns the ids that should start checked.
 */
export function initialPicked(candidates: readonly CandidateRow[], visibleIds: ReadonlySet<string>): Set<string> {
  return new Set(candidates.filter((candidate) => visibleIds.has(candidate.id)).map((candidate) => candidate.id))
}

/**
 * The hidden set an adopted selection produces.
 *
 * Only the offered candidates are considered: the saved hidden set is pruned
 * to the live directory on write, so an id the gateway did not just offer is
 * not something this save should carry. Leaving one in would resurrect a
 * stale entry the settings page can no longer show or clear.
 * @param candidates - the candidates the dialog offered.
 * @param picked - the candidate ids the user left checked.
 * @returns the hidden ids to save.
 */
export function hiddenAfterAdopt(candidates: readonly CandidateRow[], picked: ReadonlySet<string>): string[] {
  return candidates.filter((candidate) => !picked.has(candidate.id)).map((candidate) => candidate.id)
}

/**
 * Hide one model. The list shows only enabled models, so its delete button is
 * this: the row leaves the list and rejoins via the fetch dialog.
 * @param hidden - the hidden set before the action.
 * @param id - the model to hide.
 * @returns the hidden set after the action.
 */
export function hideOne(hidden: readonly string[], id: string): string[] {
  return hidden.includes(id) ? [...hidden] : [...hidden, id]
}

/**
 * Toggle every visible candidate, used by the dialog's select-all action.
 *
 * Clearing removes only what the current query shows, so a filtered
 * select-all followed by a filtered clear does not silently un-pick matches
 * the query was hiding.
 * @param current - the checked set before the action.
 * @param visible - the candidates the query currently shows.
 * @returns the checked set after the action.
 */
export function toggleAllPicked(current: ReadonlySet<string>, visible: readonly CandidateRow[]): Set<string> {
  const next = new Set(current)
  if (visible.length > 0 && visible.every((candidate) => current.has(candidate.id))) {
    for (const candidate of visible) next.delete(candidate.id)
    return next
  }
  for (const candidate of visible) next.add(candidate.id)
  return next
}
