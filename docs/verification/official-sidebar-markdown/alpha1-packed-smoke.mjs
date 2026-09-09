import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { runInNewContext } from 'node:vm'

const project = '/Users/pc2026/DSH-Space/dsh-md-preview'
const cli = '/Users/pc2026/DSH-Space/deepseek-harness-md-guard/apps/cli/lib/bin.js'
const version = '0.11.0-alpha.1'
const id = '@benz-ai-x/dsh-md-preview'
const archive = join(project, `benz-ai-x-dsh-md-preview-${version}.tgz`)
const smokeHome = mkdtempSync('/tmp/mdpreview-0110-smoke-')
const profile = join(smokeHome, 'profiles/web')
const env = { ...process.env, DSH_HOME: smokeHome }
const digest = (body, algorithm = 'sha256') => createHash(algorithm).update(body).digest('hex')
const result = { version, baseline: '0.1.5-alpha.1+737e95c657a95fd04b12269313902f9b5ca2f6ca', profile, archiveSha256: digest(readFileSync(archive)), shutdown: [] }
writeFileSync('/tmp/mdpreview-0110-smoke-home.txt', smokeHome + '\n')

function start(args, label) {
  const log = join(smokeHome, label + '.log')
  const fd = openSync(log, 'w', 0o600)
  const child = spawn(process.execPath, [cli, ...args], { cwd: project, env, stdio: ['ignore', fd, fd] })
  closeSync(fd)
  const done = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  return { child, done, log }
}
async function command(args, label) {
  const run = start(args, label)
  const exit = await run.done
  assert.equal(exit.code, 0, `${label} failed; inspect ${run.log}`)
  return readFileSync(run.log, 'utf8')
}
async function stop(run) {
  if (!run) return
  const timeout = setTimeout(() => run.child.kill('SIGKILL'), 8000)
  try {
    if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill('SIGTERM')
    const exit = await run.done
    result.shutdown.push(exit)
    assert.equal(exit.code, 0, `Server did not shut down cleanly: ${JSON.stringify(exit)}`)
  } finally { clearTimeout(timeout) }
}
async function http(run, port, priorUrl) {
  let authUrl
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(run.child.exitCode, null, `Server exited; inspect ${run.log}`)
    authUrl = readFileSync(run.log, 'utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)?.[0]
    if (authUrl) break
    await delay(200)
  }
  assert.ok(authUrl, 'Server did not advertise a bootstrap URL')
  const login = await fetch(authUrl, { redirect: 'manual' })
  const cookie = login.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie)
  const base = `http://127.0.0.1:${port}`
  const headers = { cookie }
  const page = await fetch(base, { headers })
  assert.equal(page.status, 200)
  const html = await page.text()
  const bootMatch = html.match(/globalThis\["__DSH_BOOT__"\] = (.*?)<\/script>/s)
  assert.ok(bootMatch)
  const boot = JSON.parse(bootMatch[1])
  const entry = boot.entries.find(row => row.id === id)
  if (priorUrl) {
    assert.equal(entry, undefined)
    const response = await fetch(new URL(priorUrl, base), { headers })
    assert.equal(response.status, 404)
    return { entries: boot.entries.length, priorBundleStatus: response.status, absent: true }
  }
  assert.ok(entry)
  const response = await fetch(new URL(entry.url, base), { headers })
  assert.equal(response.status, 200)
  const content = await response.text()
  for (const marker of [`v${version}`, 'beforeClose', 'dsh-md-tab', 'Discard changes', '原生文本']) assert.ok(content.includes(marker), marker)
  assert.ok(!content.includes('dsh-md-preview-panelglyph'))
  assert.ok(!content.includes('md-preview-panel'))
  return { status: response.status, entries: boot.entries.length, bytes: Buffer.byteLength(content), servedSha256: digest(content), url: entry.url, releaseMarkers: true }
}

let server
try {
  const files = execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).trim().split('\n')
  const manifestText = execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' })
  const manifest = JSON.parse(manifestText)
  assert.equal(manifest.version, version)
  assert.equal(manifest.name, id)
  assert.equal(manifest.private, undefined)
  assert.equal(manifest.devDependencies, undefined)
  assert.ok(!/link:|workspace:/.test(manifestText))
  assert.ok(!files.some(file => /\.map$/.test(file)))
  function exported(value) {
    if (typeof value === 'string') assert.ok(files.includes('package/' + value.replace(/^\.\//, '')), `Missing export ${value}`)
    else for (const child of Object.values(value)) exported(child)
  }
  exported(manifest.exports)
  const client = execFileSync('tar', ['-xOf', archive, 'package/lib/client.js'], { maxBuffer: 8 * 1024 * 1024 })
  let factory
  runInNewContext(client.toString(), { window: { __ModuleLoader__: { load(entry) { assert.equal(entry.id, id); factory = entry.factory } } } })
  assert.equal(typeof factory, 'function')
  assert.ok(!files.some(file => /PreviewOverlay|panel-dock|use-preview-session|WorkspaceDocsAction|MdChips/.test(file)))
  result.archive = { fileCount: files.length, cleanManifest: true, exportsPresent: true, noSourceMaps: true, lazyFactory: true, clientSha256: digest(client) }

  await command(['plugin', '--profile', 'web', 'add', archive, '--offline'], 'install')
  const dump = await command(['--profile', 'web', '--dump-config'], 'dump-installed')
  assert.ok(dump.includes(id))
  const installed = readFileSync(join(profile, 'node_modules', id, 'lib/client.js'))
  assert.ok(installed.equals(client))
  const importFile = join(profile, 'import-smoke.mjs')
  writeFileSync(importFile, `import assert from 'node:assert/strict';\nconst host = await import('${id}');\nconst remote = await import('${id}/remote');\nassert.equal(typeof host.name, 'string'); assert.equal(typeof host.apply, 'function'); assert.ok(host.inject); assert.ok(host.Config); assert.equal('default' in host, false);\nassert.equal(remote.TYPERT_REMOTE.package, '${id}'); assert.equal(remote.default, remote.TYPERT_REMOTE); assert.deepEqual(remote.TYPERT_REMOTE.descriptors.map(row => row.method), ['read', 'write', 'list', 'search']);\nconsole.log(JSON.stringify({ host: Object.keys(host), remote: Object.keys(remote) }));\n`)
  result.installedMatchesArchive = true
  result.lockSha256 = digest(readFileSync(join(profile, 'pnpm-lock.yaml')))

  const portProbe = createServer()
  await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve))
  const port = portProbe.address().port
  await new Promise(resolve => portProbe.close(resolve))
  result.port = port
  server = start(['--profile', 'web', '--port', String(port), '--no-open'], 'serve-installed')
  result.boot = await http(server, port)
  // The shipped boot layer supplies the profile's platform peers; dump-config only composes YAML.
  result.imports = JSON.parse(execFileSync(process.execPath, [importFile], { cwd: profile, env, encoding: 'utf8' }))
  await stop(server)
  server = null

  await command(['plugin', '--profile', 'web', 'remove', id], 'remove')
  const removedDump = await command(['--profile', 'web', '--dump-config'], 'dump-removed')
  assert.ok(!removedDump.includes(id))
  server = start(['--profile', 'web', '--port', String(port), '--no-open'], 'serve-removed')
  result.removal = await http(server, port, result.boot.url)
  assert.equal(result.boot.entries - result.removal.entries, 1)
  await stop(server)
  server = null
  writeFileSync('/tmp/mdpreview-0110-packed-smoke.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
} finally {
  if (server) await stop(server)
}
