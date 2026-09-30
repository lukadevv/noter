<script lang="ts">
  /**
   * A check mark that draws itself, with a ring that bursts outward: the
   * moment a dose is logged or a habit is done should feel like something.
   * Remount it (e.g. inside {#key}) to replay.
   */
  interface Props {
    size?: number
    color?: string
  }

  let { size = 28, color = 'var(--ok)' }: Props = $props()
</script>

<span class="burst" style="--c: {color}; width: {size}px; height: {size}px" aria-hidden="true">
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <circle class="disc" cx="12" cy="12" r="11" />
    <path class="tick" d="M7 12.5l3.2 3.2L17 9" />
  </svg>
</span>

<style>
  .burst {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
  }

  .burst::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--c);
    opacity: 0;
    animation: ring 600ms var(--ease-out) 80ms;
  }

  .disc {
    fill: var(--c);
    transform-origin: center;
    animation: disc 360ms var(--ease-spring) both;
  }

  .tick {
    fill: none;
    stroke: var(--bg);
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 16;
    stroke-dashoffset: 16;
    animation: draw 300ms var(--ease-out) 160ms forwards;
  }

  @keyframes disc {
    from {
      transform: scale(0.3);
      opacity: 0;
    }
  }

  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes ring {
    from {
      transform: scale(0.8);
      opacity: 0.7;
    }
    to {
      transform: scale(1.9);
      opacity: 0;
    }
  }
</style>
