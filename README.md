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
- Share a note as a link with no server: the note is compressed into the URL fragment

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

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Type-check, build to `dist/`, and enforce the bundle budget |
| `pnpm build:fast` | Build without the type-check and budget gate |
| `pnpm preview` | Serve the production build locally |
| `pnpm check` | `svelte-check` over the whole project |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright) |
| `pnpm test:e2e:ui` | Playwright's interactive runner |
| `pnpm test:all` | Unit tests, then end-to-end |
| `node scripts/gen-icons.mjs` | Regenerate the PWA icons |

Run one-off binaries with `pnpm exec`, never `npx`. The first e2e run needs the
browser: `pnpm exec playwright install chromium`.

## Keyboard

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Command palette |
| `Ctrl+N` | New note |
| `Ctrl+,` | Settings |
| `Ctrl+Shift+D` | Today's daily note |
| `Ctrl+Shift+Space` | Scratchpad |

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

| Spec | What it covers |
|---|---|
| `notes.spec.ts` | Notes and folders, trash, archive, pinning, bulk actions, persistence across reloads |
| `images.spec.ts` | Paste-to-store pipeline, deduplication, gallery, lightbox, orphan cleanup |
| `search.spec.ts` | Command palette, tags, structured queries, smart folders, wiki-links, backlinks, completion |
| `crypto.spec.ts` | Folder encryption, unlock, wrong passphrase, and that no plaintext leaks into IndexedDB |
| `backup.spec.ts` | Vault round-trip into a clean browser, merge semantics, Markdown archive, history, share links |
| `offline.spec.ts` | Offline reload, cached manifest, CSP, and that heavy chunks stay lazy |
| `responsive.spec.ts` | Single-pane stack on a phone viewport (runs under the `mobile` project) |

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
do. Two things are worth configuring on the server:

- **`frame-ancestors`**: the build injects a Content-Security-Policy `<meta>` tag,
  but browsers ignore `frame-ancestors` there. Send it as a response header
  (`Content-Security-Policy: frame-ancestors 'none'`) to block framing.
- **Service worker scope**: `sw.js` must be served from the site root with
  `Cache-Control: no-cache`, otherwise clients can get stuck on an old worker.

The app uses hash routing, so no rewrite rules are needed.
