<script lang="ts">
  import Icon from './Icon.svelte'
  import FolderRow from './FolderRow.svelte'
  import Menu from './Menu.svelte'
  import FolderStyle from './FolderStyle.svelte'
  import FolderLock from './FolderLock.svelte'
  import type { DropPosition, MenuItem } from '$lib/ui-types'
  import { notes } from '$lib/stores/notes.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { ROOT } from '$lib/db/schema'
  import { moveFolder, neighboursFor, nudgeFolder } from '$lib/db/repo/folders'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    onopensettings: () => void
    onopenpalette: () => void
  }

  let { onopensettings, onopenpalette }: Props = $props()

  let tagsOpen = $state(true)
  let styling = $state<string | null>(null)
  let locking = $state<string | null>(null)

  let hover = $state<{ id: string | null; position: DropPosition | null }>({ id: null, position: null })
  let menu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null)

  let scope = $derived(notes.scope)

  function selectFolder(id: string | null) {
    notes.setScope({ kind: 'folder', id })
    if (ui.narrow) ui.showPane('list')
  }

  function openFolderMenu(id: string, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect()
    const folder = notes.folders.find((f) => f.id === id)
    menu = {
      x: rect.left,
      y: rect.bottom + 4,
      items: [
        // Reordering by menu as well as by drag: dragging is unavailable on
        // touch and awkward for anyone who finds fine pointer work hard.
        { label: t('sidebar.moveUp'), icon: 'chevron-right', run: () => void nudge(id, -1) },
        { label: t('sidebar.moveDown'), icon: 'chevron-right', run: () => void nudge(id, 1) },
        { label: t('sidebar.appearance'), icon: 'image', separatorBefore: true, run: () => (styling = id) },
        {
          label: t(folder?.encrypted ? 'sidebar.encryption' : 'sidebar.encryptFolder'),
          icon: 'lock',
          run: () => (locking = id),
        },
        {
          label: t('sidebar.newSubfolder'),
          icon: 'folder-plus',
          separatorBefore: true,
          run: () => void notes.newFolder(id),
        },
        {
          label: t('sidebar.newNoteHere'),
          icon: 'plus',
          run: () => {
            notes.setScope({ kind: 'folder', id })
            void notes.newNote()
          },
        },
        {
          label: t(folder?.collapsed ? 'sidebar.expand' : 'sidebar.collapse'),
          icon: 'chevron-right',
          separatorBefore: true,
          run: () => void notes.toggleCollapsed(id),
        },
        {
          label: t('sidebar.deleteFolder'),
          icon: 'trash',
          danger: true,
          separatorBefore: true,
          run: () => {
            const count = notes.counts.get(id) ?? 0
            void notes.deleteFolder(id)
            ui.toast(
              count > 0 ? t('toast.folderDeletedWithNotes', { count }) : t('toast.folderDeleted'),
              'info',
            )
          },
        },
      ],
    }
  }

  async function handleFolderDrop(draggedId: string, targetId: string, position: DropPosition) {
    if (position === 'inside') {
      const ok = await moveFolder(draggedId, targetId, null, null)
      if (!ok) ui.toast(t('toast.cannotNestInSelf'), 'warn')
      return
    }

    const neighbours = neighboursFor(notes.folders, draggedId, targetId, position)
    if (!neighbours) return

    const ok = await moveFolder(draggedId, neighbours.parentId, neighbours.before, neighbours.after)
    if (!ok) ui.toast(t('toast.cannotNestInSelf'), 'warn')
  }

  /** Keyboard reordering, one slot at a time. */
  async function nudge(id: string, direction: -1 | 1) {
    const moved = await nudgeFolder(id, direction)
    if (!moved) return
    // Keep focus on the row that just moved, so a run of nudges keeps working.
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-folder-id="${id}"] .label`)
      row?.focus()
    })
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
    else if (folderId) await moveFolder(folderId, ROOT, null, null)
  }
</script>

<aside class="sidebar" data-testid="sidebar">
  <header class="head">
    <div class="brand">
      <!-- The product mark, not a generic icon: this is the one place the app
           names itself. Served from public/ so it is precached for offline. -->
      <img class="mark" src="/icons/logo-64.png" alt="" width="18" height="18" />
      <span>{t('app.name')}</span>
    </div>
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
    <kbd>Ctrl K</kbd>
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
  >
    {#each notes.visibleFolders as node (node.id)}
      <FolderRow
        {node}
        active={scope.kind === 'folder' && scope.id === node.id}
        count={notes.counts.get(node.id) ?? 0}
        dropTarget={hover.id === node.id ? hover.position : null}
        onselect={selectFolder}
        ontoggle={(id) => void notes.toggleCollapsed(id)}
        onrename={(id, name) => void notes.renameFolder(id, name)}
        onmenu={openFolderMenu}
        ondropfolder={(a, b, p) => void handleFolderDrop(a, b, p)}
        ondropnote={(n, f) => void handleNoteDrop(n, f)}
        ondraghover={(id, position) => (hover = { id, position })}
        onnudge={(id, direction) => void nudge(id, direction)}
      />
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
          oncontextmenu={(e) => {
            e.preventDefault()
            menu = {
              x: e.clientX,
              y: e.clientY,
              items: [
                {
                  label: t('sidebar.deleteSavedSearch'),
                  icon: 'trash',
                  danger: true,
                  run: () => void notes.deleteSmartFolder(smart.id),
                },
              ],
            }
          }}
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

  <footer class="foot">
    <button class="view" data-testid="open-settings" onclick={onopensettings}>
      <Icon name="settings" size={15} />
      <span class="truncate">{t('sidebar.settings')}</span>
    </button>
  </footer>
</aside>

{#if menu}
  <Menu items={menu.items} x={menu.x} y={menu.y} onclose={() => (menu = null)} />
{/if}

{#if styling}
  {@const folder = notes.folders.find((f) => f.id === styling)}
  {#if folder}
    <FolderStyle {folder} onclose={() => (styling = null)} />
  {/if}
{/if}

{#if locking}
  {@const folder = notes.folders.find((f) => f.id === locking)}
  {#if folder}
    <FolderLock {folder} onclose={() => (locking = null)} />
  {/if}
{/if}

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

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 650;
    letter-spacing: 0.01em;
    color: var(--text);
  }

  .mark {
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 4px;
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

  kbd {
    padding: 1px 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 10px;
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
