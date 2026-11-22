# Notes for coding agents

## Release (tag → publish)

A release is one version-bump commit; everything else is automatic. The flow
is documented here because it spans three files that must move together.

**To cut a release:**

1. Write the release notes first: add a `## v<version>` section at the top of
   [CHANGELOG.md](CHANGELOG.md) (Chinese, hand-written — it becomes the
   GitHub Release body and the plugin market's "what changed" dialog; see
   [scripts/release-notes.mjs](scripts/release-notes.mjs) for the matching
   rules). A version with no section is not an error: the release ships with
   the install snippet alone. Write bullet points **for users**: say what they
   get and why it matters, not how it is implemented — no file names, symbols,
   API paths, `Promise.all`/type/field names, or before/after code talk. Keep
   each item one or two plain sentences; the reader is a plugin user, not the
   diff (see the entries under `## v0.8.0` for the intended granularity).
2. Bump `version` in **both** `package.json` and `dsh.plugin.json` to the same
   value (the workflow fails on a mismatch). A version carrying a `-` (e.g.
   `0.7.0-rc.1`) is tagged as a prerelease and published to npm's `next`
   dist-tag — GitHub's `releases/latest` (and therefore the market's update
   notes) ignores prereleases.
3. If the build bakes the version in (`build.mjs` defines `__PLUGIN_VERSION__`),
   rebuild `lib/` **after** the bump and commit it in the same release commit —
   the committed `lib/` is what npm publishes, so a stale string there ships a
   wrong version.
4. Commit as `chore(release): v<version>` and push to `main`. Only pushes
   touching `package.json`/`dsh.plugin.json` trigger the pipeline
   (.github/workflows/release.yml); `workflow_dispatch` re-runs it in place.

**What the pipeline does** (each step idempotent, so a re-run finishes
whatever a partial failure left):

- `pnpm`-less CI: the committed `lib/` is published as-is; run `pnpm run
  check` locally before the bump, CI does not test.
- changelogithub generates the English conventional-commit detail (kept as a
  commit-range check; GitHub's own "What's Changed" section under the release
  notes carries it to readers — the body itself comes from CHANGELOG.md).
- `scripts/release-notes.mjs` assembles the release body from CHANGELOG.md.
- Creates the annotated tag, the GitHub Release (`--generate-notes`), and
  publishes to npm (skipping steps that already happened).

**Never tag by hand from a local machine** — the tag is created by CI at the
commit CI checked out, so it always matches the published lib/, release body
and npm tarball. To release an older commit, check out a branch that carries
its version numbers and dispatch the workflow there.

## Conventional commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat(scope): …`, `fix(scope): …`). They are what changelogithub turns into
the English release detail — write the subject line for users, not for the
diff. Do not mix unrelated changes into one commit: the changelog groups by
type and scope.
