<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title?: string
    description?: string
    children: Snippet
  }

  let { title, description, children }: Props = $props()
</script>

<section class="group">
  {#if title}<h3>{title}</h3>{/if}
  {#if description}<p class="description">{description}</p>{/if}
  <div class="card">
    {@render children()}
  </div>
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  h3 {
    font-size: var(--text-sm);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .description {
    color: var(--text-faint);
    font-size: var(--text-md);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .card > :global(* + *) {
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
</style>
