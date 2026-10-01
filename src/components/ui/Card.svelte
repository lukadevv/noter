<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from '../Icon.svelte'

  interface Props {
    /** Heading shown in the card's top row. */
    title?: string
    icon?: string
    /** CSS colour tinting the icon badge. */
    tone?: string
    /** Stagger index for the entrance animation. */
    index?: number
    testid?: string
    class?: string
    /** Right-hand side of the heading row: a link, a button, a count. */
    action?: Snippet
    children: Snippet
  }

  let { title, icon, tone, index = 0, testid, class: className = '', action, children }: Props = $props()
</script>

<section
  class="card surface enter {className}"
  style="--i: {index}; {tone ? `--tone: ${tone}` : ''}"
  data-testid={testid}
>
  {#if title || action}
    <header class="head">
      {#if icon}
        <span class="badge"><Icon name={icon} size={15} /></span>
      {/if}
      {#if title}<h2 class="title-sm truncate">{title}</h2>{/if}
      {#if action}<div class="action">{@render action()}</div>{/if}
    </header>
  {/if}
  {@render children()}
</section>

<style>
  .card {
    --tone: var(--accent);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-4);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 28px;
  }

  .badge {
    display: grid;
    place-items: center;
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: var(--radius);
    background: color-mix(in oklab, var(--tone) 16%, transparent);
    color: var(--tone);
  }

  h2 {
    flex: 1;
    min-width: 0;
  }

  .action {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-inline-start: auto;
  }
</style>
