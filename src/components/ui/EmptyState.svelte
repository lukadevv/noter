<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from '../Icon.svelte'

  interface Props {
    icon: string
    title: string
    body?: string
    children?: Snippet
  }

  let { icon, title, body, children }: Props = $props()
</script>

<div class="empty enter">
  <div class="badge"><Icon name={icon} size={26} strokeWidth={1.5} /></div>
  <h3>{title}</h3>
  {#if body}<p>{body}</p>{/if}
  {#if children}<div class="actions">{@render children()}</div>{/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-4);
    color: var(--text-dim);
    max-width: 26rem;
    margin: 0 auto;
  }

  .badge {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: var(--radius-lg);
    background: var(--accent-soft);
    color: var(--accent);
    margin-bottom: var(--space-2);
  }

  h3 {
    color: var(--text);
    font-size: var(--text-lg);
    font-weight: 600;
  }

  p {
    font-size: var(--text-md);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
</style>
