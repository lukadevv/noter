<script lang="ts">
  import Icon from './Icon.svelte'
  import { BLOCKS, type BlockKind } from '$lib/md/blocks'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    oninsert: (kind: BlockKind) => void
  }

  let { oninsert }: Props = $props()

  /** Headings, lists, rich blocks, media, extras: the same order as the `/` menu. */
  const GROUPS: BlockKind[][] = [
    ['h1', 'h2', 'h3'],
    ['task', 'bullet', 'numbered'],
    ['quote', 'callout', 'code', 'table'],
    ['image', 'gallery', 'board'],
    ['divider', 'date'],
  ]

  const groups = GROUPS.map((kinds) => kinds.map((kind) => BLOCKS.find((b) => b.kind === kind)!))
</script>

<!-- A pointerdown that does not move focus keeps the cursor where it was in
     the note, and on a phone keeps the keyboard open. -->
<div class="bar" role="toolbar" aria-label={t('blocks.insertBar')} data-testid="insert-bar">
  {#each groups as group, index (index)}
    {#if index > 0}<span class="sep" aria-hidden="true"></span>{/if}
    {#each group as block (block.kind)}
      <button
        type="button"
        class="item"
        data-insert={block.kind}
        aria-label={t(block.label)}
        title={t(block.label)}
        onpointerdown={(e) => e.preventDefault()}
        onclick={() => oninsert(block.kind)}
      >
        <Icon name={block.icon} size={17} />
      </button>
    {/each}
  {/each}
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    padding: 6px var(--space-3);
    overflow-x: auto;
    border-top: 1px solid var(--border);
    background: var(--bg-2);
    scrollbar-width: none;
  }

  .bar::-webkit-scrollbar {
    display: none;
  }

  .item {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 34px;
    height: 32px;
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: var(--text-dim);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background var(--dur-1),
      color var(--dur-1),
      transform var(--dur-1);
  }

  .item:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .item:active {
    transform: scale(0.92);
  }

  .sep {
    flex-shrink: 0;
    width: 1px;
    height: 18px;
    margin: 0 var(--space-1);
    background: var(--border);
  }
</style>
