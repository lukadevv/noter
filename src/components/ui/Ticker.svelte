<script lang="ts">
  import { untrack } from 'svelte'
  import { motion } from '$lib/ui/motion.svelte'

  interface Props {
    value: number
    /** Formats the in-between values too, so "1.2K" rolls as "1.1K", "1.2K". */
    format?: (value: number) => string
    duration?: number
  }

  let { value, format = (v) => String(Math.round(v)), duration = 600 }: Props = $props()

  // Starts at zero so the first render counts up: the number arriving is part
  // of what makes a dashboard feel alive.
  let shown = $state(0)

  $effect(() => {
    const target = value
    if (motion.level !== 'full') {
      shown = target
      return
    }
    const from = untrack(() => shown)
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      // easeOutExpo: quick, then settles.
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      shown = from + (target - from) * eased
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  })
</script>

<span class="ticker">{format(shown)}</span>

<style>
  .ticker {
    font-variant-numeric: tabular-nums;
  }
</style>
