# Noter

A local-first note-taking PWA. Everything runs in the browser: notes live in
IndexedDB, the build is a folder of static files, and there is no server to talk
to. Install it, go offline, keep writing.

## Features

**Writing**

- Markdown notes in a CodeMirror 6 editor, with a sanitised reading view
- Five views over the same markdown — document, checklist, board, gallery, code —
  so a note can change shape without changing format
- Interactive checkboxes in both the editor and the reading view
- A kanban board built from `##` headings and list items, with drag-and-drop
- Images from a paste, a drop, a file picker, or a pasted URL; every image is
  re-encoded to WebP, thumbnailed and deduplicated by hash
- Full-screen image viewer with zoom, pan and copy

**Organising**

- Nested folders with drag-and-drop reordering and inline rename
- `#tags` read straight out of the text, with autocompletion
- `[[Wiki links]]` with autocompletion, note creation on click, and backlinks
- Pin, archive, and a trash with a 30-day retention window
- Multi-select with bulk move, pin, archive and delete
- Saved searches (`tag:bug AND is:todo AND modified:<7d`) that live in the sidebar
  as smart folders
- Templates, and daily notes that are **off by default** and created only when opened

**Finding**

- `Ctrl+K` command palette: notes, commands, tags and structured queries in one place
- Full-text search (MiniSearch) indexed incrementally in idle time
- A small query language: `tag:`, `folder:`, `view:`, `is:`, `has:`, `modified:`,
  with `AND` / `OR` / `NOT` and parentheses

**Making it yours**

- Eight built-in themes plus a theme editor that derives ~30 tokens from four
  colours in OKLCH, with live WCAG contrast checks
- Custom themes are saved, exported and imported as JSON
- Icon picker over the full Lucide catalogue (~2000 icons) plus emoji
- Per-folder accent colours that tint the interface while you are inside a folder
- Density, font family, editor text size, corner radius, reduced motion

**Keeping your data**

- Portable `.noter` vault: the whole workspace in one binary file, optionally
  encrypted with AES-GCM, for moving between computers
- Markdown archive: a zip of readable `.md` files with front matter, plus the images
- Automatic backups to a real folder on disk (Chrome and Edge)
- Per-note version history with a line diff and restore
- Per-folder encryption; keys live in memory only and expire after 15 idle minutes
- Share a note as a link with no server: the text is compressed into the URL
  fragment. Images are never included — even as thumbnails they would push the
  link past the length chat apps and browsers truncate at

## Getting started

This project uses **pnpm**. The version is pinned in `package.json`, so the
simplest way to get the right one is Corepack, which ships with Node:

```bash
corepack enable
pnpm install
pnpm dev
```

Other package managers are rejected by a `preinstall` guard
(`scripts/only-pnpm.mjs`). That is not gatekeeping: the lockfile is
`pnpm-lock.yaml`, and pnpm's symlinked `node_modules` layout surfaces missing
dependency declarations that npm's flat layout hides. An install from npm or
yarn would build something that does not match CI.

## Commands

| Command                      | What it does                                                     |
| ---------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                   | Dev server with hot reload                                       |
| `pnpm build`                 | Type-check, build to `dist/`, and enforce the bundle budget      |
| `pnpm build:fast`            | Build without the type-check and budget gate                     |
| `pnpm preview`               | Serve the production build locally                               |
| `pnpm check`                 | `svelte-check` over the whole project                            |
| `pnpm test`                  | Unit tests (Vitest)                                              |
| `pnpm test:e2e`              | End-to-end tests (Playwright)                                    |
| `pnpm test:e2e:ui`           | Playwright's interactive runner                                  |
| `pnpm test:all`              | Unit tests, then end-to-end                                      |
| `node scripts/gen-icons.mjs` | Regenerate every icon and the social card from `assets/logo.png` |
| `pnpm desktop:dev`           | Run the app in the desktop shell, with hot reload                |
| `pnpm desktop:build`         | Build the desktop installers for the current platform            |
| `pnpm android:sync`          | Build the web assets and copy them into the Android project      |
| `pnpm android:open`          | Open the Android project in Android Studio                       |

Run one-off binaries with `pnpm exec`, never `npx`. The first e2e run needs the
browser: `pnpm exec playwright install chromium`.

## Keyboard

| Shortcut           | Action             |
| ------------------ | ------------------ |
| `Ctrl+K`           | Command palette    |
| `Ctrl+N`           | New note           |
| `Ctrl+,`           | Settings           |
| `Ctrl+Shift+D`     | Today's daily note |
| `Ctrl+Shift+Space` | Scratchpad         |

## Architecture

```
src/
  lib/
    db/       Dexie schema and repositories (the only code that touches IndexedDB)
    md/       Markdown rendering, tasks, boards, tags and wiki-links
    editor/   CodeMirror setup and decorations, loaded through a dynamic import
    images/   Ingest, WebP re-encoding, thumbnails, object-URL cache
    search/   Query language, evaluator, MiniSearch index
    theme/    OKLCH colour maths, token derivation, presets
    crypto/   PBKDF2 + AES-GCM, and the in-memory keyring
    backup/   Markdown archive, portable vault, File System Access
    share/    URL-fragment encoding
    stores/   Svelte 5 rune stores: notes, theme, UI, lightbox
  components/ UI
  routes/     Hash router
```

Four conventions hold the project together:

1. **No component hardcodes a colour.** Every value resolves through a CSS custom
   property declared in `src/app.css` and written at runtime by
   `src/lib/theme/apply.ts`. That is what makes runtime theming possible.
2. **Only `src/lib/db/` talks to IndexedDB.** Components go through the stores,
   stores go through the repositories.
3. **The markdown is the source of truth.** Tags, tasks, boards, galleries and
   links are all read out of the text. `Note.tags` is a denormalised copy that
   exists only so IndexedDB can index it.
4. **Anything heavy is behind a dynamic import.** The editor, the markdown
   renderer, the icon catalogue, the backup codecs and the share encoder are all
   separate chunks.

## Testing

**Unit tests** (`tests/`, Vitest) cover the pure logic and the database layer:
the query language, markdown and board parsing, OKLCH colour maths, fractional
ordering, the crypto envelope, the vault file format, and the repositories
against `fake-indexeddb`.

**End-to-end tests** (`e2e/`, Playwright) drive the real app in Chromium against
the production build, so the service worker, the injected CSP and the code-split
chunks are all exercised as they ship:

| Spec                 | What it covers                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `notes.spec.ts`      | Notes and folders, trash, archive, pinning, bulk actions, persistence across reloads           |
| `images.spec.ts`     | Paste-to-store pipeline, deduplication, gallery, lightbox, orphan cleanup                      |
| `search.spec.ts`     | Command palette, tags, structured queries, smart folders, wiki-links, backlinks, completion    |
| `crypto.spec.ts`     | Folder encryption, unlock, wrong passphrase, and that no plaintext leaks into IndexedDB        |
| `backup.spec.ts`     | Vault round-trip into a clean browser, merge semantics, Markdown archive, history, share links |
| `offline.spec.ts`    | Offline reload, cached manifest, CSP, and that heavy chunks stay lazy                          |
| `responsive.spec.ts` | Single-pane stack on a phone viewport (runs under the `mobile` project)                        |

Two conventions keep the suite honest:

- **Wait on state, never on time.** `settleAutosave` reads IndexedDB directly
  rather than trusting the note list, because the list updates optimistically
  while the write is on a 400 ms debounce — waiting on the DOM alone races it.
- **Assert on effects, not on appearances.** The encryption spec greps the object
  store for a canary string; the lazy-loading spec watches network requests; the
  backup spec restores into a brand-new browser context with an empty origin.

`E2E_DEV=1 pnpm test:e2e` runs against the dev server instead, which is faster
when iterating (the offline spec skips itself there, since there is no service
worker).

**Linting and formatting** are split: ESLint covers what a type checker does not
see — unsafe patterns, dead code, accessibility in markup — while Prettier owns
formatting entirely. `pnpm verify` runs everything CI runs except the browser
suite.

## Branding assets

`assets/logo.png` is the only artwork maintained by hand. Everything under
`public/` is generated from it by `scripts/gen-icons.mjs` and committed, so a
clone builds without any image tooling:

| Output                                                        | Used for                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `favicon.ico`, `icons/favicon-16.png`, `icons/favicon-32.png` | Browser tabs and OS shortcuts                                    |
| `icons/icon-192.png`, `icons/icon-512.png`                    | PWA icons with `purpose: any`                                    |
| `icons/maskable-192.png`, `icons/maskable-512.png`            | Android, which crops to its own shape                            |
| `icons/apple-touch-icon.png`                                  | iOS home screen (opaque; iOS composites transparency onto black) |
| `icons/logo-64.png`                                           | The brand mark in the sidebar                                    |
| `android/…/mipmap-*/ic_launcher*.png`                         | The Android launcher, flat and adaptive layers                   |
| `og.png`                                                      | Link previews (1200×630)                                         |

The maskable and Apple icons are full-bleed: those platforms apply their own
mask, so an icon with rounded corners of its own gets clipped twice and looks
smaller than its neighbours. Their corners are filled by extrapolating the logo's
own gradient rather than by inventing a background, which is what keeps the join
invisible.

Regenerating needs ImageMagick (`sudo apt install imagemagick` /
`brew install imagemagick`); the script says so if it is missing.

The desktop shell keeps its own set, in the `.ico` and `.icns` containers
Windows and macOS want. Those come from Tauri's own converter and change only
when the logo does:

```bash
pnpm exec tauri icon assets/logo.png -o src-tauri/icons
```

**Link previews need an absolute URL.** Set `VITE_SITE_URL` when building for a
real deployment:

```bash
VITE_SITE_URL=https://your-domain.example pnpm build
```

Without it the Open Graph tags fall back to relative paths, which most scrapers
ignore — previews simply do not appear, rather than pointing somewhere wrong.

## Search engines

The build emits everything a crawler needs, all of it derived from
`src/lib/seo.ts` so the description and feature list live in one place:

- **JSON-LD** describing the app as a `SoftwareApplication`, including the
  explicit zero-price offer that marks it as free, the ten supported languages,
  and a feature list
- **Open Graph and Twitter** tags with a 1200×630 card, plus `og:locale`
  alternates for every language
- **`robots.txt`** and a one-entry **`sitemap.xml`**, both with the origin filled
  in at build time
- A **canonical link**, emitted only when `VITE_SITE_URL` is set

There is deliberately no `hreflang`: the interface language is a per-visitor
setting, not a URL, so advertising per-language addresses would promise pages
that do not exist.

**Google Search Console.** Either set `VITE_GOOGLE_SITE_VERIFICATION` to the
token from the HTML-tag method — the tag is only emitted when it has a value —
or drop Google's verification HTML file into `public/`, from where it ships at
the site root. Submit `https://your-domain/sitemap.xml` once verified.

## Bundle budget

`pnpm build` fails if the initial payload exceeds 150 KB gzipped.
`scripts/check-budget.mjs` reads `dist/index.html` to tell the initial payload from
lazily loaded chunks and prints both.

## Your data

Notes are stored in IndexedDB under this site's origin. The app requests persistent
storage on startup, but browsers can still evict it — Safari clears it after seven
days without a visit. **Set up a backup**: either point Noter at a folder on disk
(Settings ▸ Automatic backups, Chrome and Edge only) or export a vault file
regularly. A reminder appears once the last backup is more than two weeks old.

Folder encryption uses PBKDF2-SHA256 (310,000 iterations) and AES-GCM. The
passphrase is never stored anywhere, which means there is no recovery path: forget
it and those notes are gone.

## Deploying

`pnpm build` produces `dist/`, which is plain static files — any static host will
do. The app uses hash routing, so no rewrite rules are needed.

`public/_headers` carries the response headers that a `<meta>` tag cannot set:
`frame-ancestors`, which browsers ignore in markup, and `Cache-Control: no-cache`
on `sw.js`, without which a client can get stuck on an old service worker
indefinitely. Cloudflare Pages and Netlify read that file directly; on other
hosts, translate it into their configuration.

### Cloudflare Pages

`.github/workflows/ci.yml` deploys on every push to `main`, but only after lint,
types, the bundle budget, unit tests and the end-to-end suite have all passed.

Configure these in the repository's **Settings → Secrets and variables → Actions**:

| Kind     | Name                      | Value                                                |
| -------- | ------------------------- | ---------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`    | A token with the _Cloudflare Pages: Edit_ permission |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`   | From the Cloudflare dashboard sidebar                |
| Variable | `CLOUDFLARE_PROJECT_NAME` | The Pages project name, e.g. `noter`                 |
| Variable | `SITE_URL`                | The deployed origin, e.g. `https://noter.pages.dev`  |

`SITE_URL` only affects link previews. Everything else works without it — see
`.env.example`, which documents every variable the build reads.

Create the Pages project once (dashboard → Workers & Pages → Create → Pages →
_Direct Upload_); the workflow uploads to it from then on, so Cloudflare never
needs to build the project itself.

## Downloadable builds

The website is the whole app, so the desktop and Android builds are that same
`dist/` folder loaded from local storage instead of over the network, inside a
system webview. There is no second implementation to keep in step — only a shell
around the one that already exists.

| Target                | Shell                  | Output                                           |
| --------------------- | ---------------------- | ------------------------------------------------ |
| Windows, macOS, Linux | Tauri 2 (`src-tauri/`) | `.exe`/`.msi`, `.dmg`, `.AppImage`/`.deb`/`.rpm` |
| Android               | Capacitor (`android/`) | `.apk` to sideload, `.aab` for the Play Store    |

iOS is deliberately absent. Apple allows no distribution outside the App Store,
so an `.ipa` on a releases page would be a file nobody could install; on iOS the
PWA installed from Safari is the native build.

### What changes inside a shell

Three things, all in `src/lib/platform/`:

- **Saving files.** A webview has no download manager behind an `<a download>`
  link — clicking one does nothing at all. Exports go through a save dialog on
  the desktop and the share sheet on Android, which is what lets a file reach
  Downloads or Drive from a sandboxed app without asking for storage permissions.
- **The service worker** is not registered. The shell already carries the whole
  app on disk; a second, staler copy that outlives the installer helps nobody.
- **The Content-Security-Policy** meta tag is left out of the desktop build,
  because Tauri applies the policy from `tauri.conf.json` and that one has to
  allow the IPC protocol the browser policy knows nothing about. Android keeps
  the web policy unchanged.

Automatic backups to a folder use the File System Access API, which no webview
outside Chromium implements. The app already treats that as an optional
capability and falls back to manual exports, so the shells simply take the path
Firefox and Safari take.

### Building locally

The desktop shell needs a [Rust toolchain](https://rustup.rs) and, on Linux, the
webview development packages (`libwebkit2gtk-4.1-dev`, `librsvg2-dev`,
`libxdo-dev`, `patchelf`, `build-essential`). Then:

```bash
pnpm desktop:dev      # hot reload, Vite behind a native window
pnpm desktop:build    # installers in src-tauri/target/release/bundle/
```

The Android shell needs JDK 21 and the Android SDK — installing Android Studio
gets both:

```bash
pnpm android:sync     # build dist/ and copy it into android/
pnpm android:open     # then run or build from Android Studio
```

Version numbers come from `package.json` alone: `scripts/sync-native-version.mjs`
stamps it into `tauri.conf.json`, and `android/app/build.gradle` reads it
directly, packing `1.4.2` into the always-increasing `versionCode` 10402 that
Android requires.

### Cutting a release

Bump `version` in `package.json`, commit, and push a matching tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

`.github/workflows/release.yml` takes it from there. It refuses tags that
disagree with `package.json`, creates one draft release, builds Linux, Windows
and a universal macOS binary in parallel, adds the Android artefacts, and only
then publishes the release. Nothing appears half-finished on the releases page,
because the draft is what everything uploads into.

**Android needs a signing key**, and the same one every time: Android will only
install an update over a package signed with the key the previous one used, so a
key generated per build would strand everyone who installed the last release.
Create one once, keep it somewhere safe, and never commit it:

```bash
keytool -genkeypair -v -keystore noter.keystore -alias noter \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 noter.keystore    # the value for the secret below
```

| Secret                      | Value                             |
| --------------------------- | --------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | The keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password             |
| `ANDROID_KEY_ALIAS`         | The key alias, e.g. `noter`       |
| `ANDROID_KEY_PASSWORD`      | The key password                  |

Without them the Android job logs a warning and stops, and the release still
ships its desktop builds.

**The desktop builds are not code-signed.** Windows shows a SmartScreen warning
until the download builds reputation, and macOS asks for the app to be opened
from its right-click menu the first time. Signing them means an Apple Developer
membership and a Windows certificate — a running yearly cost, not a code change,
and the release notes say plainly what to expect until then.
