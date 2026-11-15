/**
 * Types for the release-notes script: `sectionFor` is the only export a
 * consumer needs (the CLI body runs only when executed directly).
 *
 * `sectionFor` returns the one `## v<version>` section of a changelog
 * document, or null when that version has no (non-empty) section.
 */
export function sectionFor(changelogText: string, version: string): string | null
