<script lang="ts">
  import Icon from './Icon.svelte'
  import { addCard, addColumn, moveCard, parseBoard, removeCard, renameColumn, updateCardText } from '$lib/md/board'

  interface Props {
    body: string
    readOnly?: boolean
    onchange: (body: string) => void
  }

  let { body, readOnly = false, onchange }: Props = $props()

  let columns = $derived(parseBoard(body))
  let drafts = $state<Record<number, string>>({})
  let dragging = $state<number | null>(null)
  let dropTarget = $state<{ column: number; index: number } | null>(null)

  function submitCard(columnIndex: number) {
    const text = (drafts[columnIndex] ?? '').trim()
    if (!text) return
    onchange(addCard(body, columnIndex, text))
    drafts = { ...drafts, [columnIndex]: '' }
  }

  function onDrop(columnIndex: number, cardIndex: number) {
    const from = dragging
    dragging = null
    dropTarget = null
    if (from === null) return
    onchange(moveCard(body, from, columnIndex, cardIndex))
  }
</script>

<div class="board">
  {#each columns as column, columnIndex (column.line)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <section
      class="column"
      class:column--target={dropTarget?.column === columnIndex}
      ondragover={(e) => {
        if (dragging === null) return
        e.preventDefault()
        dropTarget = { column: columnIndex, index: column.cards.length }
      }}
      ondrop={(e) => {
        e.preventDefault()
        onDrop(columnIndex, dropTarget?.column === columnIndex ? dropTarget.index : column.cards.length)
      }}
    >
      <header class="head">
        {#if column.line >= 0 && !readOnly}
          <input
            class="title"
            value={column.title}
            onchange={(e) => onchange(renameColumn(body, column.line, e.currentTarget.value))}
          />
        {:else}
          <span class="title title--static">{column.title}</span>
        {/if}
        <span class="count faint">{column.cards.length}</span>
      </header>

      <div class="cards">
        {#each column.cards as card, cardIndex (card.line)}
          <article
            class="card"
            class:card--done={card.done}
            class:card--dragging={dragging === card.line}
            draggable={!readOnly}
            role="listitem"
            ondragstart={() => (dragging = card.line)}
            ondragend={() => {
              dragging = null
              dropTarget = null
            }}
            ondragover={(e) => {
              if (dragging === null) return
              e.preventDefault()
              e.stopPropagation()
              dropTarget = { column: columnIndex, index: cardIndex }
            }}
            ondrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDrop(columnIndex, cardIndex)
            }}
          >
            {#if dropTarget?.column === columnIndex && dropTarget.index === cardIndex}
              <span class="drop-line"></span>
            {/if}
            <input
              class="card-text"
              value={card.text}
              disabled={readOnly}
              onchange={(e) => onchange(updateCardText(body, card.line, e.currentTarget.value))}
            />
            {#if !readOnly}
              <button class="remove" aria-label="Delete card" onclick={() => onchange(removeCard(body, card.line))}>
                <Icon name="x" size={12} />
              </button>
            {/if}
          </article>
        {/each}
      </div>

      {#if !readOnly}
        <form
          class="add"
          onsubmit={(e) => {
            e.preventDefault()
            submitCard(columnIndex)
          }}
        >
          <input
            class="new"
            placeholder="Add a card"
            value={drafts[columnIndex] ?? ''}
            oninput={(e) => (drafts = { ...drafts, [columnIndex]: e.currentTarget.value })}
          />
        </form>
      {/if}
    </section>
  {/each}

  {#if !readOnly}
    <button class="column column--new" onclick={() => onchange(addColumn(body, 'New column'))}>
      <Icon name="plus" size={16} />
      Add column
    </button>
  {/if}

  {#if columns.length === 0 && readOnly}
    <p class="faint">This note has no headings to use as columns.</p>
  {/if}
</div>

<style>
  .board {
    display: flex;
    gap: var(--space-3);
    height: 100%;
    padding: 0 var(--space-4) var(--space-4);
    overflow-x: auto;
    overflow-y: hidden;
  }

  .column {
    display: flex;
    flex-direction: column;
    flex: none;
    width: 260px;
    min-height: 0;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
  }

  .column--target {
    border-color: var(--accent);
  }

  .column--new {
    align-items: center;
    justify-content: center;
    flex-direction: row;
    gap: var(--space-2);
    width: 160px;
    border-style: dashed;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  .column--new:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-1) var(--space-2);
  }

  .title {
    flex: 1;
    min-width: 0;
    height: 24px;
    padding: 0 var(--space-1);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .title--static {
    line-height: 24px;
  }

  .title:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--surface);
  }

  .count {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .cards {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .card {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    cursor: grab;
  }

  .card--dragging {
    opacity: 0.4;
  }

  .card--done .card-text {
    color: var(--text-faint);
    text-decoration: line-through;
  }

  .drop-line {
    position: absolute;
    top: -3px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent);
    border-radius: 2px;
  }

  .card-text {
    flex: 1;
    min-width: 0;
    padding: var(--space-1);
    border: none;
    background: none;
    font-size: 13px;
  }

  .card-text:focus {
    outline: none;
    background: var(--bg-2);
    border-radius: var(--radius-sm);
  }

  .remove {
    display: flex;
    flex: none;
    padding: 4px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    opacity: 0;
  }

  .card:hover .remove {
    opacity: 1;
  }

  .remove:hover {
    background: var(--danger-soft);
    color: var(--danger);
  }

  .add {
    padding-top: var(--space-1);
  }

  .new {
    width: 100%;
    height: 28px;
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    font-size: 13px;
    color: var(--text);
  }

  .new::placeholder {
    color: var(--text-faint);
  }

  .new:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--surface);
  }
</style>
