<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    subtitle?: string
    /** Small line above the title, e.g. a date. */
    eyebrow?: string
    actions?: Snippet
  }

  let { title, subtitle, eyebrow, actions }: Props = $props()
</script>

<header class="page-header enter" data-tour="page-header">
  <div class="text">
    {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
    <h1>{title}</h1>
    {#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
  </div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .eyebrow {
    text-transform: capitalize;
  }

  h1 {
    font-size: var(--text-3xl);
    font-weight: 720;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .subtitle {
    max-width: 44rem;
    color: var(--text-dim);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  @media (max-width: 860px) {
    h1 {
      font-size: var(--text-2xl);
    }
  }
</style>
