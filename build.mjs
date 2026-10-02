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
 *
 * The client half (settings sidebar page) bundles src/client to lib/client.js
 * as CJS with the browser externals left as require() calls, wrapped in the
 * host ModuleLoader envelope (same shape as dsh-llm-github-copilot's
 * lib/client.js).
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

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

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome110'],
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  define: { __PLUGIN_VERSION__: JSON.stringify(pkg.version) },
  banner: {
    js: `window.__ModuleLoader__.load({
  id: "dsh-magpie-connect",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });`,
  },
  footer: {
    js: `
    return module.exports;
  }
});`,
  },
  logLevel: 'info',
})
execFileSync(process.execPath, ['--check', 'lib/client.js'], { stdio: 'inherit' })

execFileSync('node_modules/.bin/tsc', ['-p', 'tsconfig.build.json'], { stdio: 'inherit' })
