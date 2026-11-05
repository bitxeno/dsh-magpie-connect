/**
 * Harness-home path helpers.
 *
 * Mirrors `@deepseek-ai/dsh-home-paths` closely enough to keep this plugin
 * independent of that package (the repo's `node_modules` carries no
 * `@deepseek-ai/*`, so importing it would break offline `typecheck`). The
 * resolution order is the documented one: an explicit path wins, then
 * `$DSH_HOME`, then `~/.dsh`; a blank override is treated as unset so a stray
 * empty variable never resolves the home to the current working directory.
 *
 * `legacyDataDir()` is deliberately NOT derived from the resolved home: the
 * 0.4.x line computed its state dir as `join(homedir(), '.dsh-magpie-connect')`
 * and never looked at `DSH_HOME`. Reading the old file through the new helper
 * would miss it for anyone who sets `DSH_HOME`, which is exactly the user who
 * must not silently lose their configuration.
 */
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** Resolve the Harness home: explicit override > $DSH_HOME > ~/.dsh. */
export function resolveDshHome(configured?: string, env: NodeJS.ProcessEnv = process.env): string {
  if (typeof configured === 'string' && configured.trim() !== '') return resolve(configured)
  const fromEnv = env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return resolve(fromEnv)
  return join(homedir(), '.dsh')
}

/** Join path segments onto the resolved Harness home. */
export function dshHomePath(...segments: string[]): string {
  return join(resolveDshHome(), ...segments)
}

/**
 * State directory used by dsh-magpie-connect 0.4.x and earlier.
 *
 * `homedir`-based on purpose — see the module note. Used only to read/write the
 * pre-0.5 settings file during the one-time, save-triggered migration.
 */
export function legacyDataDir(): string {
  return join(homedir(), '.dsh-magpie-connect')
}
