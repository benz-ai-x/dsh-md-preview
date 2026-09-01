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
const harnessRoot = resolve(process.env.DSH_HARNESS_ROOT ?? projectRoot, process.env.DSH_HARNESS_ROOT ? '.' : '../../deepseek-harness')

/** Package version label, mirrored from the tsdown client-face define for tests. */
const VERSION = `v${JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).version as string}`

/** Harness-source resolution for the runtime `./client` imports used by tests. */
const clientSourceAliases = {
  '@deepseek-ai/dsh-client-ui-renderer/client': resolve(harnessRoot, 'packages/client/ui-renderer/src/client/index.ts'),
  '@deepseek-ai/dsh-client-locale/client': resolve(harnessRoot, 'packages/client/locale/src/client/index.ts'),
  // One React copy for the whole render tree: harness-linked client packages
  // resolve their own 18.3.x through the harness checkout while this project
  // pins 18.2, and two dispatcher copies break every hook call.
  react: resolve(projectRoot, 'node_modules/react'),
  'react/jsx-runtime': resolve(projectRoot, 'node_modules/react/jsx-runtime'),
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
  },
})
