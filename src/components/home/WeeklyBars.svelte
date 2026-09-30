<script lang="ts">
  import { parseDayKey } from '$lib/utils/dates'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    weeks: { week: string; value: number }[]
    /** i18n key of the per-bar value, pluralised on `count`. */
    unit: string
  }

  let { weeks, unit }: Props = $props()

  const HEIGHT = 120
  const TOP = 18
  const BOTTOM = 20
  const BAR_MAX = 24

  let width = $state(0)
  let plot = $derived(HEIGHT - TOP - BOTTOM)
  let max = $derived(Math.max(1, ...weeks.map((w) => w.value)))
  let band = $derived(weeks.length ? width / weeks.length : 0)
  let bar = $derived(Math.max(4, Math.min(BAR_MAX, band - 6)))
  let peak = $derived(weeks.reduce((best, w, i) => (w.value > (weeks[best]?.value ?? 0) ? i : best), 0))

  const number = new Intl.NumberFormat(undefined, { notation: 'compact' })
  const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
  const weekLabel = (week: string) => dateFormat.format(parseDayKey(week)!)

  let hovered = $state<number | null>(null)

  /** Column with a 4px rounded cap and a square foot on the baseline. */
  function column(x: number, h: number, w: number): string {
    const r = Math.min(4, h, w / 2)
    const y = TOP + plot - h
    const base = TOP + plot
    return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`
  }

  /** Which bars get a value on their cap: the current week and the busiest. */
  const labelled = (i: number) => i === weeks.length - 1 || i === peak
</script>

<div class="bars" bind:clientWidth={width}>
  {#if width > 0}
    <svg {width} height={HEIGHT} aria-hidden="true" onpointerleave={() => (hovered = null)}>
      <line class="baseline" x1="0" x2={width} y1={TOP + plot + 0.5} y2={TOP + plot + 0.5} />
      {#each weeks as week, i (week.week)}
        {@const h = (week.value / max) * plot}
        {@const x = i * band + (band - bar) / 2}
        <g class:hovered={hovered === i}>
          <!-- The hit area is the whole band, not just the painted column. -->
          <rect
            class="hit"
            x={i * band}
            y={0}
            width={band}
            height={HEIGHT}
            role="presentation"
            onpointerenter={() => (hovered = i)}
          />
          {#if week.value > 0}
            <path
              class="column"
              class:current={i === weeks.length - 1}
              d={column(x, Math.max(h, 2), bar)}
            />
          {/if}
          {#if week.value > 0 && (labelled(i) || hovered === i)}
            <text class="value" x={x + bar / 2} y={TOP + plot - h - 5} text-anchor="middle"
              >{number.format(week.value)}</text
            >
          {/if}
        </g>
      {/each}
      {#each [0, Math.floor((weeks.length - 1) / 2), weeks.length - 1] as i (i)}
        <text class="axis" x={i * band + band / 2} y={HEIGHT - 4} text-anchor="middle"
          >{weekLabel(weeks[i]!.week)}</text
        >
      {/each}
    </svg>
  {/if}

  {#if hovered !== null && weeks[hovered]}
    {@const week = weeks[hovered]!}
    <div class="tip" style="left: {hovered * band + band / 2}px" aria-hidden="true">
      <strong>{t(unit, { count: week.value })}</strong>
      <span>{t('home.weekOf', { date: weekLabel(week.week) })}</span>
    </div>
  {/if}

  <table class="sr-only">
    <tbody>
      {#each weeks as week (week.week)}
        <tr>
          <th scope="row">{t('home.weekOf', { date: weekLabel(week.week) })}</th>
          <td>{t(unit, { count: week.value })}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .bars {
    position: relative;
    min-width: 0;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .baseline {
    stroke: var(--border);
    stroke-width: 1;
  }

  .hit {
    fill: transparent;
  }

  /* Past weeks recede; the current one is the accent. */
  .column {
    fill: color-mix(in oklab, var(--accent) 45%, var(--surface));
    transition: fill var(--dur-1);
  }

  .column.current,
  .hovered .column {
    fill: var(--accent);
  }

  .value {
    fill: var(--text);
    font-size: 11px;
    font-weight: 600;
  }

  .axis {
    fill: var(--text-faint);
    font-size: 10px;
  }

  .tip {
    position: absolute;
    top: 0;
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
    transform: translate(-50%, -100%);
  }

  .tip strong {
    color: var(--text);
  }
</style>
