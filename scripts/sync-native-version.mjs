/**
 * Copies `package.json`'s version into the desktop shell's config and crate.
 *
 * `package.json` is the one place a release is numbered. Tauri reads its own
 * config before it runs any build command, so this has to happen before the
 * build rather than during it. It rewrites nothing when the files already
 * agree, which is the normal case between version bumps.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

// Rewritten as text rather than re-serialised, so each file keeps its
// formatting and the diff of a version bump is one line per file.
const TARGETS = [
  ['src-tauri/tauri.conf.json', /("version":\s*")[^"]*(")/],
  ['src-tauri/Cargo.toml', /^(version = ")[^"]*(")/m],
  // The lockfile records the crate's own version too; keep it in step so a
  // `--locked` build does not fail on the mismatch.
  ['src-tauri/Cargo.lock', /(name = "noter"\nversion = ")[^"]*(")/],
]

for (const [file, pattern] of TARGETS) {
  const path = join(ROOT, file)
  const text = readFileSync(path, 'utf8')
  const updated = text.replace(pattern, `$1${version}$2`)
  if (updated === text) {
    console.log(`${file} is already at ${version}`)
  } else {
    writeFileSync(path, updated)
    console.log(`${file} set to ${version}`)
  }
}
