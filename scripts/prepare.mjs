#!/usr/bin/env node
/**
 * `prepare` for the git-install form (DSH publish spec, "Installing from
 * GitHub"): pnpm runs this after a git install and nothing else builds the
 * package, so it transpiles the published entry points from `src/` with a
 * dedicated tsdown config — no type checking, no project references, no
 * assumption of a sibling harness checkout. It is deliberately conditional:
 * a registry tarball already ships `lib/`, so prepare stays a no-op there.
 *
 * A git install also has no type declarations (tsc is development-only);
 * the exports map keeps `types` pointing at lib/types for npm consumers,
 * and git consumers simply run the JavaScript, as the spec's own sample
 * (turtle-ui) does.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const artifacts = ['lib/index.js', 'lib/client.js', 'lib/typert/remote-client.js']

/** Newest mtime under src (the only build inputs prepare owns). */
function newestInput() {
  let newest = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else newest = Math.max(newest, statSync(path).mtimeMs)
    }
  }
  walk(join(root, 'src'))
  return newest
}

const missing = artifacts.some(artifact => {
  const absolute = join(root, artifact)
  return !existsSync(absolute) || statSync(absolute).mtimeMs < newestInput()
})
if (!missing) {
  console.log('dsh-md-preview prepare: lib/ already present, skipping build')
  process.exit(0)
}

const tsdown = join(root, 'node_modules', '.bin', 'tsdown')
if (!existsSync(tsdown)) {
  console.error('dsh-md-preview prepare: tsdown not installed (dependencies must include it)')
  process.exitCode = 1
} else {
  execFileSync(tsdown, ['--config', 'tsdown.prepare.config.ts'], { cwd: root, stdio: 'inherit' })
  for (const artifact of artifacts) {
    if (!existsSync(join(root, artifact))) {
      console.error(`dsh-md-preview prepare: expected artifact missing after build: ${artifact}`)
      process.exitCode = 1
      break
    }
  }
}
