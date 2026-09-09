/**
 * Vitest configuration: the shared decorator-lowering plugin (see
 * scripts/build-plugins.ts) plus source aliases for the two runtime client
 * imports (their package `./client` exports are browser factory bundles, not
 * Node modules).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import ts from 'typescript'
import { standardDecoratorPlugin } from './scripts/build-plugins.ts'

const projectRoot = resolve(import.meta.dirname)
const harnessRoot = resolve(process.env.DSH_HARNESS_ROOT ?? projectRoot, process.env.DSH_HARNESS_ROOT ? '.' : '../deepseek-harness')

// Source-linked Harness artifacts load through the DSH runtime. Unit assembly
// follows the same source paths as Harness's own Vitest lane instead of trying
// to execute those runtime proxies directly in Node.
const harnessConfigPath = resolve(harnessRoot, 'tsconfig.base.json')
const harnessConfig = ts.readConfigFile(harnessConfigPath, ts.sys.readFile)
if (harnessConfig.error !== undefined) throw new Error(`Cannot read ${harnessConfigPath}`)
const harnessPaths = harnessConfig.config.compilerOptions.paths as Record<string, string[]>
const harnessSourceAliases = Object.entries(harnessPaths).map(([name, targets]) => ({
  find: new RegExp(`^${name.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+)')}$`),
  replacement: resolve(harnessRoot, targets[0]!).replace('*', '$1'),
}))

/** Package version label, mirrored from the tsdown client-face define for tests. */
const VERSION = `v${JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).version as string}`

/** Harness-source resolution for the runtime `./client` imports used by tests. */
const clientSourceAliases = {
  '@testing-library/react': resolve(harnessRoot, 'node_modules/@testing-library/react/dist/@testing-library/react.esm.js'),
  '@deepseek-ai/dsh-client-ui-renderer/client': resolve(harnessRoot, 'packages/client/ui-renderer/src/client/index.ts'),
  '@deepseek-ai/dsh-client-locale/client': resolve(harnessRoot, 'packages/client/locale/src/client/index.ts'),
  '@deepseek-ai/dsh-client-ui-sidebar-right/client': resolve(harnessRoot, 'packages/client/ui-sidebar-right/src/client/index.ts'),
  '@deepseek-ai/dsh-client-ui-dockkit': resolve(harnessRoot, 'packages/client/ui-dockkit/src/index.ts'),
  '@deepseek-ai/dsh-client-test-runtime': resolve(harnessRoot, 'packages/test-support/client-runtime/src/index.ts'),
  '@deepseek-ai/dsh-client-ui-session/client': resolve(harnessRoot, 'packages/client/ui-session/src/client/index.ts'),
  '@deepseek-ai/dsh-api-session-controller/client': resolve(harnessRoot, 'packages/api/session-controller/src/client/index.ts'),
  '@deepseek-ai/dsh-client-ui-renderer/src': resolve(harnessRoot, 'packages/client/ui-renderer/src'),
  // The assembly bench renders the whole slot tree through the real renderer:
  // the render-app factory and slot renderer are not re-exported by the
  // package index, so they resolve from the harness source directly.
  '#harness/renderer/app': resolve(harnessRoot, 'packages/client/ui-renderer/src/client/app.tsx'),
  '#harness/renderer/scoped-slots': resolve(harnessRoot, 'packages/client/ui-renderer/src/client/scoped-slots.tsx'),
  '#harness/layout/frame': resolve(harnessRoot, 'packages/client/ui-layout/src/client/AppFrame.tsx'),
  '#harness/layout/store': resolve(harnessRoot, 'packages/client/ui-layout/src/client/stores.ts'),
  // The registry artifact of ui-primitives imports built `.module.css`
  // files (a monorepo-pipeline product the host bundle understands, not
  // node/vitest); tests resolve the source, like the two aliases above.
  '@deepseek-ai/dsh-client-ui-primitives': resolve(harnessRoot, 'packages/client/ui-primitives/src/index.ts'),
  // One React copy for the whole render tree: harness-linked client packages
  // resolve their own 18.3.x through the harness checkout while this project
  // pins 18.2, and two dispatcher copies break every hook call.
  react: resolve(projectRoot, 'node_modules/react'),
  'react/jsx-runtime': resolve(projectRoot, 'node_modules/react/jsx-runtime'),
  'react-dom': resolve(projectRoot, 'node_modules/react-dom'),
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
    alias: [
      ...Object.entries(clientSourceAliases).map(([find, replacement]) => ({ find, replacement })),
      ...harnessSourceAliases,
    ],
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
    server: { deps: { inline: [/use-sync-external-store/, /@testing-library\/react/] } },
  },
})
