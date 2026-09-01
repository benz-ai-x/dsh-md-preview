#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const requireSource = process.argv.includes('--require-source')
const syncLinks = process.argv.includes('--sync-links')
const harnessRootIndex = process.argv.indexOf('--harness-root')
const explicitHarnessRoot = harnessRootIndex >= 0 ? process.argv[harnessRootIndex + 1] : undefined
const failures = []
const warnings = []
const passes = []
const expectedLinks = Object.freeze({
  '@deepseek-ai/cordis': 'vendor/cordis',
  '@deepseek-ai/cordis-plugin-include': 'vendor/include',
  '@deepseek-ai/cordis-plugin-loader': 'vendor/loader',
  '@deepseek-ai/dsh-agent': 'packages/core/agent',
  '@deepseek-ai/dsh-api-remotes': 'packages/api/remotes',
  '@deepseek-ai/dsh-client-locale': 'packages/client/locale',
  '@deepseek-ai/dsh-client-store': 'packages/client/store',
  '@deepseek-ai/dsh-client-ui-chat': 'packages/client/ui-chat',
  '@deepseek-ai/dsh-client-ui-conversation': 'packages/client/ui-conversation',
  '@deepseek-ai/dsh-client-ui-deliverables': 'packages/client/ui-deliverables',
  '@deepseek-ai/dsh-client-ui-layout': 'packages/client/ui-layout',
  '@deepseek-ai/dsh-client-ui-primitives': 'packages/client/ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots': 'packages/client/ui-slots',
  '@deepseek-ai/dsh-fs': 'packages/fs/fs',
  '@deepseek-ai/dsh-session': 'packages/core/session',
  '@deepseek-ai/dsh-typert-protocol': 'packages/typert/protocol',
})

function check(condition, message) {
  if (condition) passes.push(message)
  else failures.push(message)
}

function listFiles(root) {
  const result = []
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile()) result.push(absolute)
    }
  }
  visit(root)
  return result.sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
}

function digestDocs(sourceRoot) {
  const docsRoot = join(sourceRoot, 'docs')
  if (!existsSync(docsRoot) || !statSync(docsRoot).isDirectory()) {
    throw new Error(`missing docs directory under ${sourceRoot}`)
  }
  const aggregate = createHash('sha256')
  for (const absolute of listFiles(docsRoot)) {
    const fileDigest = createHash('sha256').update(readFileSync(absolute)).digest('hex')
    const sourceRelative = relative(sourceRoot, absolute).split(sep).join('/')
    aggregate.update(`${fileDigest}  ${sourceRelative}\n`)
  }
  return aggregate.digest('hex')
}

function gitHead(sourceRoot) {
  const result = spawnSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git rev-parse failed for ${sourceRoot}`)
  }
  return result.stdout.trim()
}

function harnessWorktreeChanges(sourceRoot) {
  const statusCommands = [
    ['status', '--porcelain=v1', '--untracked-files=all'],
    ['status', '--porcelain=v1', '--ignored=matching', '--untracked-files=all', '--', '.env'],
  ]
  const changes = new Set()
  for (const args of statusCommands) {
    const result = spawnSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' })
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || `git status failed for ${sourceRoot}`)
    }
    for (const line of result.stdout.split(/\r?\n/)) {
      if (line) changes.add(line)
    }
  }
  return [...changes].join('\n')
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index]
    if (difference !== 0) return difference
  }
  return 0
}

function parseVersion(value) {
  const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)/.exec(value)
  return match ? match.slice(1).map(Number) : undefined
}

function nodeSatisfies(range, version = process.version) {
  const actual = parseVersion(version)
  if (!actual || typeof range !== 'string') return false
  return range.split('||').some(rawClause => {
    const clause = rawClause.trim()
    const minimum = parseVersion(clause.replace(/^(?:\^|>=)\s*/, ''))
    if (!minimum || compareVersions(actual, minimum) < 0) return false
    if (clause.startsWith('>=')) return true
    if (clause.startsWith('^')) return compareVersions(actual, [minimum[0] + 1, 0, 0]) < 0
    return compareVersions(actual, minimum) === 0
  })
}

function relativeProjectPath(target) {
  let value = relative(projectRoot, target).split(sep).join('/')
  if (!value.startsWith('.')) value = `./${value}`
  return value
}

function writeJsonAtomically(path, value) {
  const temporary = `${path}.dsh-context-${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  renameSync(temporary, path)
}

function validateLinkedArtifacts(sourceRoot) {
  for (const [packageName, sourcePath] of Object.entries(expectedLinks)) {
    const packageRoot = join(sourceRoot, sourcePath)
    const packageManifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
    const entries = [
      ['main', packageManifest.main],
      ['types', packageManifest.types],
    ]
    const inputs = [join(packageRoot, 'package.json')]
    const sourceDirectory = join(packageRoot, 'src')
    if (existsSync(sourceDirectory)) inputs.push(...listFiles(sourceDirectory))
    const newestInput = Math.max(...inputs.map(path => statSync(path).mtimeMs))
    for (const [field, entry] of entries) {
      const artifact = typeof entry === 'string' ? join(packageRoot, entry) : undefined
      check(artifact !== undefined && existsSync(artifact), `${packageName} has a built ${field} entry`)
      if (artifact !== undefined && existsSync(artifact)) {
        check(statSync(artifact).mtimeMs >= newestInput, `${packageName} built ${field} entry is fresh`)
      }
    }
  }
}

const requiredFiles = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'TODO.md',
  'package.json',
  'dsh-reference.lock.json',
  'docs/agent/PROJECT_CONTRACT.md',
  'src/index.ts',
  'src/config.ts',
  'src/constants.ts',
  'src/remote.ts',
  'src/typert/remote-client.ts',
  'src/client/index.ts',
  'cordis.patch.yml',
  'tsdown.config.ts',
  'tests/host-read.spec.ts',
  'tests/contribution.spec.ts',
  'tests/client-registration.spec.ts',
  'scripts/verify-built.mjs',
]
for (const path of requiredFiles) {
  check(existsSync(join(projectRoot, path)), `${path} exists`)
}

let manifest
let lock
try {
  manifest = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
} catch (error) {
  failures.push(`package.json is invalid: ${error instanceof Error ? error.message : String(error)}`)
}
try {
  lock = JSON.parse(readFileSync(join(projectRoot, 'dsh-reference.lock.json'), 'utf8'))
} catch (error) {
  failures.push(`dsh-reference.lock.json is invalid: ${error instanceof Error ? error.message : String(error)}`)
}

if (manifest) {
  check(manifest.name === '@benz-ai-x/dsh-md-preview', 'package name matches the project contract')
  check(manifest.private === undefined, 'publishable package is not private')
  check(manifest.publishConfig?.access === 'public', 'scoped package publishes with public access')
  check(manifest.type === 'module', 'package uses ESM')
  check(manifest.engines?.node === '^22.19.0 || >=24.0.0', 'package Node engine matches the pinned Harness')
  check(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'package declares its DSH bundle patch')
  check(manifest.exports?.['./cordis.patch.yml'] === './cordis.patch.yml', 'package exports its bundle patch')
  check(manifest.dsh?.client?.platform === 'web', 'package declares a web client face')
  check(
    manifest.exports?.['./client']?.default === './lib/client.js',
    'package exports the built browser bundle',
  )
  check(
    manifest.exports?.['./remote']?.default === './lib/typert/remote-client.js',
    'package exports the Remote contribution',
  )
  check(
    manifest.scripts?.['context:check:strict'] === 'node scripts/verify-dsh-context.mjs --require-source',
    'strict context script requires the source baseline',
  )
  check(
    manifest.scripts?.['context:link'] === 'node scripts/verify-dsh-context.mjs --sync-links --require-source && pnpm install --no-frozen-lockfile',
    'context link script rewrites links and refreshes the package-manager lock',
  )
  const serialized = JSON.stringify(manifest)
  check(!serialized.includes('workspace:'), 'external package contains no workspace protocol dependency')
}

if (lock) {
  check(lock.schemaVersion === 1, 'reference lock schema is supported')
  check(/^[0-9a-f]{40}$/.test(lock.upstream?.commit ?? ''), 'reference lock has a full Git commit')
  check(/^[0-9a-f]{64}$/.test(lock.upstream?.docsDigest ?? ''), 'reference lock has a docs SHA-256')
  check(lock.upstream?.node === '^22.19.0 || >=24.0.0', 'reference lock records the pinned Node engine')
  check(nodeSatisfies(lock.upstream?.node), `Node ${process.version} satisfies ${lock.upstream.node}`)

  const environmentName = lock.localResolution?.environmentVariable ?? 'DSH_HARNESS_ROOT'
  const configuredRoot = explicitHarnessRoot || process.env[environmentName]
  const fallback = lock.localResolution?.fallbackRelativePath
  const sourceRoot = resolve(configuredRoot || join(projectRoot, fallback || ''))

  if (!existsSync(sourceRoot)) {
    const message = `pinned DSH source not found at ${sourceRoot}`
    if (requireSource) failures.push(message)
    else warnings.push(`${message}; set ${environmentName} for strict validation`)
  } else {
    try {
      const sourceManifest = JSON.parse(readFileSync(join(sourceRoot, 'package.json'), 'utf8'))
      check(sourceManifest.version === lock.upstream.version, `DSH version matches ${lock.upstream.version}`)
      check(sourceManifest.engines?.node === lock.upstream.node, `DSH Node engine matches ${lock.upstream.node}`)
      check(gitHead(sourceRoot) === lock.upstream.commit, `DSH commit matches ${lock.upstream.commit}`)
      check(digestDocs(sourceRoot) === lock.upstream.docsDigest, 'DSH docs digest matches the audited baseline')
      const dirty = harnessWorktreeChanges(sourceRoot)
      check(dirty.length === 0, dirty.length === 0
        ? 'DSH Harness attested source inputs are clean'
        : `DSH Harness attested source inputs have changes:\n${dirty}`)
      validateLinkedArtifacts(sourceRoot)

      if (syncLinks && failures.length === 0) {
        for (const [packageName, sourcePath] of Object.entries(expectedLinks)) {
          manifest.devDependencies[packageName] = `link:${relativeProjectPath(join(sourceRoot, sourcePath))}`
        }
        lock.localResolution.fallbackRelativePath = relativeProjectPath(sourceRoot)
        writeJsonAtomically(join(projectRoot, 'package.json'), manifest)
        writeJsonAtomically(join(projectRoot, 'dsh-reference.lock.json'), lock)
        passes.push(`synchronized Harness links to ${sourceRoot}`)
      }

      // Source-linked vs registry default: once `context:link` rewrote a
      // devDependency to `link:`, that link must point at the audited source;
      // without any link: the manifest must carry the registry versions (the
      // default since the git-install support landed — a manifest that mixes
      // in wrong-link: entries means the source checkout moved behind the
      // developer's back, so relink with `pnpm context:link`).
      for (const [packageName, sourcePath] of Object.entries(expectedLinks)) {
        const specifier = manifest?.devDependencies?.[packageName]
        const isLink = typeof specifier === 'string' && specifier.startsWith('link:')
        if (isLink) {
          const linkedPath = resolve(projectRoot, specifier.slice('link:'.length))
          const expectedPath = join(sourceRoot, sourcePath)
          check(
            existsSync(linkedPath) && realpathSync(linkedPath) === realpathSync(expectedPath),
            `${packageName} development dependency links to the audited source`,
          )
        } else {
          check(
            typeof specifier === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(specifier),
            `${packageName} development dependency pins its registry version (${specifier ?? 'missing'})`,
          )
        }
      }
      passes.push(`validated DSH source at ${sourceRoot}`)
    } catch (error) {
      failures.push(`cannot validate DSH source at ${sourceRoot}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

for (const message of passes) console.log(`PASS ${message}`)
for (const message of warnings) console.warn(`WARN ${message}`)
for (const message of failures) console.error(`FAIL ${message}`)

if (failures.length > 0) {
  console.error(`\ncontext check failed: ${failures.length} failure(s), ${warnings.length} warning(s)`)
  process.exitCode = 1
} else {
  console.log(`\ncontext check passed: ${passes.length} check(s), ${warnings.length} warning(s)`)
}
