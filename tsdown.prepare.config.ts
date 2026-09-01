/**
 * The git-install prepare build (DSH publish spec: self-contained, no
 * type checking, no project references). Mirrors the shipped tsdown.config
 * for the two faces the patch rows and the web shell resolve — host ESM
 * plus the lazy-CJS client factory — minus everything development-only:
 * no sourcemaps, no dts. The decorator-lowering plugin is required (the
 * host service uses @Remote), and the version badge is defined so the
 * panel keeps its build-time version.
 */
import { defineConfig } from 'tsdown'
import { readFileSync } from 'node:fs'
import { standardDecoratorPlugin } from './scripts/build-plugins.ts'

const ID = '@benz-ai-x/dsh-md-preview'
const VERSION = `v${JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string}`

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

const isExternal = (specifier: string): boolean => PLATFORM_MODULES.has(specifier)
const isOwnRemote = (specifier: string): boolean => specifier === `${ID}/remote`

export default defineConfig([
  {
    name: `${ID}/prepare-host`,
    entry: {
      index: 'src/index.ts',
      'typert/remote-client': 'src/typert/remote-client.ts',
    },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    sourcemap: false,
    clean: false,
    plugins: [standardDecoratorPlugin()],
  },
  {
    name: `${ID}/prepare-client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: false,
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
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.MD_PREVIEW_VERSION': JSON.stringify(VERSION),
      'import.meta.env.MODE': JSON.stringify('production'),
      'import.meta.env': JSON.stringify({ MODE: 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
