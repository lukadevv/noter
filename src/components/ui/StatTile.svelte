<script lang="ts">
  import Icon from '../Icon.svelte'
  import Ticker from './Ticker.svelte'

  interface Props {
    label: string
    icon: string
    value: number
    format?: (value: number) => string
    /** Secondary line under the number. */
    note?: string
    /** Positive, negative or neutral change; colours the note. */
    trend?: 'up' | 'down' | null
    /** A few recent values, oldest first, drawn as a sparkline. */
    series?: number[]
    /** Describes one sparkline point for its tooltip. */
    describe?: (value: number, index: number) => string
    tone?: string
    index?: number
    onclick?: () => void
  }

  let {
    label,
    icon,
    value,
    format,
    note,
    trend = null,
    series = [],
    describe,
    tone = 'var(--accent)',
    index = 0,
    onclick,
  }: Props = $props()

  const W = 120
  const H = 36
  let hover = $state<number | null>(null)

  let points = $derived.by(() => {
    if (series.length < 2) return []
    const max = Math.max(1, ...series)
    const step = W / (series.length - 1)
    // 2px of headroom so the line and its end dot are never clipped.
    return series.map((v, i) => ({ x: i * step, y: H - 3 - (v / max) * (H - 6), v }))
  })

  let line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(''))
  let area = $derived(points.length ? `${line}L${W},${H}L0,${H}Z` : '')

  let hovered = $derived(hover === null ? null : (points[hover] ?? null))

  function onMove(event: PointerEvent) {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    hover = Math.round(ratio * (points.length - 1))
  }
</script>

<svelte:element
  this={onclick ? 'button' : 'div'}
  class="tile surface enter"
  class:surface--interactive={!!onclick}
  style="--i: {index}; --tone: {tone}"
  role={onclick ? undefined : 'group'}
  aria-label={onclick ? undefined : label}
  {onclick}
>
  <span class="label"><span class="dot"><Icon name={icon} size={13} /></span>{label}</span>
  <span class="value"><Ticker {value} {format} /></span>
  {#if note}
    <span class="note" class:up={trend === 'up'} class:down={trend === 'down'}>
      {#if trend}<Icon name={trend === 'up' ? 'arrow-up' : 'arrow-down'} size={12} />{/if}
      {note}
    </span>
  {/if}
  {#if points.length}
    <svg
      class="spark"
      viewBox="0 0 {W} {H}"
      preserveAspectRatio="none"
      aria-hidden="true"
      onpointermove={onMove}
      onpointerleave={() => (hover = null)}
    >
      <path class="area" d={area} />
      <path class="line" d={line} pathLength="1" />
      {#if hovered}
        <line class="cross" x1={hovered.x} x2={hovered.x} y1="0" y2={H} />
      {/if}
    </svg>
    {#if hovered && hover !== null && describe}
      <span class="tip" style="left: {Math.min(80, Math.max(20, (hovered.x / W) * 100))}%"
        >{describe(hovered.v, hover)}</span
      >
    {/if}
  {/if}
</svelte:element>

<style>
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-4) + 20px);
    overflow: hidden;
    color: var(--text);
    text-align: start;
    font: inherit;
  }

  .label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-dim);
    font-size: var(--text-md);
    font-weight: 500;
  }

  .dot {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    background: color-mix(in oklab, var(--tone) 16%, transparent);
    color: var(--tone);
  }

  .value {
    margin-top: var(--space-1);
    font-size: var(--text-3xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .note {
    display: flex;
    align-items: center;
    gap: 2px;
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .note.up {
    color: var(--ok);
  }

  .note.down {
    color: var(--text-dim);
  }

  .spark {
    position: absolute;
    inset: auto 0 0 0;
    width: 100%;
    height: 36px;
    overflow: visible;
  }

  .area {
    fill: color-mix(in oklab, var(--tone) 12%, transparent);
  }

  .line {
    fill: none;
    stroke: var(--tone);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
    stroke-linecap: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: draw-line 900ms var(--ease-out) 200ms forwards;
  }

  .cross {
    stroke: var(--text-faint);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .tip {
    position: absolute;
    bottom: 40px;
    transform: translateX(-50%);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--surface-3);
    box-shadow: var(--shadow-2);
    color: var(--text);
    font-size: var(--text-xs);
    white-space: nowrap;
    pointer-events: none;
  }

  @keyframes draw-line {
    to {
      stroke-dashoffset: 0;
    }
  }
</style>
