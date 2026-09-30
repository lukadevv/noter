<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    /** 0 to 1. */
    value: number
    size?: number
    stroke?: number
    /** CSS colour for the progress arc. */
    color?: string
    label?: string
    children?: Snippet
  }

  let { value, size = 56, stroke = 5, color = 'var(--accent)', label, children }: Props = $props()

  let radius = $derived((size - stroke) / 2)
  let circumference = $derived(2 * Math.PI * radius)
  let clamped = $derived(Math.min(1, Math.max(0, value)))
</script>

<div
  class="ring"
  style="width:{size}px;height:{size}px"
  role={label ? 'progressbar' : undefined}
  aria-label={label}
  aria-valuemin={label ? 0 : undefined}
  aria-valuemax={label ? 100 : undefined}
  aria-valuenow={label ? Math.round(clamped * 100) : undefined}
>
  <svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke="var(--surface-3)"
      stroke-width={stroke}
    />
    <circle
      class="arc"
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke={color}
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={circumference * (1 - clamped)}
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  </svg>
  {#if children}
    <div class="center">{@render children()}</div>
  {/if}
</div>

<style>
  .ring {
    position: relative;
    flex: none;
  }

  .arc {
    transition: stroke-dashoffset var(--dur-3) var(--ease-out);
  }

  .center {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
</style>
