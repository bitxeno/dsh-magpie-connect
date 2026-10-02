/**
 * Serialize one value's writes so rapid edits cannot race or lose the last one.
 *
 * The model list autosaves: every remove and every dialog adoption posts the
 * hidden set. Clicking remove three times in a second must not fire three
 * overlapping requests whose responses land out of order — the last state the
 * user saw has to be the last state that reaches the disk.
 *
 * The policy is deliberately "one in flight, keep only the newest pending":
 * intermediate states are not worth uploading, and the final one always is.
 * @param write - performs one write for a value; its rejection is reported.
 * @returns a scheduler with `push`, `idle`, and a `status` reader.
 */
export declare function createWriteQueue<T>(write: (value: T) => Promise<void>, onSettled?: (outcome: {
    ok: true;
} | {
    ok: false;
    error: unknown;
}) => void): {
    push: (value: T) => void;
    /** Resolves when nothing is in flight and nothing is queued. */
    idle: () => Promise<void>;
    /** Whether a write is running or waiting. */
    pending: () => boolean;
};
