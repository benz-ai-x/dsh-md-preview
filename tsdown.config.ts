/**
 * Build faces for dsh-md-preview.
 *
 * The client face deliberately reproduces the pinned Harness browser bundle
 * protocol (packages/client/tsdown.client.ts in the audited checkout) without
 * importing that repo-internal preset: a lazy-CJS factory bundle registered
 * through `window.__ModuleLoader__.load`, with the frozen platform baseline
 * kept external and everything else inlined. The host face is a plain ESM
 * Node bundle.
 */
import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'
import { standardDecoratorPlugin } from './scripts/build-plugins.ts'

/** Module-table id: must equal the npm package name (the boot graph keys rows by package name). */
const ID = '@benz-ai-x/dsh-md-preview'

/** Package version, injected into the client bundle at build time. */
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string

/** The module specifiers the DSH web shell shares into the frozen module table. */
const PLATFORM_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
])

/** Whether a specifier stays an external require against the module table. */
const isExternal = (specifier: string): boolean => PLATFORM_MODULES.has(specifier)

/**
 * Whether a specifier is the package's own generated Remote contribution
 * subpath (inlined into the client bundle by design).
 */
const isOwnRemote = (specifier: string): boolean => specifier === `${ID}/remote`

export default defineConfig([
  {
    name: `${ID}/host`,
    entry: {
      index: 'src/index.ts',
      'typert/remote-client': 'src/typert/remote-client.ts',
    },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    // Keep .js extensions matching the package exports (type: module).
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: false,
    plugins: [standardDecoratorPlugin()],
  },
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    minify: true,
    deps: {
      neverBundle: (specifier: string) => isExternal(specifier) || isOwnRemote(specifier),
      alwaysBundle: (specifier: string) => !(isExternal(specifier) || isOwnRemote(specifier)),
    },
    inputOptions: {
      resolve: {
        conditionNames: [
          (process.env.NODE_ENV ?? 'production') === 'development' ? 'development' : 'production',
          'browser', 'import', 'module', 'default',
        ],
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      // The full v-prefixed label, so it lands in the bundle as one literal.
      'process.env.MD_PREVIEW_VERSION': JSON.stringify(`v${VERSION}`),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
