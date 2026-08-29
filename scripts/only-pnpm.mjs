/**
 * Refuses installs from anything but pnpm.
 *
 * Without this, `npm install` succeeds quietly: it writes a `package-lock.json`
 * nobody reads and builds a flat `node_modules` that behaves differently from
 * the one the lockfile describes. Failing loudly here is far cheaper than
 * debugging that later.
 *
 * Package managers announce themselves through `npm_config_user_agent`, which
 * npm, pnpm and yarn all set. When it is absent the script does nothing: that
 * means it was run directly rather than as a lifecycle hook.
 */
const agent = process.env.npm_config_user_agent ?? ''

if (!agent) process.exit(0)

const name = agent.split('/')[0]

if (name !== 'pnpm') {
  const used = name || 'that package manager'
  console.error(`
  This project uses pnpm, and ${used} was used instead.

  The lockfile is pnpm-lock.yaml and the dependency layout depends on pnpm's
  node_modules structure, so another package manager will produce a build that
  does not match CI.

      corepack enable          # once, to get the pinned pnpm
      pnpm install

  Install pnpm: https://pnpm.io/installation
`)
  process.exit(1)
}
