<script lang="ts">
  import Icon from './Icon.svelte'
  import type { MenuItem } from '$lib/ui-types'

  interface Props {
    items: MenuItem[]
    /** Viewport coordinates of the top-left corner the menu should hang from. */
    x: number
    y: number
    onclose: () => void
  }

  let { items, x, y, onclose }: Props = $props()

  let element = $state<HTMLElement | null>(null)
  /** Null until the menu has been measured, so it never flashes at the wrong spot. */
  let position = $state<{ x: number; y: number } | null>(null)

  // Flip the menu back inside the viewport once its real size is known.
  $effect(() => {
    if (!element) return
    const rect = element.getBoundingClientRect()
    const maxX = innerWidth - rect.width - 8
    const maxY = innerHeight - rect.height - 8
    position = { x: Math.max(8, Math.min(x, maxX)), y: Math.max(8, Math.min(y, maxY)) }
    element.focus()
  })

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onclose()
    }
  }
</script>

<svelte:window onresize={onclose} />

<!-- The backdrop swallows the click that would otherwise reach the page. -->
<div
  class="backdrop"
  role="presentation"
  onpointerdown={onclose}
  oncontextmenu={(e) => {
    e.preventDefault()
    onclose()
  }}
></div>

<div
  class="menu"
  bind:this={element}
  role="menu"
  tabindex="-1"
  style="left: {position?.x ?? x}px; top: {position?.y ?? y}px; visibility: {position
    ? 'visible'
    : 'hidden'}"
  onkeydown={onKeydown}
>
  {#each items as item, i (i)}
    {#if item.separatorBefore}
      <hr class="separator" />
    {/if}
    <button
      class="item"
      data-testid="menu-item"
      class:item--danger={item.danger}
      role="menuitem"
      onclick={() => {
        onclose()
        item.run()
      }}
    >
      {#if item.icon}<Icon name={item.icon} size={14} />{:else}<span class="spacer"></span>{/if}
      <span>{item.label}</span>
    </button>
  {/each}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  .menu {
    position: fixed;
    z-index: 41;
    min-width: 180px;
    padding: var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    box-shadow: var(--shadow-2);
  }

  .menu:focus {
    outline: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }

  .item:hover {
    background: var(--surface-3);
  }

  .item--danger {
    color: var(--danger);
  }

  .item--danger:hover {
    background: var(--danger-soft);
  }

  .spacer {
    width: 14px;
  }

  .separator {
    height: 1px;
    margin: var(--space-1) 0;
    border: none;
    background: var(--border);
  }
</style>
