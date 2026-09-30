<script lang="ts" generics="T extends string">
  import Icon from '../Icon.svelte'

  interface Tab {
    value: T
    label: string
    icon?: string
    /** A small count or dot next to the label. */
    badge?: string | number | null
  }

  interface Props {
    tabs: Tab[]
    value: T
    label: string
    testid?: string
    onchange?: (value: T) => void
  }

  let { tabs, value = $bindable(), label, testid, onchange }: Props = $props()

  let list = $state<HTMLElement>()
  let indicator = $state({ left: 0, width: 0, ready: false })

  // The pill under the active tab slides from the old one to the new one.
  $effect(() => {
    void value
    void tabs.length
    const el = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!el) return
    const measure = () => {
      indicator = { left: el.offsetLeft, width: el.offsetWidth, ready: true }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  })

  function choose(next: T) {
    if (next === value) return
    value = next
    onchange?.(next)
  }

  function onKeydown(event: KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.value === value)
    const rtl = document.documentElement.dir === 'rtl'
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'
    let next = -1
    if (event.key === forward) next = (index + 1) % tabs.length
    else if (event.key === back) next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next < 0) return
    event.preventDefault()
    choose(tabs[next]!.value)
    list?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }
</script>

<div
  class="tabs"
  role="tablist"
  aria-label={label}
  data-testid={testid}
  tabindex="-1"
  bind:this={list}
  onkeydown={onKeydown}
>
  <span
    class="indicator"
    class:indicator--ready={indicator.ready}
    style="transform: translateX({indicator.left}px); width: {indicator.width}px"
    aria-hidden="true"
  ></span>
  {#each tabs as tab (tab.value)}
    <button
      type="button"
      role="tab"
      class="tab"
      class:tab--active={tab.value === value}
      aria-selected={tab.value === value}
      tabindex={tab.value === value ? 0 : -1}
      data-tab={tab.value}
      onclick={() => choose(tab.value)}
    >
      {#if tab.icon}<Icon name={tab.icon} size={15} />{/if}
      <span>{tab.label}</span>
      {#if tab.badge != null && tab.badge !== ''}<span class="badge">{tab.badge}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    position: relative;
    display: inline-flex;
    gap: 2px;
    max-width: 100%;
    padding: 3px;
    overflow-x: auto;
    border-radius: var(--radius-full);
    background: var(--bg-2);
    border: 1px solid var(--border);
    scrollbar-width: none;
  }

  .indicator {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 0;
    border-radius: var(--radius-full);
    background: var(--surface-3);
    box-shadow: var(--shadow-1);
    opacity: 0;
  }

  .indicator--ready {
    opacity: 1;
    transition:
      transform var(--dur-3) var(--ease-out),
      width var(--dur-3) var(--ease-out);
  }

  .tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 32px;
    padding: 0 var(--space-4);
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--text-dim);
    font-weight: 550;
    white-space: nowrap;
    cursor: pointer;
    transition: color var(--dur-2);
  }

  .tab:hover {
    color: var(--text);
  }

  .tab--active {
    color: var(--text);
  }

  .tab--active :global(svg) {
    color: var(--accent);
  }

  .tab:active {
    transform: scale(0.97);
  }

  .badge {
    min-width: 18px;
    padding: 0 5px;
    border-radius: var(--radius-full);
    background: var(--accent);
    color: var(--accent-contrast);
    font-size: var(--text-xs);
    font-weight: 700;
    line-height: 18px;
    text-align: center;
  }
</style>
