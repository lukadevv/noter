<script lang="ts">
  import Icon from './Icon.svelte'
  import Menu from './Menu.svelte'
  import NoteListItem from './NoteListItem.svelte'
  import type { MenuItem } from '$lib/ui-types'
  import { notes } from '$lib/stores/notes.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { computeRange } from '$lib/utils/virtual'
  import { emptyTrash, moveNote } from '$lib/db/repo/notes'
  import { ROOT } from '$lib/db/schema'

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
        return 'Trash'
      case 'archive':
        return 'Archive'
      case 'tag':
        return `#${scope.tag}`
      case 'search':
        return `Search: ${scope.query}`
      case 'smart':
        return notes.smartFolders.find((f) => f.id === scope.id)?.name ?? 'Saved search'
      default:
        return notes.activeFolder?.name ?? 'All notes'
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
        label: 'All notes (no folder)',
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
      await moveNote(id, folderId, null, null)
    })
    ui.toast(`${count} note(s) moved.`, 'ok')
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
            { label: 'Restore', icon: 'restore', run: () => void notes.restore(id) },
            {
              label: 'Delete permanently',
              icon: 'trash',
              danger: true,
              separatorBefore: true,
              run: () => void notes.deleteForever(id),
            },
          ]
        : [
            {
              label: note.pinned ? 'Unpin' : 'Pin',
              icon: 'pin',
              run: () => void notes.togglePin(id),
            },
            {
              label: note.archivedAt ? 'Unarchive' : 'Archive',
              icon: 'archive',
              run: () => void notes.setArchived(id, note.archivedAt === 0),
            },
            {
              label: 'Move to trash',
              icon: 'trash',
              danger: true,
              separatorBefore: true,
              run: () => {
                void notes.trash(id)
                ui.toast('Moved to trash.', 'info', {
                  label: 'Undo',
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
      <button class="btn btn--ghost btn--icon" aria-label="Back to folders" onclick={() => ui.back()}>
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
          ui.toast(`${removed} note(s) permanently deleted.`, 'warn')
        }}
      >
        Empty trash
      </button>
    {:else if notes.scope.kind === 'folder'}
      <button
        class="btn btn--ghost btn--icon"
        aria-label="New note"
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
      <button class="btn btn--ghost bulk-all" onclick={() => notes.markAll()}>Select all</button>
      <div class="spacer"></div>
      {#if notes.scope.kind === 'trash'}
        <button
          class="btn btn--ghost btn--icon"
          title="Restore"
          aria-label="Restore selected notes"
          onclick={async () => {
            const n = await notes.applyToMarked((id) => notes.restore(id))
            ui.toast(`${n} note(s) restored.`, 'ok')
          }}
        >
          <Icon name="restore" size={15} />
        </button>
        <button
          class="btn btn--ghost btn--icon btn--danger"
          title="Delete permanently"
          aria-label="Delete selected notes permanently"
          onclick={async () => {
            const n = await notes.applyToMarked((id) => notes.deleteForever(id))
            ui.toast(`${n} note(s) deleted for good.`, 'warn')
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      {:else}
        <button
          class="btn btn--ghost btn--icon"
          title="Move to folder"
          aria-label="Move selected notes to a folder"
          onclick={openMoveMenu}
        >
          <Icon name="folder" size={15} />
        </button>
        <button
          class="btn btn--ghost btn--icon"
          title="Pin"
          aria-label="Pin selected notes"
          onclick={async () => {
            await notes.applyToMarked((id) => notes.togglePin(id))
          }}
        >
          <Icon name="pin" size={15} />
        </button>
        <button
          class="btn btn--ghost btn--icon"
          title="Archive"
          aria-label="Archive selected notes"
          onclick={async () => {
            const n = await notes.applyToMarked((id) => notes.setArchived(id, true))
            ui.toast(`${n} note(s) archived.`, 'ok')
          }}
        >
          <Icon name="archive" size={15} />
        </button>
        <button
          class="btn btn--ghost btn--icon btn--danger"
          title="Move to trash"
          aria-label="Move selected notes to trash"
          onclick={async () => {
            const ids = [...notes.marked]
            const n = await notes.applyToMarked((id) => notes.trash(id))
            ui.toast(`${n} note(s) moved to trash.`, 'info', {
              label: 'Undo',
              run: () => void Promise.all(ids.map((id) => notes.restore(id))),
            })
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      {/if}
      <button class="btn btn--ghost btn--icon" aria-label="Clear selection" onclick={() => notes.clearMarks()}>
        <Icon name="x" size={14} />
      </button>
    </div>
  {/if}

  <div
    class="scroller"
    bind:this={scroller}
    role="listbox"
    aria-label="Notes"
    tabindex="-1"
    onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
  >
    {#if items.length === 0}
      <div class="empty">
        <Icon name="file-text" size={22} />
        <p class="faint">
          {#if notes.scope.kind === 'trash'}
            Trash is empty.
          {:else if notes.scope.kind === 'archive'}
            Nothing archived.
          {:else}
            No notes here yet.
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
    border-right: 1px solid var(--border);
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
    padding-left: var(--space-2);
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
