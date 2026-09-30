<script lang="ts">
  interface Props {
    /** Number of placeholder rows. */
    rows?: number
  }

  let { rows = 4 }: Props = $props()
</script>

<div class="skeleton" aria-busy="true" aria-live="polite">
  {#each Array.from({ length: rows }, (_, i) => i) as i (i)}
    <div class="bar" style="width: {90 - ((i * 17) % 40)}%"></div>
  {/each}
</div>

<style>
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
  }

  .bar {
    height: 14px;
    border-radius: var(--radius-sm);
    background: linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2));
    background-size: 200% 100%;
    animation: shimmer 1.2s linear infinite;
  }

  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
</style>
