<script lang="ts">
  import NotesShell from '$components/shell/NotesShell.svelte'
  import NavRail from '$components/shell/NavRail.svelte'
  import BottomBar from '$components/shell/BottomBar.svelte'
  import Skeleton from '$components/ui/Skeleton.svelte'
  import Toasts from '$components/Toasts.svelte'
  import Lightbox from '$components/Lightbox.svelte'
  import Lazy from '$components/Lazy.svelte'
  import ContextMenu from '$components/ContextMenu.svelte'
  import { dialogs } from '$lib/stores/dialogs.svelte'
  import { notes } from '$lib/stores/notes.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { SECTIONS } from '$lib/sections'
  import { ui } from '$lib/stores/ui.svelte'
  import {
    ALL_NOTES,
    currentRoute,
    onRouteChange,
    replaceRoute,
    sectionOf,
    type Route,
  } from './routes/router'
  import { goTo, openSettings } from '$lib/nav'
  import { fadeIn } from '$lib/ui/motion.svelte'
  import { snapshot } from '$lib/db/repo/versions'
  import { purgeExpiredTrash } from '$lib/db/repo/notes'
  import * as notesRepo from '$lib/db/repo/notes'
  import { purgeOrphanAssets, referencedAssetIds } from '$lib/db/repo/assets'
  import { requestPersistence } from '$lib/db/db'
  import { lightbox } from '$lib/stores/lightbox.svelte'
  import { todayKey } from '$lib/db/repo/daily'
  import { t } from '$lib/i18n/index.svelte'
  import { applyTokens, clearTokens } from '$lib/theme/apply'
  import { deriveAccentTokens } from '$lib/theme/tokens'
  import { hexToOklch } from '$lib/theme/oklch'
  import { FolderLockedError } from '$lib/crypto/keyring.svelte'

  let paletteOpen = $state(false)
  /** The reminder engine has loaded, so the ringing dialog can be mounted. */
  let remindersReady = $state(false)
  /** The daily note the user is currently looking at, if any. */
  let openDailyId: string | null = null
  /** Non-null while a shared link is open, which replaces the whole shell. */
  let sharedPayload = $state<string | null>(null)
  /** Set while applying a route, so the reverse sync does not fight it. */
  let applyingRoute = false

  function applyRoute(route: Route) {
    applyingRoute = true
    if (route.kind !== 'share') sharedPayload = null
    const section = sectionOf(route)
    if (section) ui.section = section
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
        ui.section = 'settings'
        ui.settingsSection = route.section
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

    // Opening the app with no address shows the start section the user chose.
    // Settings are loaded first so that choice is known before the first route.
    void theme.load().then(() => {
      if (!location.hash && theme.settings.startSection === 'notes') replaceRoute(ALL_NOTES)
      applyRoute(currentRoute())
    })
    applyRoute(currentRoute())
    void requestPersistence()
    // Timers ring from any section, so their engine starts with the app — but
    // at idle, after the first paint, and from its own chunk.
    const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 800))
    idle(() => {
      void import('$lib/timers/store.svelte').then(({ timers }) => {
        timers.start()
        remindersReady = true
      })
    })
    void maybeRunScheduledBackup()
    void purgeExpiredTrash().then(async (count) => {
      if (count > 0) ui.toast(t('toast.trashPurged', { count }), 'info')
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
    if (result.vaultSkipped) ui.toast(t('toast.backupNeedsPassphrase'), 'warn')
    else if (result.ok) ui.toast(t('toast.backupWritten'), 'ok')
  }

  async function openToday() {
    const settings = theme.settings.dailyNotes
    if (!settings.enabled) {
      ui.toast(t('toast.dailyOff'), 'info', {
        label: t('sidebar.settings'),
        run: () => openSettings('daily'),
      })
      return
    }
    const note = await notes.openDaily(todayKey(), settings)
    openDailyId = note.id
    goTo('notes')
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
    // Only while the notes are on screen: elsewhere this would drag the
    // address back to a notes route and throw the user out of their section.
    if (applyingRoute || sharedPayload || ui.section !== 'notes') return
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
      void newNote()
      return
    }
    if (meta && key === ',') {
      event.preventDefault()
      openSettings()
      return
    }
    if (meta && key === '\\') {
      event.preventDefault()
      theme.update({ sidebarCollapsed: !theme.settings.sidebarCollapsed })
      return
    }
    if (meta && !event.shiftKey && !event.altKey && /^[1-9]$/.test(event.key)) {
      const entry = SECTIONS[Number(event.key) - 1]
      if (entry) {
        event.preventDefault()
        goTo(entry.id)
      }
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
        goTo('notes')
        if (ui.narrow) ui.showPane('note')
      })
      return
    }
    if (event.key === 'Escape' && paletteOpen) paletteOpen = false
  }

  /** New notes always land in the notes section, wherever they were started from. */
  async function newNote() {
    await notes.newNote()
    if (ui.narrow) ui.showPane('note')
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
  onunhandledrejection={(event) => {
    // A locked folder refusing a new or moved note is an expected outcome of
    // many different buttons; one handler turns it into a message for all.
    if (event.reason instanceof FolderLockedError) {
      event.preventDefault()
      ui.toast(t('toast.folderLocked'), 'warn')
    }
  }}
/>

{#if sharedPayload}
  <!-- Reading a shared link is a rare path, so its decoder is fetched on demand. -->
  <Lazy load={() => import('$components/SharedNote.svelte')} props={{ payload: sharedPayload }} />
{:else}
  <div class="app" class:app--narrow={ui.narrow} data-testid="app-shell">
    {#if !ui.narrow}
      <NavRail onsearch={() => (paletteOpen = true)} />
    {/if}

    <main class="content">
      <!-- The notes stay mounted while other sections are open, so the editor
           keeps its cursor, scroll and undo history across a trip to Home. -->
      <div class="section" class:section--hidden={ui.section !== 'notes'} inert={ui.section !== 'notes'}>
        <NotesShell onopenpalette={() => (paletteOpen = true)} />
      </div>

      {#key ui.section}
        {#if ui.section !== 'notes'}
          <div class="section section--scroll" in:fadeIn={{ duration: 140 }}>
            {#if ui.section === 'home'}
              <Lazy
                load={() => import('$components/sections/Home.svelte')}
                props={{
                  onnewnote: () => void newNote(),
                  ontoday: () => void openToday(),
                  onsearch: () => (paletteOpen = true),
                }}
              >
                {#snippet fallback()}<Skeleton rows={6} />{/snippet}
              </Lazy>
            {:else if ui.section === 'timers'}
              <Lazy load={() => import('$components/sections/Timers.svelte')}>
                {#snippet fallback()}<Skeleton rows={6} />{/snippet}
              </Lazy>
            {:else if ui.section === 'settings'}
              <Lazy load={() => import('$components/settings/SettingsPage.svelte')}>
                {#snippet fallback()}<Skeleton rows={6} />{/snippet}
              </Lazy>
            {/if}
          </div>
        {/if}
      {/key}
    </main>

    {#if ui.narrow && !(ui.section === 'notes' && ui.pane === 'note')}
      <BottomBar />
    {/if}
  </div>
{/if}

{#if paletteOpen}
  <Lazy
    load={() => import('$components/Palette.svelte')}
    props={{
      onclose: () => (paletteOpen = false),
      onsettings: () => openSettings(),
      ondaily: () => void openToday(),
    }}
  />
{/if}

{#if dialogs.current?.kind === 'folderStyle' || dialogs.current?.kind === 'folderLock'}
  {@const kind = dialogs.current.kind}
  {@const folder = notes.folders.find((f) => f.id === dialogs.current?.id)}
  {#if folder}
    <Lazy
      load={() =>
        kind === 'folderStyle'
          ? import('$components/FolderStyle.svelte')
          : import('$components/FolderLock.svelte')}
      props={{ folder, onclose: () => dialogs.close() }}
    />
  {/if}
{/if}

{#if remindersReady}
  <!-- Rings over any section; loaded once the reminder engine is up. -->
  <Lazy load={() => import('$components/timers/RingingDialog.svelte')} />
{/if}

<ContextMenu />
<Lightbox />
<Toasts />

<style>
  .app {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    height: 100dvh;
    overflow: hidden;
  }

  .app--narrow {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .content {
    position: relative;
    min-width: 0;
    min-height: 0;
  }

  .section {
    position: absolute;
    inset: 0;
  }

  .section--hidden {
    visibility: hidden;
  }

  .section--scroll {
    overflow-y: auto;
    background: var(--bg);
  }
</style>
