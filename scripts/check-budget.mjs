/**
 * Fails the build when the initial payload outgrows its budget.
 *
 * "Initial" means what the browser must download before the app is usable: the
 * entry chunk, the stylesheet, and anything statically imported by them. Lazily
 * imported chunks (CodeMirror, the icon sprite, backup tooling) are reported for
 * visibility but deliberately excluded.
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const BUDGET_BYTES = 150 * 1024

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

/**
 * The initial payload is whatever index.html itself pulls in: the entry module,
 * its preloaded static imports, and the stylesheet. Reading the HTML rather than
 * the manifest keeps this honest when `cssCodeSplit: false` detaches the CSS
 * from the entry chunk record.
 */
const html = readFileSync(join(DIST, 'index.html'), 'utf8')

const entryFiles = new Set()
for (const pattern of [
  /<script[^>]+src="\/?([^"]+\.js)"/g,
  /<link[^>]+rel="modulepreload"[^>]+href="\/?([^"]+\.js)"/g,
  /<link[^>]+rel="stylesheet"[^>]+href="\/?([^"]+\.css)"/g,
]) {
  for (const match of html.matchAll(pattern)) entryFiles.add(match[1])
}

try {
  const manifest = JSON.parse(readFileSync(join(DIST, '.vite', 'manifest.json'), 'utf8'))
  const entry = Object.values(manifest).find((c) => c.isEntry)
  const visit = (key) => {
    const chunk = manifest[key]
    if (!chunk || entryFiles.has(chunk.file)) return
    entryFiles.add(chunk.file)
    for (const css of chunk.css ?? []) entryFiles.add(css)
    for (const next of chunk.imports ?? []) visit(next)
  }
  if (entry) {
    entryFiles.add(entry.file)
    for (const css of entry.css ?? []) entryFiles.add(css)
    for (const key of entry.imports ?? []) visit(key)
  }
} catch {
  // The manifest is optional; the HTML scan above already covers the essentials.
}

const files = walk(DIST).filter((f) => /\.(js|css)$/.test(f))

let initial = 0
const rows = []

for (const file of files) {
  const relative = file.slice(DIST.length + 1)
  const gz = gzipSync(readFileSync(file)).length
  const isInitial = entryFiles.has(relative)
  if (isInitial) initial += gz
  rows.push({ relative, gz, isInitial })
}

rows.sort((a, b) => b.gz - a.gz)

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

console.log('\nBundle (gzipped)')
for (const row of rows) {
  console.log(`  ${row.isInitial ? '*' : ' '} ${kb(row.gz).padStart(9)}  ${row.relative}`)
}
console.log('  * = part of the initial payload\n')
console.log(`Initial payload: ${kb(initial)} / ${kb(BUDGET_BYTES)} budget`)

if (initial > BUDGET_BYTES) {
  console.error(
    `\nBudget exceeded by ${kb(initial - BUDGET_BYTES)}. Move something behind a dynamic import.`,
  )
  process.exit(1)
}

console.log('Within budget.\n')
