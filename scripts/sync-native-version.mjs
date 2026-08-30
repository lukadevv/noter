/**
 * Copies `package.json`'s version into the desktop shell's config.
 *
 * `package.json` is the one place a release is numbered. Tauri reads its own
 * config before it runs any build command, so this has to happen before the
 * build rather than during it. It rewrites nothing when the two already agree,
 * which is the normal case between version bumps.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = join(ROOT, 'src-tauri/tauri.conf.json')

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const config = readFileSync(CONFIG, 'utf8')

// Rewritten as text rather than re-serialised, so the file keeps its formatting
// and the diff of a version bump is one line.
const updated = config.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`)

if (updated === config) {
  console.log(`src-tauri/tauri.conf.json is already at ${version}`)
} else {
  writeFileSync(CONFIG, updated)
  console.log(`src-tauri/tauri.conf.json set to ${version}`)
}
