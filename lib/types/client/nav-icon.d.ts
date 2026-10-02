/**
 * The Magpie glyph in the settings nav rail.
 *
 * `settings.section` projects only `id` / `order` / `label` (see
 * `SettingsRoot` in `dsh-client-ui-settings-general`), and its nav glyph is a
 * hardcoded `navIcon(id)` map — `account`, `models`, `agent-presets`,
 * `plugins`, `archived-sessions`, then a fallback gear for every other id.
 * A registrant cannot supply an icon, so this plugin's row would draw the
 * fallback gear.
 *
 * Until that slot grows an `icon` field, the row is claimed after the dialog
 * mounts and the gear is swapped for the mark: the same technique
 * `dshmarket` and `dsh-better-sidebar` use. Scope is deliberately narrow —
 * only the row whose visible text equals this plugin's own localized section
 * label is marked, the marker and the stylesheet belong to a `ctx.effect` so
 * they are removed with the fiber, and a locale switch re-claims the row
 * through the MutationObserver so the label and the glyph never disagree.
 *
 * Delete this module (and its call in `client/index.ts`) the day
 * `settings.section` grows an `icon` field.
 */
/**
 * Whether a nav row is this plugin's own.
 *
 * Pure, and the only decision this feature makes: the row whose visible text
 * is the section label the shell is currently projecting. An empty label
 * matches nothing — a locale that has not resolved yet must not mark the
 * whole nav.
 * @param rowText - the row's visible text.
 * @param wantedLabel - this plugin's current section label.
 * @returns whether the row belongs to this plugin.
 */
export declare function isOwnNavRow(rowText: unknown, wantedLabel: unknown): boolean;
/** Minimal surface this feature needs from the client context. */
export interface NavIconContext {
    effect(fn: () => () => void, label?: string): unknown;
}
/**
 * Install the nav glyph.
 * @param ctx - client context, for effect ownership.
 * @param resolveLabel - this plugin's current section label (the same thunk the
 *   `settings.section` registration passes), re-read on every sync so a locale
 *   switch is picked up without re-registering.
 */
export declare function installSettingsNavIcon(ctx: NavIconContext, resolveLabel: () => string): void;
