<script lang="ts">
  import Sidebar from '$components/Sidebar.svelte'
  import NoteList from '$components/NoteList.svelte'
  import NoteView from '$components/NoteView.svelte'
  import Settings from '$components/Settings.svelte'
  import Toasts from '$components/Toasts.svelte'
  import Lightbox from '$components/Lightbox.svelte'
  import Palette from '$components/Palette.svelte'
  import Lazy from '$components/Lazy.svelte'
  import { notes } from '$lib/stores/notes.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { currentRoute, onRouteChange, replaceRoute, type Route } from './routes/router'
  import { snapshot } from '$lib/db/repo/versions'
  import { purgeExpiredTrash } from '$lib/db/repo/notes'
  import * as notesRepo from '$lib/db/repo/notes'
  import { purgeOrphanAssets, referencedAssetIds } from '$lib/db/repo/assets'
  import { requestPersistence } from '$lib/db/db'
  import { lightbox } from '$lib/stores/lightbox.svelte'
  import { todayKey } from '$lib/db/repo/daily'
  import { applyTokens, clearTokens } from '$lib/theme/apply'
  import { deriveAccentTokens } from '$lib/theme/tokens'
  import { hexToOklch } from '$lib/theme/oklch'

  let settingsOpen = $state(false)
  let paletteOpen = $state(false)
  /** The daily note the user is currently looking at, if any. */
  let openDailyId: string | null = null
  /** Non-null while a shared link is open, which replaces the whole shell. */
  let sharedPayload = $state<string | null>(null)
  /** Set while applying a route, so the reverse sync does not fight it. */
  let applyingRoute = false

  function applyRoute(route: Route) {
    applyingRoute = true
    if (route.kind !== 'share') sharedPayload = null
    switch (route.kind) {
      case 'notes':
        notes.setScope({ kind: 'folder', id: route.folderId })
        notes.select(route.noteId)
        break
      case 'trash':
        notes.setScope({ kind: 'trash' })
        notes.select(route.noteId)
        break
      case 'archive':
        notes.setScope({ kind: 'archive' })
        notes.select(route.noteId)
        break
      case 'tag':
        notes.setScope({ kind: 'tag', tag: route.tag })
        notes.select(route.noteId)
        break
      case 'smart':
        notes.setScope({ kind: 'smart', id: route.id })
        notes.select(route.noteId)
        break
      case 'search':
        notes.setScope({ kind: 'search', query: route.query })
        notes.select(route.noteId)
        break
      case 'settings':
        settingsOpen = true
        break
      case 'share':
        sharedPayload = route.payload
        break
    }
    applyingRoute = false
  }

  $effect(() => {
    const stopLive = notes.start()
    const stopViewport = ui.watchViewport()
    const stopRoute = onRouteChange(applyRoute)

    void theme.load()
    applyRoute(currentRoute())
    void requestPersistence()
    void maybeRunScheduledBackup()
    void purgeExpiredTrash().then(async (count) => {
      if (count > 0) ui.toast(`${count} note(s) past the 30-day retention were purged.`, 'info')
      // Images belonging to purged notes are only unreferenced once those notes
      // are actually gone, so this runs after the trash sweep.
      await purgeOrphanAssets()
    })

    return () => {
      stopLive()
      stopViewport()
      stopRoute()
    }
  })

  /**
   * Runs a scheduled disk backup on startup if one is due. Browsers give a web
   * app no background scheduler, so "daily" means "the first time you open it
   * on a new day" — which is the honest thing to promise.
   */
  async function maybeRunScheduledBackup() {
    // Imported dynamically: the backup layer pulls in the zip and vault codecs,
    // which have no business in the initial payload.
    const { loadBackupState, isDue, runBackup, ensurePermission } = await import('$lib/backup/fsaccess')
    const state = await loadBackupState()
    if (!isDue(state)) return
    if (!(await ensurePermission())) return
    const result = await runBackup()
    if (result.ok) ui.toast('Backup written to your folder.', 'ok')
  }

  async function openToday() {
    const settings = theme.settings.dailyNotes
    if (!settings.enabled) {
      ui.toast('Daily notes are off. Turn them on in Settings.', 'info', {
        label: 'Settings',
        run: () => (settingsOpen = true),
      })
      return
    }
    const note = await notes.openDaily(todayKey(), settings)
    openDailyId = note.id
    if (ui.narrow) ui.showPane('note')
  }

  // A daily note the user opened but never wrote in is removed when they leave
  // it, so the app never accumulates empty dated files.
  $effect(() => {
    const selected = notes.selectedNoteId
    const previous = openDailyId
    if (previous && previous !== selected) {
      openDailyId = null
      void notes.discardEmptyDaily(previous)
    }
  })

  /**
   * Snapshot a note when the user leaves it. Closing a note is the moment its
   * text is most likely to matter later, and the repo declines to store
   * duplicates, so this is cheap.
   */
  let lastOpenNoteId: string | null = null

  $effect(() => {
    const selected = notes.selectedNoteId
    const previous = lastOpenNoteId
    lastOpenNoteId = selected
    if (!previous || previous === selected) return
    // Snapshot the committed text, not whatever was in the database before the
    // last keystroke landed.
    void notes.flushPending().then(async () => {
      const note = await notesRepo.getNote(previous)
      if (note) await snapshot(note)
    })
  })

  // Keep the address bar in step with the selection, so a reload or a bookmark
  // reopens exactly where the user left off.
  $effect(() => {
    const scope = notes.scope
    const noteId = notes.selectedNoteId
    if (applyingRoute || sharedPayload) return
    switch (scope.kind) {
      case 'folder':
        replaceRoute({ kind: 'notes', folderId: scope.id, noteId })
        break
      case 'tag':
        replaceRoute({ kind: 'tag', tag: scope.tag, noteId })
        break
      case 'smart':
        replaceRoute({ kind: 'smart', id: scope.id, noteId })
        break
      case 'search':
        replaceRoute({ kind: 'search', query: scope.query, noteId })
        break
      default:
        replaceRoute({ kind: scope.kind, noteId })
    }
  })

  /**
   * A folder with its own accent tints the interface while you are inside it.
   * Only the accent family is overridden, so surfaces and text still come from
   * the active theme and contrast stays predictable.
   */
  const ACCENT_KEYS = ['accent', 'accent-hover', 'accent-active', 'accent-soft', 'accent-contrast']

  $effect(() => {
    const color = notes.activeFolder?.color ?? null
    const root = document.documentElement
    if (!color) {
      clearTokens(ACCENT_KEYS, root)
      return
    }
    const parsed = hexToOklch(color)
    if (!parsed) return
    const mode = theme.tokens['color-scheme'] === 'light' ? 'light' : 'dark'
    applyTokens(deriveAccentTokens(parsed, mode), root)
    return () => clearTokens(ACCENT_KEYS, root)
  })

  /** Nothing may be lost on tab switch, navigation away or app close. */
  function flushAll() {
    // Fire-and-forget by necessity: an unload handler cannot await an IndexedDB
    // transaction. `visibilitychange` fires first and is the one that reliably
    // completes, which is why all three are wired up.
    void notes.flushPending()
    theme.flush()
  }

  /**
   * Images rendered inside the editor are CodeMirror widgets, outside Svelte's
   * tree, so their clicks are caught here rather than by a component handler.
   */
  function onImageClick(event: MouseEvent) {
    const target = event.target
    if (!(target instanceof HTMLImageElement)) return
    const assetId = target.dataset.asset
    if (!assetId || !target.closest('.cm-editor')) return
    const body = notes.activeNote?.body ?? ''
    lightbox.show(referencedAssetIds(body), assetId)
  }

  function onKeydown(event: KeyboardEvent) {
    const meta = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()

    if (meta && key === 'k') {
      event.preventDefault()
      paletteOpen = !paletteOpen
      return
    }
    if (meta && key === 'n' && !event.shiftKey) {
      event.preventDefault()
      void notes.newNote()
      return
    }
    if (meta && key === ',') {
      event.preventDefault()
      settingsOpen = true
      return
    }
    if (meta && event.shiftKey && key === 'd') {
      event.preventDefault()
      void openToday()
      return
    }
    if (meta && event.shiftKey && event.code === 'Space') {
      event.preventDefault()
      void notes.openScratchpad().then((note) => {
        notes.select(note.id)
        if (ui.narrow) ui.showPane('note')
      })
      return
    }
    if (event.key === 'Escape') {
      if (paletteOpen) paletteOpen = false
      else if (settingsOpen) settingsOpen = false
    }
  }
</script>

<svelte:window
  onkeydown={onKeydown}
  onclick={onImageClick}
  onbeforeunload={flushAll}
  onpagehide={flushAll}
  onvisibilitychange={() => {
    if (document.visibilityState === 'hidden') flushAll()
  }}
/>

{#if sharedPayload}
  <!-- Reading a shared link is a rare path, so its decoder is fetched on demand. -->
  <Lazy load={() => import('$components/SharedNote.svelte')} props={{ payload: sharedPayload }} />
{:else}
<div
  class="shell"
  data-testid="app-shell"
  class:shell--narrow={ui.narrow}
  data-pane={ui.pane}
  style="--sidebar-w: {theme.settings.sidebarWidth}px; --list-w: {theme.settings.listWidth}px"
>
  <div class="pane pane--folders">
    <Sidebar
      onopensettings={() => (settingsOpen = true)}
      onopenpalette={() => (paletteOpen = true)}
    />
  </div>
  <div class="pane pane--list">
    <NoteList />
  </div>
  <div class="pane pane--note">
    <NoteView />
  </div>
</div>
{/if}

{#if paletteOpen}
  <Palette
    onclose={() => (paletteOpen = false)}
    onsettings={() => (settingsOpen = true)}
    ondaily={() => void openToday()}
  />
{/if}

{#if settingsOpen}
  <Settings onclose={() => (settingsOpen = false)} />
{/if}

<Lightbox />
<Toasts />

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-w) var(--list-w) minmax(0, 1fr);
    height: 100dvh;
    overflow: hidden;
  }

  .pane {
    min-width: 0;
    min-height: 0;
  }

  /* Narrow layout: one pane at a time, driven by ui.pane. */
  .shell--narrow {
    grid-template-columns: 1fr;
  }

  .shell--narrow .pane {
    display: none;
  }

  .shell--narrow[data-pane='folders'] .pane--folders,
  .shell--narrow[data-pane='list'] .pane--list,
  .shell--narrow[data-pane='note'] .pane--note {
    display: block;
  }
</style>
