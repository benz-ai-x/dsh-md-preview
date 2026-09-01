/**
 * Vitest configuration: the shared decorator-lowering plugin (see
 * scripts/build-plugins.ts) plus source aliases for the two runtime client
 * imports (their package `./client` exports are browser factory bundles, not
 * Node modules).
 */
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { standardDecoratorPlugin } from './scripts/build-plugins.ts'

const projectRoot = resolve(import.meta.dirname)
const harnessRoot = resolve(process.env.DSH_HARNESS_ROOT ?? projectRoot, process.env.DSH_HARNESS_ROOT ? '.' : '../../deepseek-harness')

/** Harness-source resolution for the runtime `./client` imports used by tests. */
const clientSourceAliases = {
  '@deepseek-ai/dsh-client-ui-renderer/client': resolve(harnessRoot, 'packages/client/ui-renderer/src/client/index.ts'),
  '@deepseek-ai/dsh-client-locale/client': resolve(harnessRoot, 'packages/client/locale/src/client/index.ts'),
}

export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  resolve: {
    alias: clientSourceAliases,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
})
