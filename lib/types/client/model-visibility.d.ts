/**
 * Pure decisions behind the model-list editor.
 *
 * Kept out of the `.tsx` component so `node --test` can import them directly
 * (Node runs `.ts` but not `.tsx`), which is where the visibility rules that
 * the dialog actually depends on get their coverage.
 *
 * The model here is an **allowlist**, matching DSH's own Models settings: the
 * picker offers the gateway directory ∩ the stored list. Absent means "inherit
 * the whole directory", `[]` means "offer nothing". The earlier blacklist
 * (`hiddenModels`) had to be defended against every directory change — a lane
 * that dropped a model and later re-listed it handed the model back. An
 * allowlist has no such failure mode: membership is what the user declared, and
 * a directory change can only remove rows, never grant them.
 */
/** Where the picker is getting one model from right now. */
export type ModelSource = 'gateway' | 'static' | 'none';
/** One model row as the models route reports it. */
export interface ModelRow {
    id: string;
    displayName: string;
    contextWindow?: number;
    maxTokens?: number;
    image: boolean;
    responsesOnly: boolean;
    reasoning: boolean;
    efforts: string[];
    /** Whether the allowlist currently offers this model in the picker. */
    enabled: boolean;
    /**
     * `'gateway'` = the live directory lists it now; `'static'` = only the
     * built-in snapshot knows it; `'none'` = nothing lists it. The list labels
     * the snapshot case so a row is not mistaken for a model the gateway serves.
     */
    source?: ModelSource;
}
/** One discovered candidate: a {@link ModelRow} without this plugin's own allowlist flag. */
export type CandidateRow = Omit<ModelRow, 'enabled'>;
/**
 * Which candidates a fresh fetch should start checked.
 *
 * The dialog answers "which models should the picker offer", so a candidate the
 * picker already offers starts ticked. A candidate it does not offer starts
 * unchecked — deliberately the inverse of the upstream pi-ai editor, where a
 * known row starts unchecked because there a row is an explicit catalog entry
 * the user hand-wrote; here the stored list *is* the membership, and a fetch
 * alone must never add to it behind the user's back.
 * @param candidates - the models the gateway just listed.
 * @param offeredIds - ids the picker currently offers.
 * @returns the ids that should start checked.
 */
export declare function initialPicked(candidates: readonly CandidateRow[], offeredIds: ReadonlySet<string>): Set<string>;
/**
 * The allowlist an adopted selection produces: exactly the ticked candidates.
 *
 * The dialog shows the gateway's live directory, so this list is a statement
 * about *those* models. Two consequences, both intended:
 *
 * - A model the gateway stopped listing leaves the allowlist by simply not
 *   being a candidate. It cannot come back on its own, because only a fetch can
 *   add an id.
 * - A model outside this round's candidates that the user had allowed is
 *   dropped too. That is what "Apply selection" means: the selection replaces
 *   the set. Keeping stale ids would grow a list that can never take effect and
 *   that the dialog could never show again.
 * @param candidates - the candidates the dialog offered.
 * @param picked - the candidate ids the user left checked.
 * @returns the ids to store as `enabledModels`.
 */
export declare function enabledAfterAdopt(candidates: readonly CandidateRow[], picked: ReadonlySet<string>): string[];
/**
 * Add one model to the allowlist (the list's "add" action).
 *
 * Order is not meaningful, but keeping it stable avoids needless rewrites and
 * makes the stored document readable.
 * @param enabled - the allowlist before the action.
 * @param id - the model to allow.
 * @returns the allowlist after the action.
 */
export declare function enableOne(enabled: readonly string[], id: string): string[];
/**
 * Remove one model from the allowlist (the list's "remove" action).
 * @param enabled - the allowlist before the action.
 * @param id - the model to drop.
 * @returns the allowlist after the action.
 */
export declare function disableOne(enabled: readonly string[], id: string): string[];
/**
 * Whether the dialog's select-all button should act as *clear* rather than
 * *select* — the same test {@link toggleAllPicked} uses, so a label never
 * promises one action and performs the other.
 * @param visible - the candidates the query currently shows.
 * @param picked - the candidate ids currently checked.
 * @returns true when the action has nothing left to add.
 */
export declare function toggleAllWouldClear(visible: readonly CandidateRow[], picked: ReadonlySet<string>): boolean;
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
export declare function toggleAllPicked(current: ReadonlySet<string>, visible: readonly CandidateRow[]): Set<string>;
