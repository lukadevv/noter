<script lang="ts">
  import Icon from './Icon.svelte'
  import { notes } from '$lib/stores/notes.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { derivedTitle } from '$lib/db/repo/notes'

  interface Props {
    noteId: string
  }

  let { noteId }: Props = $props()

  let open = $state(false)
  let entries = $derived(notes.backlinks.get(noteId) ?? [])

  function titleOf(id: string): string {
    const note = notes.notes.find((n) => n.id === id)
    return note ? derivedTitle(note) : 'Untitled'
  }
</script>

{#if entries.length > 0}
  <section class="backlinks">
    <button class="head" onclick={() => (open = !open)} aria-expanded={open}>
      <Icon name="link" size={13} />
      <span>{entries.length} {entries.length === 1 ? 'note links' : 'notes link'} here</span>
      <Icon name="chevron-right" size={13} class={open ? 'rotated' : ''} />
    </button>

    {#if open}
      <ul class="list">
        {#each entries as entry (entry.noteId + entry.context)}
          <li>
            <button
              class="entry"
              onclick={() => {
                notes.select(entry.noteId)
                if (ui.narrow) ui.showPane('note')
              }}
            >
              <span class="title truncate">{titleOf(entry.noteId)}</span>
              <span class="context truncate faint">{entry.context}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .backlinks {
    flex: none;
    border-top: 1px solid var(--border);
    background: var(--bg-2);
    max-height: 40%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: none;
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
  }

  .head:hover {
    color: var(--text);
  }

  .head span {
    flex: 1;
    text-align: left;
  }

  .head :global(.rotated) {
    transform: rotate(90deg);
  }

  .list {
    list-style: none;
    overflow-y: auto;
    padding: 0 var(--space-2) var(--space-2);
  }

  .entry {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius);
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .entry:hover {
    background: var(--surface-2);
  }

  .title {
    font-size: 13px;
    color: var(--text);
  }

  .context {
    font-size: 11px;
  }
</style>
