<script lang="ts">
  import type { ActivityDay } from '$lib/db/schema'
  import { heatmap, type HeatCell } from '$lib/stats/home'
  import { parseDayKey } from '$lib/utils/dates'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    rows: ActivityDay[]
    today: string
  }

  let { rows, today }: Props = $props()

  const GAP = 3
  const LEFT = 28
  const TOP = 16
  /** Cells grow to fill the card, between these sizes. */
  const MIN_CELL = 10
  const MAX_CELL = 16

  let width = $state(0)
  // As many weeks as fit, within reason: half a year on a desktop, two months on a phone.
  let weeks = $derived(Math.max(8, Math.min(26, Math.floor((width - LEFT) / (MIN_CELL + GAP)) || 20)))
  let cellSize = $derived(Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((width - LEFT) / weeks) - GAP)))
  let step = $derived(cellSize + GAP)
  let grid = $derived(heatmap(rows, today, weeks))
  let active = $derived(grid.flat().filter((c) => c.value > 0))

  const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short' })
  const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })

  /** A month name above the first week that starts in it. */
  let months = $derived(
    grid.flatMap((column, index) => {
      const first = parseDayKey(column[0]!.day)!
      const previous = index > 0 ? parseDayKey(grid[index - 1]![0]!.day)! : null
      if (previous && previous.getMonth() === first.getMonth()) return []
      // The first column only gets a label if its month continues long enough to fit it.
      if (index === 0 && first.getDate() > 21) return []
      return [{ x: LEFT + index * step, label: monthFormat.format(first) }]
    }),
  )

  // Monday, Wednesday and Friday are enough to read the rows.
  const weekdays = [0, 2, 4].map((row) => ({
    row,
    label: weekdayFormat.format(new Date(2026, 8, 28 + row)),
  }))

  let tip = $state<{ cell: HeatCell; x: number; y: number } | null>(null)

  function describe(cell: HeatCell): string {
    return t('home.activity.cell', { count: cell.value, date: dayFormat.format(parseDayKey(cell.day)!) })
  }
</script>

<div class="heatmap" bind:clientWidth={width}>
  <svg
    width={LEFT + weeks * step}
    height={TOP + 7 * step}
    role="img"
    aria-label={t('home.activity.summary', { count: active.length, weeks })}
    onpointerleave={() => (tip = null)}
  >
    {#each months as month (month.x)}
      <text class="axis" x={month.x} y={10}>{month.label}</text>
    {/each}
    {#each weekdays as weekday (weekday.row)}
      <text class="axis" x={0} y={TOP + weekday.row * step + cellSize - 2}>{weekday.label}</text>
    {/each}
    {#each grid as column, w (column[0]!.day)}
      {#each column as cell, d (cell.day)}
        {#if !cell.future}
          <rect
            class="cell level-{cell.level}"
            class:today={cell.day === today}
            x={LEFT + w * step}
            y={TOP + d * step}
            width={cellSize}
            height={cellSize}
            rx={Math.round(cellSize / 4)}
            role="presentation"
            onpointerenter={() => (tip = { cell, x: LEFT + w * step + cellSize / 2, y: TOP + d * step })}
          />
        {/if}
      {/each}
    {/each}
  </svg>

  {#if tip}
    <div class="tip" style="left: {tip.x}px; top: {tip.y}px" aria-hidden="true">
      <strong>{t('home.activity.edits', { count: tip.cell.value })}</strong>
      <span>{dayFormat.format(parseDayKey(tip.cell.day)!)}</span>
    </div>
  {/if}

  <div class="legend" aria-hidden="true">
    <span>{t('home.activity.less')}</span>
    {#each [0, 1, 2, 3, 4] as level (level)}
      <span class="swatch level-{level}"></span>
    {/each}
    <span>{t('home.activity.more')}</span>
  </div>

  <!-- The same data for screen readers: only the days that had any. -->
  <table class="sr-only">
    <caption>{t('home.activity.title')}</caption>
    <tbody>
      {#each active as cell (cell.day)}
        <tr><td>{describe(cell)}</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .heatmap {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  svg {
    display: block;
    max-width: 100%;
    overflow: visible;
  }

  .axis {
    fill: var(--text-faint);
    font-size: 10px;
  }

  /* One hue, light to dark: the accent mixed into the surface in four steps. */
  .level-0 {
    fill: var(--surface-3);
    background: var(--surface-3);
  }

  .level-1 {
    fill: color-mix(in oklab, var(--accent) 30%, var(--surface));
    background: color-mix(in oklab, var(--accent) 30%, var(--surface));
  }

  .level-2 {
    fill: color-mix(in oklab, var(--accent) 55%, var(--surface));
    background: color-mix(in oklab, var(--accent) 55%, var(--surface));
  }

  .level-3 {
    fill: color-mix(in oklab, var(--accent) 78%, var(--surface));
    background: color-mix(in oklab, var(--accent) 78%, var(--surface));
  }

  .level-4 {
    fill: var(--accent);
    background: var(--accent);
  }

  .cell {
    transition: opacity var(--dur-1);
  }

  .cell:hover {
    stroke: var(--text);
    stroke-width: 1.5;
  }

  .today {
    stroke: var(--text-dim);
    stroke-width: 1;
  }

  .tip {
    position: absolute;
    z-index: 2;
    display: flex;
    flex-direction: column;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    box-shadow: var(--shadow-2);
    color: var(--text-dim);
    font-size: var(--text-sm);
    white-space: nowrap;
    pointer-events: none;
    transform: translate(-50%, calc(-100% - 6px));
  }

  .tip strong {
    color: var(--text);
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 3px;
    align-self: flex-end;
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .legend span:first-child {
    margin-inline-end: 4px;
  }

  .legend span:last-child {
    margin-inline-start: 4px;
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
</style>
