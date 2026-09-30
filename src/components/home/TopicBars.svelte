<script lang="ts">
  interface Item {
    key: string
    label: string
    value: number
    onclick?: () => void
  }

  interface Props {
    items: Item[]
    /** Accessible name of each value, e.g. "3 notes". */
    describe: (value: number) => string
  }

  let { items, describe }: Props = $props()

  let max = $derived(Math.max(1, ...items.map((i) => i.value)))
</script>

<ul class="topics">
  {#each items as item (item.key)}
    <li>
      <button class="row" onclick={item.onclick} disabled={!item.onclick} title={describe(item.value)}>
        <span class="label truncate">{item.label}</span>
        <span class="track">
          <span class="bar" style="width: {(item.value / max) * 100}%"></span>
          <span class="value">{item.value}</span>
        </span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .topics {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(5rem, 9rem) 1fr;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: 5px var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }

  .row:disabled {
    cursor: default;
  }

  .row:not(:disabled):hover {
    background: var(--surface-2);
  }

  .row:not(:disabled):hover .bar {
    background: var(--accent);
  }

  .label {
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  .track {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  /* Grows from the start edge; only the data end is rounded. */
  .bar {
    height: 10px;
    min-width: 2px;
    border-start-end-radius: 4px;
    border-end-end-radius: 4px;
    background: color-mix(in oklab, var(--accent) 70%, var(--surface));
    transition:
      width var(--dur-3) var(--ease-out),
      background var(--dur-1);
  }

  .value {
    flex-shrink: 0;
    color: var(--text);
    font-size: var(--text-sm);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
