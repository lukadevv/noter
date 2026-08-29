<script lang="ts">
  import Icon from './Icon.svelte'
  import { buildActions, type Action } from '$lib/actions'
  import { fuzzyScore } from '$lib/utils/fuzzy'
  import { notes } from '$lib/stores/notes.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { derivedTitle, preview } from '$lib/db/repo/notes'
  import { searchIndex } from '$lib/search/index'
  import { parseQuery } from '$lib/search/query'

  interface Props {
    onclose: () => void
    onsettings: () => void
    ondaily: () => void
  }

  let { onclose, onsettings, ondaily }: Props = $props()

  let query = $state('')
  let cursor = $state(0)
  let input = $state<HTMLInputElement | null>(null)
  let listElement = $state<HTMLElement | null>(null)

  type Row =
    | { kind: 'action'; action: Action }
    | { kind: 'note'; id: string; title: string; snippet: string }
    | { kind: 'tag'; tag: string; count: number }
    | { kind: 'search'; query: string }

  /**
   * A leading `>` restricts to commands and `#` to tags, the convention most
   * palettes use. With no prefix the palette shows both commands and notes,
   * because "open the thing I mean" is the common case.
   */
  let mode = $derived(query.startsWith('>') ? 'actions' : query.startsWith('#') ? 'tags' : 'mixed')
  let term = $derived(mode === 'mixed' ? query.trim() : query.slice(1).trim())

  let rows: Row[] = $derived.by(() => {
    const actions = buildActions({ settings: onsettings, daily: ondaily })
    const out: Row[] = []

    if (mode === 'tags') {
      for (const [tag, count] of notes.tagCounts) {
        if (!term || fuzzyScore(term, tag) !== null) out.push({ kind: 'tag', tag, count })
      }
      return out.slice(0, 40)
    }

    if (mode !== 'notes') {
      const scored = actions
        .map((action) => ({ action, score: fuzzyScore(term, action.label) }))
        .filter((entry): entry is { action: Action; score: number } => entry.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, mode === 'actions' ? 40 : 6)
      out.push(...scored.map(({ action }) => ({ kind: 'action' as const, action })))
    }

    if (mode === 'mixed' && term) {
      const parsed = parseQuery(term)
      const usesFilters = JSON.stringify(parsed.node ?? {}).includes('"field"')
      const matched = usesFilters
        ? notes.runQuery(term).slice(0, 20)
        : searchIndex
            .search([term], 20)
            .map((result) => notes.notes.find((n) => n.id === result.id))
            .filter((note): note is NonNullable<typeof note> => Boolean(note))

      out.push(
        ...matched.map((note) => ({
          kind: 'note' as const,
          id: note.id,
          title: derivedTitle(note),
          snippet: preview(note.body, 90),
        })),
      )

      if (matched.length > 0 || usesFilters) out.push({ kind: 'search', query: term })
    }

    return out
  })

  // Keep the highlighted row inside the result set as it shrinks while typing.
  $effect(() => {
    void rows
    if (cursor >= rows.length) cursor = Math.max(0, rows.length - 1)
  })

  $effect(() => {
    input?.focus()
  })

  $effect(() => {
    void cursor
    listElement?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  })

  function activate(row: Row) {
    onclose()
    switch (row.kind) {
      case 'action':
        void row.action.run()
        break
      case 'note':
        notes.select(row.id)
        if (ui.narrow) ui.showPane('note')
        break
      case 'tag':
        notes.setScope({ kind: 'tag', tag: row.tag })
        if (ui.narrow) ui.showPane('list')
        break
      case 'search':
        notes.setScope({ kind: 'search', query: row.query })
        if (ui.narrow) ui.showPane('list')
        break
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      cursor = rows.length === 0 ? 0 : (cursor + 1) % rows.length
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      cursor = rows.length === 0 ? 0 : (cursor - 1 + rows.length) % rows.length
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[cursor]
      if (row) activate(row)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onclose()
    }
  }
</script>

<div class="backdrop" role="presentation" onpointerdown={onclose}></div>

<div class="palette" data-testid="palette" role="dialog" aria-modal="true" aria-label="Command palette">
  <div class="field">
    <Icon name="search" size={16} />
    <input
      bind:this={input}
      bind:value={query}
      class="input-bare"
      data-testid="palette-input"
      placeholder="Search notes, or type > for commands and # for tags"
      aria-label="Search or run a command"
      onkeydown={onKeydown}
    />
    <kbd>Esc</kbd>
  </div>

  <div class="results" bind:this={listElement} role="listbox" aria-label="Results">
    {#each rows as row, index (row.kind + (row.kind === 'action' ? row.action.id : row.kind === 'note' ? row.id : row.kind === 'tag' ? row.tag : row.query))}
      <button
        class="row"
        data-testid="palette-row"
        class:row--active={index === cursor}
        data-active={index === cursor}
        role="option"
        aria-selected={index === cursor}
        onmouseenter={() => (cursor = index)}
        onclick={() => activate(row)}
      >
        {#if row.kind === 'action'}
          <Icon name={row.action.icon ?? 'chevron-right'} size={15} />
          <span class="label truncate">{row.action.label}</span>
          <span class="meta faint">{row.action.hint ?? row.action.group}</span>
        {:else if row.kind === 'note'}
          <Icon name="file-text" size={15} />
          <span class="label truncate">{row.title}</span>
          <span class="meta faint truncate">{row.snippet}</span>
        {:else if row.kind === 'tag'}
          <Icon name="tag" size={15} />
          <span class="label truncate">#{row.tag}</span>
          <span class="meta faint">{row.count}</span>
        {:else}
          <Icon name="search" size={15} />
          <span class="label truncate">Search for “{row.query}”</span>
          <span class="meta faint">All matches</span>
        {/if}
      </button>
    {/each}

    {#if rows.length === 0}
      <p class="empty faint">
        {#if term}No matches for “{term}”.{:else}Type to search.{/if}
      </p>
    {/if}
  </div>

  <footer class="hints faint">
    <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
    <span><kbd>↵</kbd> open</span>
    <span><kbd>&gt;</kbd> commands</span>
    <span><kbd>#</kbd> tags</span>
  </footer>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 55;
    background: var(--overlay);
  }

  .palette {
    position: fixed;
    z-index: 56;
    top: 12vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(94vw, 40rem);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-2);
    overflow: hidden;
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: 1px solid var(--border);
    color: var(--text-faint);
  }

  .input-bare {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    color: var(--text);
    font-size: 15px;
  }

  .input-bare:focus {
    outline: none;
  }

  .input-bare::placeholder {
    color: var(--text-faint);
  }

  .results {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-1);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius);
    background: none;
    color: var(--text-dim);
    text-align: left;
    cursor: pointer;
  }

  .row--active {
    background: var(--accent-soft);
    color: var(--text);
  }

  .label {
    flex: 1;
    min-width: 0;
    color: var(--text);
  }

  .meta {
    flex: none;
    max-width: 45%;
    font-size: 11px;
  }

  .empty {
    padding: var(--space-5);
    text-align: center;
    font-size: 13px;
  }

  .hints {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--border);
    font-size: 11px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .hints::-webkit-scrollbar {
    display: none;
  }

  .hints span {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  kbd {
    padding: 1px 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-dim);
  }
</style>
