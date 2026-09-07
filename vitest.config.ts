/**
 * Vitest configuration: the shared decorator-lowering plugin (see
 * scripts/build-plugins.ts) plus source aliases for the two runtime client
 * imports (their package `./client` exports are browser factory bundles, not
 * Node modules).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { standardDecoratorPlugin } from './scripts/build-plugins.ts'

const projectRoot = resolve(import.meta.dirname)
const harnessRoot = resolve(process.env.DSH_HARNESS_ROOT ?? projectRoot, process.env.DSH_HARNESS_ROOT ? '.' : '../deepseek-harness')

/** Package version label, mirrored from the tsdown client-face define for tests. */
const VERSION = `v${JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).version as string}`

/** Harness-source resolution for the runtime `./client` imports used by tests. */
const clientSourceAliases = {
  '@deepseek-ai/dsh-client-ui-renderer/client': resolve(harnessRoot, 'packages/client/ui-renderer/src/client/index.ts'),
  '@deepseek-ai/dsh-client-locale/client': resolve(harnessRoot, 'packages/client/locale/src/client/index.ts'),
  // The assembly bench renders the whole slot tree through the real renderer:
  // the render-app factory and slot renderer are not re-exported by the
  // package index, so they resolve from the harness source directly.
  '#harness/renderer/app': resolve(harnessRoot, 'packages/client/ui-renderer/src/client/app.tsx'),
  '#harness/renderer/scoped-slots': resolve(harnessRoot, 'packages/client/ui-renderer/src/client/scoped-slots.tsx'),
  // The registry artifact of ui-primitives imports built `.module.css`
  // files (a monorepo-pipeline product the host bundle understands, not
  // node/vitest); tests resolve the source, like the two aliases above.
  '@deepseek-ai/dsh-client-ui-primitives': resolve(harnessRoot, 'packages/client/ui-primitives/src/index.ts'),
  // One React copy for the whole render tree: harness-linked client packages
  // resolve their own 18.3.x through the harness checkout while this project
  // pins 18.2, and two dispatcher copies break every hook call.
  react: resolve(projectRoot, 'node_modules/react'),
  'react/jsx-runtime': resolve(projectRoot, 'node_modules/react/jsx-runtime'),
  // The renderer's selector shim is the one harness import whose pnpm copy
  // binds the harness React when externalized; point its two entry points at
  // this project's copy (peer-pinned to the same 18.2 instance).
  'use-sync-external-store/shim/with-selector': resolve(
    projectRoot,
    'node_modules/.pnpm/use-sync-external-store@1.2.0_react@18.2.0/node_modules/use-sync-external-store/shim/with-selector.js',
  ),
  'use-sync-external-store/shim': resolve(
    projectRoot,
    'node_modules/.pnpm/use-sync-external-store@1.2.0_react@18.2.0/node_modules/use-sync-external-store/shim/index.js',
  ),
}

export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  define: {
    'process.env.MD_PREVIEW_VERSION': JSON.stringify(VERSION),
  },
  resolve: {
    alias: clientSourceAliases,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.{ts,tsx}'],
    // jsdom focus (document.activeElement) is timing-sensitive under parallel
    // workers: a focus set inside one act pass can be observed as null when
    // CPU contention delays a re-render between focus and assertion (seen on
    // the tree roving-focus and the leave-guard focus-handback tests). The
    // suite is small; serial files buy determinism for ~2s.
    fileParallelism: false,
    // The harness renderer sources this project inlines import the
    // use-sync-external-store shim, whose pnpm-resolved copy binds the
    // harness's React 18.3 when externalized — a second dispatcher. Inlining
    // the shim routes its internal react import through the alias above onto
    // this project's single React copy.
    server: { deps: { inline: [/use-sync-external-store/] } },
  },
})
