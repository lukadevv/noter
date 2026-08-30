<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Note } from '$lib/db/schema'
  import { derivedTitle, preview } from '$lib/db/repo/notes'
  import { relativeTime } from '$lib/utils/dates'
  import { t } from '$lib/i18n/index.svelte'

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
  let title = $derived(note.encrypted ? t('list.lockedNote') : derivedTitle(note))
  let snippet = $derived(note.encrypted ? t('list.encrypted') : preview(note.body))
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
      <input type="checkbox" checked={marked} tabindex="-1" aria-label={t('list.selectNote')} />
    </span>
    {#if note.encrypted}
      <span class="pin" title={t('list.encrypted')}><Icon name="lock" size={12} /></span>
    {/if}
    {#if pinned}
      <span class="pin" title={t('list.pinned')}><Icon name="pin" size={12} /></span>
    {/if}
    <span class="title truncate" data-testid="note-item-title">{title}</span>
    <span class="time">{relativeTime(note.updatedAt, Date.now(), t)}</span>
    <!-- The same actions as the right-click menu. Right-click does not exist on
         touch, so this button is the only way in there. -->
    <button
      class="actions"
      aria-label={t('note.noteActions')}
      onclick={(e) => {
        e.stopPropagation()
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
        onmenu(note.id, box.left, box.bottom + 4)
      }}
    >
      <Icon name="more" size={14} />
    </button>
  </div>
  <p class="snippet">{snippet || t('list.emptyNote')}</p>
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

  /* On a pointer device the checkbox appears on hover, keeping the default list
     clean. On touch there is no hover, so it is always there — otherwise
     multi-select would be unreachable on a phone. */
  .mark {
    display: flex;
    align-items: center;
    flex: none;
    align-self: center;
  }

  @media (hover: hover) and (pointer: fine) {
    .mark {
      display: none;
    }

    .mark--visible,
    .item:hover .mark,
    .item:focus-within .mark {
      display: flex;
    }
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

  .actions {
    display: flex;
    align-items: center;
    flex: none;
    padding: 2px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  .actions:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  @media (hover: hover) and (pointer: fine) {
    .actions {
      opacity: 0;
    }

    .item:hover .actions,
    .actions:focus-visible {
      opacity: 1;
    }
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
