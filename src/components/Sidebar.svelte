<script lang="ts">
  import Icon from './Icon.svelte'
  import Logo from './Logo.svelte'
  import FolderRow from './FolderRow.svelte'
  import NoteTreeRow from './NoteTreeRow.svelte'
  import { untrack } from 'svelte'
  import { sortForList } from '$lib/db/repo/notes'
  import type { FolderNode } from '$lib/db/repo/folders'
  import type { Note } from '$lib/db/schema'
  import type { DropPosition } from '$lib/ui-types'
  import { notes } from '$lib/stores/notes.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { ROOT } from '$lib/db/schema'
  import { neighboursFor } from '$lib/db/repo/folders'
  import { nudge, smartFolderMenuItems, tagMenuItems, treeMenuItems } from '$lib/menus/folder'
  import { contextmenu } from '$lib/ui/contextmenu'
  import { t } from '$lib/i18n/index.svelte'
  import Kbd from './ui/Kbd.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { openSettings } from '$lib/nav'

  interface Props {
    onopenpalette: () => void
  }

  let { onopenpalette }: Props = $props()

  let tagsOpen = $state(true)

  let hover = $state<{ id: string | null; position: DropPosition | null }>({ id: null, position: null })

  let scope = $derived(notes.scope)

  function selectFolder(id: string | null) {
    notes.setScope({ kind: 'folder', id })
    if (id && showNotes) setNotesOpen(id, true)
    if (ui.narrow) ui.showPane('list')
  }

  // --- Notes in the tree ---------------------------------------------------

  let showNotes = $derived(theme.settings.showNotesInTree)
  let notesOpen = $derived(new Set(theme.settings.treeNotesOpen))

  /** Notes per folder, in the same order as the list pane. Root-level notes live under "All notes". */
  let notesByFolder = $derived.by(() => {
    // Built whole on each recomputation and never mutated afterwards.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const byFolder = new Map<string, Note[]>()
    if (!showNotes) return byFolder
    for (const note of notes.notes) {
      if (!note.folderId) continue
      const list = byFolder.get(note.folderId)
      if (list) list.push(note)
      else byFolder.set(note.folderId, [note])
    }
    for (const [id, list] of byFolder) byFolder.set(id, sortForList(list))
    return byFolder
  })

  type TreeRow = { kind: 'folder'; node: FolderNode } | { kind: 'note'; note: Note; depth: number }

  /** Folders in tree order, each followed by its notes when they are unfolded. */
  let rows = $derived.by(() => {
    const out: TreeRow[] = []
    const walk = (list: FolderNode[]) => {
      for (const node of list) {
        out.push({ kind: 'folder', node })
        if (!node.collapsed) walk(node.children)
        if (notesOpen.has(node.id)) {
          for (const note of notesByFolder.get(node.id) ?? []) {
            out.push({ kind: 'note', note, depth: node.depth + 1 })
          }
        }
      }
    }
    walk(notes.tree)
    return out
  })

  const hasNotes = (id: string) => (notesByFolder.get(id)?.length ?? 0) > 0

  function setNotesOpen(id: string, open: boolean) {
    const current = theme.settings.treeNotesOpen
    if (current.includes(id) === open) return
    theme.update({ treeNotesOpen: open ? [...current, id] : current.filter((x) => x !== id) })
  }

  /**
   * The twisty unfolds everything under a folder - subfolders and notes - or
   * folds it all back. The two are remembered apart, so a folder that already
   * shows its subfolders opens its notes first.
   */
  function toggleFolder(id: string) {
    const node = notes.folders.find((f) => f.id === id)
    if (!node) return
    const children = notes.folders.some((f) => f.parentId === id)
    const notesHere = hasNotes(id)
    const open = notesOpen.has(id)
    const unfolded = (!children || !node.collapsed) && (!notesHere || open)
    if (unfolded) {
      if (children && !node.collapsed) void notes.toggleCollapsed(id)
      setNotesOpen(id, false)
    } else {
      if (children && node.collapsed) void notes.toggleCollapsed(id)
      if (notesHere) setNotesOpen(id, true)
    }
  }

  function openNote(note: Note) {
    if (!(scope.kind === 'folder' && scope.id === note.folderId)) {
      notes.setScope({ kind: 'folder', id: note.folderId })
    }
    notes.select(note.id)
    if (ui.narrow) ui.showPane('note')
  }

  // Opening a note from anywhere (palette, link, list) unfolds the way to it.
  // Only when the selection changes, so folding a folder back is not undone.
  let revealed = ''
  $effect(() => {
    const id = notes.selectedNoteId
    if (!showNotes || !id || id === revealed) return
    const note = notes.notes.find((n) => n.id === id)
    if (!note?.folderId) return
    revealed = id
    untrack(() => {
      setNotesOpen(note.folderId, true)
      let parent = notes.folders.find((f) => f.id === note.folderId)?.parentId
      while (parent) {
        const folder = notes.folders.find((f) => f.id === parent)
        if (!folder) break
        if (folder.collapsed) void notes.toggleCollapsed(folder.id)
        parent = folder.parentId
      }
    })
  })

  async function handleFolderDrop(draggedId: string, targetId: string, position: DropPosition) {
    if (position === 'inside') {
      const ok = await notes.moveFolder(draggedId, targetId, null, null)
      if (!ok) ui.toast(t('toast.cannotNestInSelf'), 'warn')
      return
    }

    const neighbours = neighboursFor(notes.folders, draggedId, targetId, position)
    if (!neighbours) return

    const ok = await notes.moveFolder(draggedId, neighbours.parentId, neighbours.before, neighbours.after)
    if (!ok) ui.toast(t('toast.cannotNestInSelf'), 'warn')
  }

  async function saveCurrentSearch() {
    if (scope.kind !== 'search') return
    const name = prompt(t('sidebar.savedSearchName'), scope.query)
    if (!name) return
    const smart = await notes.newSmartFolder(name, scope.query)
    notes.setScope({ kind: 'smart', id: smart.id })
    ui.toast(t('toast.searchSaved'), 'ok')
  }

  async function handleNoteDrop(noteId: string, folderId: string) {
    await notes.move(noteId, folderId)
    ui.toast(t('toast.noteMoved'), 'ok')
  }

  function onRootDragOver(event: DragEvent) {
    const types = event.dataTransfer?.types ?? []
    if (!types.includes('application/x-noter-note') && !types.includes('application/x-noter-folder')) return
    event.preventDefault()
    hover = { id: null, position: null }
  }

  async function onRootDrop(event: DragEvent) {
    event.preventDefault()
    const noteId = event.dataTransfer?.getData('application/x-noter-note')
    const folderId = event.dataTransfer?.getData('application/x-noter-folder')
    if (noteId) await notes.move(noteId, ROOT)
    else if (folderId) await notes.moveFolder(folderId, ROOT, null, null)
  }
</script>

<aside class="sidebar" data-testid="sidebar">
  <header class="head">
    {#if ui.narrow}
      <div class="brand">
        <!-- On phones there is no navigation rail, so the sidebar names the app. -->
        <Logo size={18} />
        <span>{t('app.name')}</span>
      </div>
    {:else}
      <button
        class="btn btn--ghost btn--icon"
        aria-label={t('nav.collapseSidebar')}
        title={t('nav.collapseSidebar')}
        onclick={() => theme.update({ sidebarCollapsed: true })}
      >
        <Icon name="panel-left" size={16} />
      </button>
      <h2 class="heading">{t('nav.notes')}</h2>
    {/if}
    <button
      class="btn btn--ghost btn--icon"
      aria-label={t('sidebar.newFolder')}
      data-testid="new-folder"
      onclick={() => void notes.newFolder()}
    >
      <Icon name="folder-plus" size={16} />
    </button>
  </header>

  <button class="search" data-testid="open-search" onclick={onopenpalette}>
    <Icon name="search" size={15} />
    <span class="truncate">{t('sidebar.search')}</span>
    <Kbd keys="Mod+K" />
  </button>

  <nav class="views">
    <button
      class="view"
      class:view--active={scope.kind === 'folder' && scope.id === null}
      data-testid="view-all"
      onclick={() => selectFolder(null)}
    >
      <Icon name="file-text" size={15} />
      <span class="truncate">{t('sidebar.allNotes')}</span>
      <span class="count">{notes.notes.length}</span>
    </button>
    <button
      class="view"
      class:view--active={scope.kind === 'archive'}
      data-testid="view-archive"
      onclick={() => notes.setScope({ kind: 'archive' })}
    >
      <Icon name="archive" size={15} />
      <span class="truncate">{t('sidebar.archive')}</span>
      <span class="count" class:count--hidden={notes.archived.length === 0}>{notes.archived.length}</span>
    </button>
    <button
      class="view"
      class:view--active={scope.kind === 'trash'}
      data-testid="view-trash"
      onclick={() => notes.setScope({ kind: 'trash' })}
    >
      <Icon name="trash" size={15} />
      <span class="truncate">{t('sidebar.trash')}</span>
      <span class="count" class:count--hidden={notes.trashed.length === 0}>{notes.trashed.length}</span>
    </button>
  </nav>

  <hr class="divider" />

  <!-- Dropping onto the empty area below the tree unfiles an item. -->
  <div
    class="tree"
    role="tree"
    aria-label={t('sidebar.tags')}
    tabindex="-1"
    ondragover={onRootDragOver}
    ondrop={onRootDrop}
    use:contextmenu={() => treeMenuItems()}
  >
    {#each rows as row (row.kind === 'folder' ? row.node.id : `note:${row.note.id}`)}
      {#if row.kind === 'folder'}
        {@const node = row.node}
        <FolderRow
          {node}
          active={scope.kind === 'folder' && scope.id === node.id}
          count={notes.counts.get(node.id) ?? 0}
          expanded={(node.children.length > 0 && !node.collapsed) ||
            (hasNotes(node.id) && notesOpen.has(node.id))}
          foldable={node.children.length > 0 || hasNotes(node.id)}
          dropTarget={hover.id === node.id ? hover.position : null}
          onselect={selectFolder}
          ontoggle={toggleFolder}
          onrename={(id, name) => void notes.renameFolder(id, name)}
          ondropfolder={(a, b, p) => void handleFolderDrop(a, b, p)}
          ondropnote={(n, f) => void handleNoteDrop(n, f)}
          ondraghover={(id, position) => (hover = { id, position })}
          onnudge={(id, direction) => void nudge(id, direction)}
        />
      {:else}
        <NoteTreeRow
          note={row.note}
          depth={row.depth}
          active={notes.selectedNoteId === row.note.id}
          onselect={openNote}
        />
      {/if}
    {/each}

    {#if notes.folders.length === 0 && !notes.loading}
      <p class="empty faint">
        {t('sidebar.noFolders')}
      </p>
    {/if}
  </div>

  {#if notes.smartFolders.length > 0 || scope.kind === 'search'}
    <hr class="divider" />
    <nav class="views" aria-label="Saved searches">
      {#each notes.smartFolders as smart (smart.id)}
        <button
          class="view"
          data-testid="smart-folder"
          class:view--active={scope.kind === 'smart' && scope.id === smart.id}
          onclick={() => {
            notes.setScope({ kind: 'smart', id: smart.id })
            if (ui.narrow) ui.showPane('list')
          }}
          use:contextmenu={() => smartFolderMenuItems(smart.id)}
        >
          <Icon name={smart.icon} size={15} />
          <span class="truncate">{smart.name}</span>
        </button>
      {/each}

      {#if scope.kind === 'search'}
        <button class="view view--dashed" data-testid="save-search" onclick={saveCurrentSearch}>
          <Icon name="plus" size={15} />
          <span class="truncate">{t('sidebar.saveSearch')}</span>
        </button>
      {/if}
    </nav>
  {/if}

  {#if notes.tagCounts.size > 0}
    <hr class="divider" />
    <button class="section" onclick={() => (tagsOpen = !tagsOpen)} aria-expanded={tagsOpen}>
      <Icon name="chevron-right" size={12} class={tagsOpen ? 'rotated' : ''} />
      <span>{t('sidebar.tags')}</span>
      <span class="count">{notes.tagCounts.size}</span>
    </button>
    {#if tagsOpen}
      <nav class="tags" aria-label="Tags">
        {#each [...notes.tagCounts].slice(0, 30) as [tag, count] (tag)}
          <button
            class="tag"
            data-testid="tag-chip"
            use:contextmenu={() => tagMenuItems(tag)}
            class:tag--active={scope.kind === 'tag' && scope.tag === tag}
            onclick={() => {
              notes.setScope({ kind: 'tag', tag })
              if (ui.narrow) ui.showPane('list')
            }}
          >
            <span class="truncate">#{tag}</span>
            <span class="count">{count}</span>
          </button>
        {/each}
      </nav>
    {/if}
  {/if}

  {#if ui.narrow}
    <!-- Wide layouts reach settings from the navigation rail. -->
    <footer class="foot">
      <button class="view" data-testid="open-settings" onclick={() => openSettings()}>
        <Icon name="settings" size={15} />
        <span class="truncate">{t('sidebar.settings')}</span>
      </button>
    </footer>
  {/if}
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: var(--space-2);
    background: var(--bg-2);
    border-inline-end: 1px solid var(--border);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2) var(--space-2);
  }

  .heading {
    flex: 1;
    min-width: 0;
    font-size: var(--text-md);
    font-weight: 650;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 650;
    letter-spacing: 0.01em;
    color: var(--text);
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--row-height);
    margin-bottom: var(--space-2);
    padding: 0 var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--text-faint);
    cursor: pointer;
    text-align: start;
  }

  .search:hover {
    border-color: var(--border-strong);
    color: var(--text);
  }

  .search span {
    flex: 1;
    min-width: 0;
  }

  .section {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    padding: var(--space-1) var(--space-2);
    border: none;
    background: none;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .section span:first-of-type {
    flex: 1;
    text-align: start;
  }

  .section :global(.rotated) {
    transform: rotate(90deg);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: var(--space-1) var(--space-1) var(--space-2);
    max-height: 22vh;
    overflow-y: auto;
  }

  .tag {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    max-width: 100%;
    padding: 2px var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    background: none;
    color: var(--text-dim);
    font-size: 11px;
    cursor: pointer;
  }

  .tag:hover {
    border-color: var(--border-strong);
    color: var(--text);
  }

  .tag--active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--text);
  }

  .view--dashed {
    border: 1px dashed var(--border);
    color: var(--text-faint);
  }

  .views,
  .foot {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .view {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--row-height);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius);
    background: none;
    color: var(--text-dim);
    text-align: start;
    cursor: pointer;
  }

  .view:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .view--active {
    background: var(--accent-soft);
    color: var(--text);
  }

  .view span:first-of-type {
    flex: 1;
    min-width: 0;
  }

  .count {
    font-size: 11px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .count--hidden {
    visibility: hidden;
  }

  .tree {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .tree:focus {
    outline: none;
  }

  .empty {
    padding: var(--space-3) var(--space-2);
    font-size: 12px;
    line-height: 1.5;
  }

  .foot {
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }
</style>
