<script lang="ts">
  import Icon from './Icon.svelte'
  import Menu from './Menu.svelte'
  import NoteListItem from './NoteListItem.svelte'
  import type { MenuItem } from '$lib/ui-types'
  import { notes } from '$lib/stores/notes.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { computeRange } from '$lib/utils/virtual'
  import { emptyTrash } from '$lib/db/repo/notes'
  import { ROOT } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  /** Kept in sync with the fixed row height in NoteListItem's styles. */
  const ROW_HEIGHT = 62

  let scroller = $state<HTMLElement | null>(null)
  let scrollTop = $state(0)
  let viewportHeight = $state(0)
  let menu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null)

  let items = $derived(notes.listNotes)
  let range = $derived(computeRange(items.length, ROW_HEIGHT, scrollTop, viewportHeight))
  let slice = $derived(items.slice(range.start, range.end))

  let heading = $derived.by(() => {
    const scope = notes.scope
    switch (scope.kind) {
      case 'trash':
        return t('sidebar.trash')
      case 'archive':
        return t('sidebar.archive')
      case 'tag':
        return `#${scope.tag}`
      case 'search':
        return t('list.searchHeading', { query: scope.query })
      case 'smart':
        return notes.smartFolders.find((f) => f.id === scope.id)?.name ?? t('list.savedSearch')
      default:
        return notes.activeFolder?.name ?? t('sidebar.allNotes')
    }
  })

  // Scrolling far down and then switching to a shorter list would otherwise
  // leave the viewport past the end of the new content.
  $effect(() => {
    void notes.scope
    scroller?.scrollTo({ top: 0 })
    scrollTop = 0
  })

  $effect(() => {
    if (!scroller) return
    const observer = new ResizeObserver(([entry]) => {
      viewportHeight = entry?.contentRect.height ?? 0
    })
    observer.observe(scroller)
    return () => observer.disconnect()
  })

  function select(id: string, event: MouseEvent | KeyboardEvent) {
    // Modifier-clicks build a multi-selection instead of opening the note.
    if (event.shiftKey) {
      notes.markRangeTo(id)
      return
    }
    if (event.ctrlKey || event.metaKey) {
      notes.toggleMark(id)
      return
    }
    notes.clearMarks()
    notes.select(id)
    if (ui.narrow) ui.showPane('note')
  }

  function mark(id: string, event: MouseEvent) {
    if (event.shiftKey) notes.markRangeTo(id)
    else notes.toggleMark(id)
  }

  function openMoveMenu(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const targets: MenuItem[] = [
      {
        label: t('list.noFolder'),
        icon: 'file-text',
        run: () => void bulkMove(ROOT),
      },
      ...notes.visibleFolders.map((folder, index) => ({
        label: `${'\u00a0\u00a0'.repeat(folder.depth)}${folder.name}`,
        icon: 'folder',
        separatorBefore: index === 0,
        run: () => void bulkMove(folder.id),
      })),
    ]
    menu = { x: rect.left, y: rect.bottom + 4, items: targets }
  }

  async function bulkMove(folderId: string) {
    const count = await notes.applyToMarked(async (id) => {
      await notes.move(id, folderId)
    })
    ui.toast(t('toast.notesMoved', { count }), 'ok')
  }

  function openMenu(id: string, x: number, y: number) {
    const note = [...notes.notes, ...notes.trashed, ...notes.archived].find((n) => n.id === id)
    if (!note) return

    const trashed = note.deletedAt > 0
    menu = {
      x,
      y,
      items: trashed
        ? [
            { label: t('common.restore'), icon: 'restore', run: () => void notes.restore(id) },
            {
              label: t('note.menu.deleteForever'),
              icon: 'trash',
              danger: true,
              separatorBefore: true,
              run: () => void notes.deleteForever(id),
            },
          ]
        : [
            {
              label: t(note.pinned ? 'note.menu.unpin' : 'note.menu.pin'),
              icon: 'pin',
              run: () => void notes.togglePin(id),
            },
            {
              label: t(note.archivedAt ? 'note.menu.unarchive' : 'note.menu.archive'),
              icon: 'archive',
              run: () => void notes.setArchived(id, note.archivedAt === 0),
            },
            {
              label: t('note.menu.trash'),
              icon: 'trash',
              danger: true,
              separatorBefore: true,
              run: () => {
                void notes.trash(id)
                ui.toast(t('toast.movedToTrash'), 'info', {
                  label: t('toast.undo'),
                  run: () => void notes.restore(id),
                })
              },
            },
          ],
    }
  }
</script>

<section class="list" data-testid="note-list">
  <header class="head">
    {#if ui.narrow}
      <button
        class="btn btn--ghost btn--icon"
        aria-label={t('note.backToFolders')}
        onclick={() => ui.back()}
      >
        <Icon name="panel-left" size={16} />
      </button>
    {/if}
    <h2 class="truncate" data-testid="list-heading">{heading}</h2>
    <span class="count faint">{items.length}</span>

    {#if notes.scope.kind === 'trash'}
      <button
        class="btn btn--ghost btn--danger"
        disabled={items.length === 0}
        onclick={async () => {
          const removed = await emptyTrash()
          ui.toast(t('toast.notesDeleted', { count: removed }), 'warn')
        }}
      >
        {t('list.emptyTrash')}
      </button>
    {:else if notes.scope.kind === 'folder'}
      <button
        class="btn btn--ghost btn--icon"
        aria-label={t('list.newNote')}
        data-testid="new-note"
        onclick={async () => {
          await notes.newNote()
          if (ui.narrow) ui.showPane('note')
        }}
      >
        <Icon name="plus" size={16} />
      </button>
    {/if}
  </header>

  {#if notes.marked.length > 0}
    <div class="bulk" data-testid="bulk-bar">
      <span class="bulk-count">{notes.marked.length}</span>
      <button class="btn btn--ghost bulk-all" onclick={() => notes.markAll()}>
        {t('list.selectAll')}
      </button>
      <div class="spacer"></div>
      {#if notes.scope.kind === 'trash'}
        <button
          class="btn btn--ghost btn--icon"
          title={t('common.restore')}
          aria-label={t('list.restoreSelected')}
          onclick={async () => {
            const n = await notes.applyToMarked((id) => notes.restore(id))
            ui.toast(t('toast.notesRestored', { count: n }), 'ok')
          }}
        >
          <Icon name="restore" size={15} />
        </button>
        <button
          class="btn btn--ghost btn--icon btn--danger"
          title={t('note.menu.deleteForever')}
          aria-label={t('list.deleteSelectedForever')}
          onclick={async () => {
            const n = await notes.applyToMarked((id) => notes.deleteForever(id))
            ui.toast(t('toast.notesDeletedForGood', { count: n }), 'warn')
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      {:else}
        <button
          class="btn btn--ghost btn--icon"
          title={t('list.moveToFolder')}
          aria-label={t('list.moveToFolder')}
          onclick={openMoveMenu}
        >
          <Icon name="folder" size={15} />
        </button>
        <button
          class="btn btn--ghost btn--icon"
          title={t('note.menu.pin')}
          aria-label={t('list.pinSelected')}
          onclick={async () => {
            await notes.applyToMarked((id) => notes.togglePin(id))
          }}
        >
          <Icon name="pin" size={15} />
        </button>
        <button
          class="btn btn--ghost btn--icon"
          title={t('note.menu.archive')}
          aria-label={t('list.archiveSelected')}
          onclick={async () => {
            const n = await notes.applyToMarked((id) => notes.setArchived(id, true))
            ui.toast(t('toast.notesArchived', { count: n }), 'ok')
          }}
        >
          <Icon name="archive" size={15} />
        </button>
        <button
          class="btn btn--ghost btn--icon btn--danger"
          title={t('note.menu.trash')}
          aria-label={t('list.trashSelected')}
          onclick={async () => {
            const ids = [...notes.marked]
            const n = await notes.applyToMarked((id) => notes.trash(id))
            ui.toast(t('toast.notesTrashed', { count: n }), 'info', {
              label: t('toast.undo'),
              run: () => void Promise.all(ids.map((id) => notes.restore(id))),
            })
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      {/if}
      <button
        class="btn btn--ghost btn--icon"
        aria-label={t('list.clearSelection')}
        onclick={() => notes.clearMarks()}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  {/if}

  <div
    class="scroller"
    bind:this={scroller}
    role="listbox"
    aria-label={t('list.notes')}
    tabindex="-1"
    onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
  >
    {#if items.length === 0}
      <div class="empty">
        <Icon name="file-text" size={22} />
        <p class="faint">
          {#if notes.scope.kind === 'trash'}
            {t('list.trashEmpty')}
          {:else if notes.scope.kind === 'archive'}
            {t('list.nothingArchived')}
          {:else}
            {t('list.noNotes')}
          {/if}
        </p>
      </div>
    {:else}
      <div style="height: {range.padTop}px"></div>
      {#each slice as note (note.id)}
        <NoteListItem
          {note}
          active={notes.selectedNoteId === note.id}
          marked={notes.isMarked(note.id)}
          selecting={notes.marked.length > 0}
          height={ROW_HEIGHT}
          onselect={select}
          onmark={mark}
          onmenu={openMenu}
        />
      {/each}
      <div style="height: {range.padBottom}px"></div>
    {/if}
  </div>
</section>

{#if menu}
  <Menu items={menu.items} x={menu.x} y={menu.y} onclose={() => (menu = null)} />
{/if}

<style>
  .list {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--bg);
    border-inline-end: 1px solid var(--border);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: calc(44px * var(--density));
    padding: 0 var(--space-2) 0 var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  .head h2 {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .count {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  /* Bulk action bar: only present while a multi-selection exists. */
  .bulk {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-bottom: 1px solid var(--border);
    background: var(--accent-soft);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .bulk::-webkit-scrollbar {
    display: none;
  }

  /* Icon-only actions: the list pane is narrow, and a row of labelled buttons
     would overflow it long before the pane could show them all. */
  .bulk-count {
    flex: none;
    min-width: 20px;
    padding-inline-start: var(--space-2);
    font-size: 12px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .bulk-all {
    flex: none;
    font-size: 12px;
  }

  .spacer {
    flex: 1;
  }

  .scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .scroller:focus {
    outline: none;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-4);
    color: var(--text-faint);
    text-align: center;
  }
</style>
