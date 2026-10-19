import { type CandidateRow, type ModelRow } from './model-visibility.ts';
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
export type { CandidateRow, ModelRow };
/** Props of {@link ModelListEditor}. */
export interface ModelListEditorProps {
    /** One row per model the gateway directory holds, each flagged with its allowlist state. */
    models: readonly ModelRow[];
    /**
     * The stored allowlist: `undefined` = inherit the whole directory, otherwise
     * exactly these ids. Three-state, so it cannot collapse to a plain array.
     */
    enabled: readonly string[] | undefined;
    /**
     * Ask the gateway for its current catalog. Rejects with a display-ready
     * message; the editor owns showing it.
     */
    onFetch: () => Promise<readonly CandidateRow[]>;
    /**
     * Re-read the gateway's directory into the list. The dialog asks the endpoint
     * the form shows — which may be newer than the one the list was read from —
     * so after a successful fetch the list is re-read and a model the user ticks
     * has a row to appear in.
     */
    onRefresh: () => Promise<void>;
    /** Replace the allowlist (`undefined` = restore inheritance). */
    onEnabledChange: (enabled: string[] | undefined) => void;
    /** Disable every control (a pending save/probe). */
    disabled: boolean;
    /** Whether the connection fields are filled in enough to ask the gateway. */
    fetchable: boolean;
    /**
     * Autosave state for the list itself. Shown inline on this card, not on the
     * connection card above: the user's eye is here when they remove a row, and
     * a write failure must land where the change was made.
     */
    status: 'idle' | 'saving' | 'saved' | 'error';
    /** Autosave failure message, when {@link status} is `error`. */
    failure?: string | undefined;
}
/**
 * Render the model list with its fetch action.
 * @param props - the drafted rows, the current visibility set, and the fetch/toggle callbacks.
 * @returns the model-list editor.
 */
export declare function ModelListEditor(props: ModelListEditorProps): unknown;
