<script lang="ts">
  import Icon from './Icon.svelte'
  import { menu } from '$lib/stores/menu.svelte'
  import type { MenuItem } from '$lib/ui-types'
  import {
    addCard,
    addColumn,
    moveCard,
    parseBoard,
    removeCard,
    renameColumn,
    updateCardText,
  } from '$lib/md/board'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    body: string
    readOnly?: boolean
    /** Drawn inside a note (a ```board block) rather than filling a pane. */
    inline?: boolean
    onchange: (body: string) => void
  }

  let { body, readOnly = false, inline = false, onchange }: Props = $props()

  let columns = $derived(parseBoard(body))
  let drafts = $state<Record<number, string>>({})
  let dragging = $state<number | null>(null)
  let dropTarget = $state<{ column: number; index: number } | null>(null)

  /**
   * Cards can also be moved from a menu.
   *
   * Drag and drop is unavailable to keyboard users and does not exist at all on
   * touch, so it cannot be the only way to move a card between columns.
   */
  function openCardMenu(event: MouseEvent, cardLine: number, fromColumn: number) {
    const items: MenuItem[] = [
      ...columns
        .map((column, index) => ({ column, index }))
        .filter(({ index }) => index !== fromColumn)
        .map(({ column, index }) => ({
          label: t('board.moveTo', { column: column.title }),
          icon: 'layout-grid',
          run: () => onchange(moveCard(body, cardLine, index, column.cards.length)),
        })),
      {
        label: t('board.deleteCard'),
        icon: 'trash',
        danger: true,
        separatorBefore: true,
        run: () => onchange(removeCard(body, cardLine)),
      },
    ]
    menu.open(items, event.currentTarget as HTMLElement, t('board.cardActions'))
  }

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

<div class="board" class:board--inline={inline}>
  {#each columns as column, columnIndex (column.line)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <section
      class="column"
      data-testid="board-column"
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
            data-testid="board-card"
            class:card--done={card.done}
            class:card--dragging={dragging === card.line}
            draggable={!readOnly}
            role="listitem"
            ondragstart={(e) => {
              // Firefox starts no drag without data; the payload itself is unused.
              e.dataTransfer?.setData('text/plain', card.text)
              dragging = card.line
            }}
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
              <button
                class="card-menu"
                aria-label={t('board.cardActions')}
                onclick={(event) => openCardMenu(event, card.line, columnIndex)}
              >
                <Icon name="more" size={13} />
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
            placeholder={t('board.addCard')}
            value={drafts[columnIndex] ?? ''}
            oninput={(e) => (drafts = { ...drafts, [columnIndex]: e.currentTarget.value })}
          />
          <!-- Enter still works; the button is what makes this reachable with a
               mouse or on a phone. -->
          <button
            class="btn btn--primary add-button"
            aria-label={t('common.add')}
            disabled={!(drafts[columnIndex] ?? '').trim()}
          >
            <Icon name="plus" size={14} />
          </button>
        </form>
      {/if}
    </section>
  {/each}

  {#if !readOnly}
    <button class="column column--new" onclick={() => onchange(addColumn(body, t('board.newColumn')))}>
      <Icon name="plus" size={16} />
      {t('board.addColumn')}
    </button>
  {/if}

  {#if columns.length === 0 && readOnly}
    <p class="faint">{t('board.noHeadings')}</p>
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

  .board--inline {
    height: auto;
    max-height: 520px;
    padding: 0 0 var(--space-2);
    overflow-y: auto;
  }

  .board--inline .column {
    max-height: 500px;
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
    inset-inline: 0;
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

  .card-menu {
    display: flex;
    flex: none;
    padding: 4px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  .card-menu:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  /* Only hide it behind hover where hover exists; on touch it must stay put. */
  @media (hover: hover) and (pointer: fine) {
    .card-menu {
      opacity: 0;
    }

    .card:hover .card-menu,
    .card-menu:focus-visible {
      opacity: 1;
    }
  }

  .add {
    display: flex;
    gap: var(--space-1);
    padding-top: var(--space-1);
  }

  .add-button {
    flex: none;
    width: 28px;
    height: 28px;
    padding: 0;
  }

  .add-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .new {
    flex: 1;
    min-width: 0;
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
