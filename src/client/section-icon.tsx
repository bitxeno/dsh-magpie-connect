import { BIRD_PATH, SLOT_GLYPH_MARKER } from './nav-icon.ts'

/**
 * The Magpie mark as real `settings.section.icon` slot content.
 *
 * Newer DSH shells declare a `settings.section.icon` list slot: the shell keeps
 * the nav button and label, and any entry whose registration id equals a
 * section id supplies that row's glyph (otherwise the shell's default gear is
 * used). Registering here is the supported way to give the Magpie section its
 * bird, and it replaces — not accompanies — the fallback gear, so exactly one
 * icon is drawn.
 *
 * Older shells never declare this slot, so the injection simply never runs and
 * the legacy DOM claim in `nav-icon.ts` takes over. The glyph carries
 * {@link SLOT_GLYPH_MARKER} so that fallback knows to stand down here.
 */

/** Owner share the shell supplies to a nav icon. */
export interface SettingsSectionIconOwnerProps {
  /** Requested square edge in pixels. */
  size: number
  /** Whether this section is currently selected. */
  active: boolean
}

/**
 * Render the mark.
 *
 * `fill="currentColor"` makes the bird follow the row's own label colour, so
 * the active/hover states stay consistent without extra styling. The source
 * art is a 44×44 viewBox; scaling to the requested size is exact.
 * @param props - the shell's icon owner share.
 * @returns the SVG glyph.
 */
export function MagpieSectionIcon(props: Partial<SettingsSectionIconOwnerProps>): unknown {
  const size = props.size ?? 16
  return (
    <svg
      {...{ [SLOT_GLYPH_MARKER]: '' }}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path fillRule="evenodd" d={BIRD_PATH} />
    </svg>
  )
}
