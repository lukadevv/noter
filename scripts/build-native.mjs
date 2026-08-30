/**
 * Builds `dist/` for one of the native shells.
 *
 * The only difference from the web build is the Content-Security-Policy meta
 * tag: the desktop shell serves the app over its own protocol and applies the
 * policy declared in `tauri.conf.json`, and a second, browser-shaped policy in
 * the HTML would block the IPC the shell needs. Android keeps the web policy.
 *
 * Vite's `--mode` would be the obvious switch, but it also flips
 * `import.meta.env.DEV`, which would drag development-only branches into a
 * shipped binary. An environment variable keeps the build a production build.
 */
import { spawnSync } from 'node:child_process'

const TARGETS = new Set(['tauri', 'capacitor'])
const target = process.argv[2]

if (!TARGETS.has(target)) {
  console.error(`Usage: node scripts/build-native.mjs <${[...TARGETS].join('|')}>`)
  process.exit(1)
}

const result = spawnSync('pnpm', ['exec', 'vite', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NOTER_NATIVE: target },
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
