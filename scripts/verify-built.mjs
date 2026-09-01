#!/usr/bin/env node

/** Verify the built artifacts exist and are at least as fresh as their inputs. */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(join(fileURLToPath(import.meta.url), '..'), '..')

function listInputs() {
  const inputs = [join(projectRoot, 'package.json'), join(projectRoot, 'tsdown.config.ts')]
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile() && /\.(ts|tsx|css)$/.test(entry.name)) inputs.push(absolute)
    }
  }
  visit(join(projectRoot, 'src'))
  return inputs
}

const artifacts = [
  'lib/index.js',
  'lib/typert/remote-client.js',
  'lib/client.js',
  'lib/types/index.d.ts',
  'lib/types/client/index.d.ts',
  'lib/types/typert/remote-client.d.ts',
]

const failures = []
const newestInput = Math.max(...listInputs().map(path => statSync(path).mtimeMs))
for (const artifact of artifacts) {
  const absolute = join(projectRoot, artifact)
  if (!existsSync(absolute)) {
    failures.push(`${artifact} is missing`)
    continue
  }
  if (statSync(absolute).mtimeMs < newestInput) {
    failures.push(`${artifact} is stale relative to ${relative(projectRoot, join(projectRoot, 'src'))}`)
  }
}

// The browser bundle must register through the module loader and must not
// carry a bare ESM entry.
const client = join(projectRoot, 'lib/client.js')
if (existsSync(client)) {
  const head = readFileSync(client, 'utf8').slice(0, 400)
  if (!head.startsWith('window.__ModuleLoader__.load(') || !head.includes('"@benz-ai-x/dsh-md-preview"')) {
    failures.push('lib/client.js does not open with the lazy-CJS factory registration')
  }
}

if (failures.length > 0) {
  console.error(failures.map(message => `FAIL ${message}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`built check passed: ${artifacts.length} artifact(s) fresh`)
}
