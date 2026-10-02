import { type CandidateRow, type ModelRow } from './model-visibility.ts';
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
export type { CandidateRow, ModelRow };
/** Props of {@link ModelListEditor}. */
export interface ModelListEditorProps {
    /** The rows as currently drafted (the gateway's directory). */
    models: readonly ModelRow[];
    /** The ids the picker currently offers (the drafted rows minus the hidden set). */
    visibleIds: ReadonlySet<string>;
    /**
     * Ask the gateway for its current catalog. Rejects with a display-ready
     * message; the editor owns showing it.
     */
    onFetch: () => Promise<readonly CandidateRow[]>;
    /** Hide one model (the list's delete action). */
    onRemove: (id: string) => void;
    /** Replace the whole hidden set (the dialog's adopt action). */
    onHiddenChange: (hidden: string[]) => void;
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
