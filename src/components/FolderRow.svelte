<script lang="ts">
  import Icon from './Icon.svelte'
  import type { FolderNode } from '$lib/db/repo/folders'
  import type { DropPosition } from '$lib/ui-types'
  import { t } from '$lib/i18n/index.svelte'
  import { contextmenu } from '$lib/ui/contextmenu'
  import { menu } from '$lib/stores/menu.svelte'
  import { folderMenuItems } from '$lib/menus/folder'

  interface Props {
    node: FolderNode
    active: boolean
    count: number
    dropTarget: DropPosition | null
    onselect: (id: string) => void
    ontoggle: (id: string) => void
    onrename: (id: string, name: string) => void
    ondropfolder: (draggedId: string, targetId: string, position: DropPosition) => void
    ondropnote: (noteId: string, folderId: string) => void
    ondraghover: (id: string | null, position: DropPosition | null) => void
    onnudge: (id: string, direction: -1 | 1) => void
  }

  let {
    node,
    active,
    count,
    dropTarget,
    onselect,
    ontoggle,
    onrename,
    ondropfolder,
    ondropnote,
    ondraghover,
    onnudge,
  }: Props = $props()

  let renaming = $state(false)
  let draft = $state('')
  let menuButton = $state<HTMLElement | null>(null)
  let renameInput = $state<HTMLInputElement | null>(null)

  // The `autofocus` attribute is unreliable for elements added after load, so
  // the rename field is focused (and its text selected) explicitly.
  $effect(() => {
    if (renaming && renameInput) {
      renameInput.focus()
      renameInput.select()
    }
  })

  function startRename() {
    draft = node.name
    renaming = true
  }

  function commitRename() {
    if (!renaming) return
    renaming = false
    if (draft.trim() && draft !== node.name) onrename(node.id, draft)
  }

  function onRenameKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      renaming = false
    }
  }

  function onDragStart(event: DragEvent) {
    event.dataTransfer?.setData('application/x-noter-folder', node.id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  /**
   * Where a drop lands: the top and bottom bands reorder, the middle nests.
   *
   * The bands are a share of the row with a pixel floor. At 30px a quarter of
   * the row is a 7px target, which is far too small to hit on purpose — so in
   * practice every reorder turned into a nest.
   */
  const EDGE_RATIO = 0.3
  const MIN_EDGE_PX = 8

  function positionFor(event: DragEvent, element: HTMLElement): DropPosition {
    const rect = element.getBoundingClientRect()
    const edge = Math.max(MIN_EDGE_PX, rect.height * EDGE_RATIO)
    const offset = event.clientY - rect.top

    if (offset < edge) return 'before'
    if (offset > rect.height - edge) return 'after'
    return 'inside'
  }

  // Both handlers stop propagation: the tree container has its own drop target
  // for unfiling to the root, and letting these events reach it would undo the
  // row's decision a moment after it was made.
  function onDragOver(event: DragEvent) {
    const types = event.dataTransfer?.types ?? []
    const isFolder = types.includes('application/x-noter-folder')
    const isNote = types.includes('application/x-noter-note')
    if (!isFolder && !isNote) return

    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    ondraghover(node.id, isNote ? 'inside' : positionFor(event, event.currentTarget as HTMLElement))
  }

  function onDrop(event: DragEvent) {
    const folderId = event.dataTransfer?.getData('application/x-noter-folder')
    const noteId = event.dataTransfer?.getData('application/x-noter-note')

    event.preventDefault()
    event.stopPropagation()
    ondraghover(null, null)

    if (noteId) ondropnote(noteId, node.id)
    else if (folderId && folderId !== node.id) {
      ondropfolder(folderId, node.id, positionFor(event, event.currentTarget as HTMLElement))
    }
  }

  /**
   * `dragleave` also fires when the pointer crosses into a child element, which
   * would blink the drop indicator off while the pointer is still over the row.
   * Only a move to something outside the row counts as leaving it.
   */
  function onDragLeave(event: DragEvent) {
    const next = event.relatedTarget
    if (next instanceof Node && (event.currentTarget as HTMLElement).contains(next)) return
    ondraghover(null, null)
  }

  function onKeydown(event: KeyboardEvent) {
    // Alt+Arrow reorders without a mouse; drag and drop is not reachable from a
    // keyboard at all. F2 renames, as in every file manager.
    if (event.key === 'F2' && !renaming) {
      event.preventDefault()
      startRename()
      return
    }
    if (!event.altKey) return
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onnudge(node.id, -1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      onnudge(node.id, 1)
    }
  }
</script>

<div
  class="row"
  data-testid="folder-row"
  data-folder-id={node.id}
  class:row--active={active}
  class:row--inside={dropTarget === 'inside'}
  class:row--before={dropTarget === 'before'}
  class:row--after={dropTarget === 'after'}
  style="--depth: {node.depth}"
  draggable={!renaming}
  role="treeitem"
  tabindex="-1"
  aria-selected={active}
  aria-expanded={node.children.length > 0 ? !node.collapsed : undefined}
  ondragstart={onDragStart}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  ondragend={() => ondraghover(null, null)}
  onkeydown={onKeydown}
  use:contextmenu={() => (renaming ? [] : folderMenuItems(node.id, { onrename: startRename }))}
>
  <button
    class="twisty"
    class:twisty--hidden={node.children.length === 0}
    aria-label={t(node.collapsed ? 'sidebar.expandFolder' : 'sidebar.collapseFolder')}
    onclick={(e) => {
      e.stopPropagation()
      ontoggle(node.id)
    }}
  >
    <Icon name="chevron-right" size={13} class={node.collapsed ? '' : 'rotated'} />
  </button>

  <button
    class="label"
    data-testid="folder-label"
    onclick={() => onselect(node.id)}
    ondblclick={startRename}
  >
    <span class="icon" style={node.color ? `color: ${node.color}` : ''}>
      <Icon name={node.icon} size={15} />
    </span>
    {#if renaming}
      <input
        class="rename"
        bind:this={renameInput}
        bind:value={draft}
        onblur={commitRename}
        onkeydown={onRenameKey}
        onclick={(e) => e.stopPropagation()}
      />
    {:else}
      <span class="name truncate">{node.name}</span>
      {#if node.encrypted}
        <span class="lock" title={t('sidebar.encryptedFolder')}><Icon name="lock" size={11} /></span>
      {/if}
    {/if}
  </button>

  {#if !renaming}
    <span class="count" class:count--hidden={count === 0}>{count}</span>
    <button
      class="menu"
      bind:this={menuButton}
      aria-label={t('sidebar.folderActions')}
      onclick={(e) => {
        e.stopPropagation()
        if (menuButton)
          menu.open(
            folderMenuItems(node.id, { onrename: startRename }),
            menuButton,
            t('sidebar.folderActions'),
          )
      }}
    >
      <Icon name="more" size={14} />
    </button>
  {/if}
</div>

<style>
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    height: var(--row-height);
    padding-inline: var(--space-1) var(--space-2);
    padding-inline-start: calc(var(--space-1) + var(--depth) * 14px);
    border-radius: var(--radius);
    color: var(--text-dim);
    cursor: default;
    user-select: none;
  }

  .row:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .row--active {
    background: var(--accent-soft);
    color: var(--text);
  }

  /* Drop feedback: a line for reordering, a ring for dropping inside. */
  .row--before::after,
  .row--after::after {
    content: '';
    position: absolute;
    /* Logical, so the indent guide stays on the reading side in RTL. */
    inset-inline-start: calc(var(--depth) * 14px);
    inset-inline-end: 0;
    height: 2px;
    background: var(--accent);
    border-radius: 2px;
    /* Above the neighbouring row's background, so the line is never clipped. */
    z-index: 1;
  }

  .row--before::after {
    top: -1px;
  }

  .row--after::after {
    bottom: -1px;
  }

  .row--inside {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .twisty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex: none;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    transition: transform var(--transition);
  }

  .twisty--hidden {
    visibility: hidden;
  }

  .twisty :global(.rotated) {
    transform: rotate(90deg);
    transition: transform var(--transition);
  }

  .label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }

  .icon {
    display: flex;
    flex: none;
    color: var(--text-faint);
  }

  .row--active .icon,
  .row:hover .icon {
    color: inherit;
  }

  .name {
    min-width: 0;
  }

  .rename {
    flex: 1;
    min-width: 0;
    height: 22px;
    padding: 0 var(--space-1);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    background: var(--bg-2);
  }

  .rename:focus {
    outline: none;
  }

  .lock {
    display: flex;
    flex: none;
    color: var(--text-faint);
  }

  .count {
    flex: none;
    font-size: 11px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .count--hidden {
    visibility: hidden;
  }

  .menu {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  /* Revealed on hover only where hover exists. On a touch screen this is the
     single entry point to every folder action, so it has to stay visible. */
  @media (hover: hover) and (pointer: fine) {
    .menu {
      opacity: 0;
    }

    .row:hover .menu,
    .menu:focus-visible {
      opacity: 1;
    }
  }

  .menu:hover {
    background: var(--surface-3);
    color: var(--text);
  }
</style>
