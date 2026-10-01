<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Note } from '$lib/db/schema'
  import { derivedTitle } from '$lib/db/repo/notes'
  import { noteMenuItems } from '$lib/menus/note'
  import { contextmenu } from '$lib/ui/contextmenu'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    note: Note
    /** How deep its folder sits; the note is one step further in. */
    depth: number
    active: boolean
    onselect: (note: Note) => void
  }

  let { note, depth, active, onselect }: Props = $props()

  let title = $derived(note.encrypted ? t('list.lockedNote') : derivedTitle(note))
</script>

<div
  class="row"
  data-testid="tree-note"
  class:row--active={active}
  style="--depth: {depth}"
  role="treeitem"
  tabindex="-1"
  aria-selected={active}
  draggable="true"
  ondragstart={(e) => {
    e.dataTransfer?.setData('application/x-noter-note', note.id)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }}
  use:contextmenu={() => noteMenuItems(note)}
>
  <!-- Same width as a folder's twisty, so the icons line up with the folders'. -->
  <span class="spacer"></span>
  <button class="label" data-ui-sound="note" onclick={() => onselect(note)}>
    <span class="icon"><Icon name="file-text" size={15} /></span>
    <span class="name truncate">{title}</span>
    {#if note.encrypted}
      <span class="lock" title={t('list.encrypted')}><Icon name="lock" size={11} /></span>
    {/if}
  </button>
</div>

<style>
  .row {
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

  .spacer {
    flex: none;
    width: 16px;
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

  .icon,
  .lock {
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
</style>
