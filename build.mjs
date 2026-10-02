/**
 * ESM host build for dsh-magpie-connect.
 *
 * The host half is plain ESM for Node, externalizing @earendil-works/pi-ai
 * (the profile's healed node_modules provides it) and any @deepseek-ai/dsh-*
 * imports should they appear in the future. @earendil-works/pi-ai itself
 * bundles its own heavy SDKs as real dependencies (openai, @google/genai,
 * protobufjs, …): keep them external too so one copy serves every consumer —
 * the profile install (`dsh plugin add`) heals the tree. Type declarations
 * land in lib/types (package.json exports map points there).
 */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('lib', { recursive: true })
mkdirSync('lib/types', { recursive: true })

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  sourcemap: true,
  external: ['@deepseek-ai/*', '@earendil-works/pi-ai', '@earendil-works/pi-ai/*'],
  logLevel: 'info',
})

import { execFileSync } from 'node:child_process'
execFileSync('node_modules/.bin/tsc', ['-p', 'tsconfig.build.json'], { stdio: 'inherit' })
