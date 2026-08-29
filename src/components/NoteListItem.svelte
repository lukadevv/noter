<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Note } from '$lib/db/schema'
  import { derivedTitle, preview } from '$lib/db/repo/notes'
  import { relativeTime } from '$lib/utils/dates'

  interface Props {
    note: Note
    active: boolean
    marked: boolean
    /** True while any note is multi-selected, which reveals every checkbox. */
    selecting: boolean
    height: number
    onselect: (id: string, event: MouseEvent | KeyboardEvent) => void
    onmark: (id: string, event: MouseEvent) => void
    onmenu: (id: string, x: number, y: number) => void
  }

  let { note, active, marked, selecting, height, onselect, onmark, onmenu }: Props = $props()

  // A locked note shows nothing but the fact that it is locked; its title is
  // ciphertext and rendering that would be noise.
  let title = $derived(note.encrypted ? 'Locked note' : derivedTitle(note))
  let snippet = $derived(note.encrypted ? 'Encrypted' : preview(note.body))
  let pinned = $derived(note.pinned === 1 || note.pinnedInFolder === 1)
</script>

<div
  class="item"
  data-testid="note-item"
  class:item--active={active}
  class:item--marked={marked}
  style="height: {height}px"
  role="option"
  tabindex="-1"
  aria-selected={active}
  draggable="true"
  ondragstart={(e) => {
    e.dataTransfer?.setData('application/x-noter-note', note.id)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }}
  onclick={(e) => onselect(note.id, e)}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onselect(note.id, e)
    }
  }}
  oncontextmenu={(e) => {
    e.preventDefault()
    onmenu(note.id, e.clientX, e.clientY)
  }}
>
  <div class="line">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <span
      class="mark"
      class:mark--visible={selecting || marked}
      onclick={(e) => {
        e.stopPropagation()
        onmark(note.id, e)
      }}
    >
      <input type="checkbox" checked={marked} tabindex="-1" aria-label="Select note" />
    </span>
    {#if note.encrypted}
      <span class="pin" title="Encrypted"><Icon name="lock" size={12} /></span>
    {/if}
    {#if pinned}
      <span class="pin" title="Pinned"><Icon name="pin" size={12} /></span>
    {/if}
    <span class="title truncate" data-testid="note-item-title">{title}</span>
    <span class="time">{relativeTime(note.updatedAt)}</span>
  </div>
  <p class="snippet">{snippet || 'Empty note'}</p>
</div>

<style>
  .item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 0 var(--space-3);
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    overflow: hidden;
  }

  .item:hover {
    background: var(--surface);
  }

  .item--active {
    background: var(--accent-soft);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .item--marked {
    background: color-mix(in oklab, var(--accent-soft) 70%, var(--surface));
  }

  /* The checkbox only appears on hover, or once a selection is under way, so
     the default list stays clean. */
  .mark {
    display: none;
    align-items: center;
    flex: none;
    align-self: center;
  }

  .mark--visible,
  .item:hover .mark {
    display: flex;
  }

  .mark input {
    accent-color: var(--accent);
    cursor: pointer;
    margin: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .pin {
    display: flex;
    align-self: center;
    flex: none;
    color: var(--accent);
  }

  .title {
    flex: 1;
    min-width: 0;
    font-weight: 550;
    color: var(--text);
  }

  .time {
    flex: none;
    font-size: 11px;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .snippet {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
