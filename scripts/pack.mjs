#!/usr/bin/env node
/**
 * Pack the publishable tarball with a registry-clean manifest. The source
 * tree's `link:` devDependencies describe this machine's Harness checkout and
 * must never ship: the packed manifest drops `devDependencies` for the pack
 * run only, restoring the working-tree manifest byte-for-byte afterwards
 * (crash-safe via try/finally). The script then re-opens the produced archive
 * and fails loudly if any `link:`/`workspace:` specifier or devDependencies
 * map leaked into it.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const projectRoot = resolve(new URL('..', import.meta.url).pathname)
const manifestPath = join(projectRoot, 'package.json')
const original = readFileSync(manifestPath, 'utf8')
// `--publish` forwards to `npm publish` (same cleaned-manifest rewrite; npm
// otherwise packs the working tree verbatim and would ship the link: devDeps).
const publish = process.argv.includes('--publish')
const extraArgs = process.argv.slice(2).filter(argument => argument !== '--publish')

let packedName
try {
  const manifest = JSON.parse(original)
  const clean = { ...manifest }
  delete clean.devDependencies
  writeFileSync(manifestPath, `${JSON.stringify(clean, null, 2)}\n`)
  if (publish) {
    execFileSync('npm', ['publish', '--access', 'public', ...extraArgs], { cwd: projectRoot, stdio: 'inherit' })
    packedName = null
  } else {
    const output = execFileSync('npm', ['pack', '--json', '--silent'], { cwd: projectRoot, encoding: 'utf8' })
    packedName = JSON.parse(output)[0].filename
  }
} finally {
  writeFileSync(manifestPath, original)
}

// Packed-artifact gate: the shipped manifest must resolve on an ordinary
// registry install — no machine-local link: and no workspace: protocol.
// (Publish mode is gated by the pre-publish smoke, not re-inspected here.)
if (packedName === null) process.exit(0)
const packedJson = execFileSync(
  'tar', ['-xOf', join(projectRoot, packedName), 'package/package.json'],
  { encoding: 'utf8' },
)
const packed = JSON.parse(packedJson)
const failures = []
if (packed.devDependencies !== undefined) failures.push('packed manifest still carries devDependencies')
if (packedJson.includes('link:')) failures.push('packed manifest carries link: specifiers')
if (packedJson.includes('workspace:')) failures.push('packed manifest carries workspace: specifiers')
if (failures.length > 0) {
  console.error(failures.map(message => `FAIL ${message}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`packed ${packedName}: manifest is registry-clean (no devDependencies, no link:/workspace:)`)
}
