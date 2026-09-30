<script lang="ts">
  import Icon from './Icon.svelte'
  import Kbd from './ui/Kbd.svelte'
  import { menu, type MenuAnchor } from '$lib/stores/menu.svelte'
  import { nextIndex, placeMenu, typeahead, type NavKey } from '$lib/menu/nav'
  import { pop } from '$lib/ui/motion.svelte'
  import type { MenuItem } from '$lib/ui-types'

  interface Panel {
    items: MenuItem[]
    anchor: MenuAnchor
    active: number
    /** Set once measured, so the panel never flashes at the wrong spot. */
    position: { x: number; y: number } | null
  }

  let panels = $state<Panel[]>([])
  let elements = $state<HTMLElement[]>([])

  // A new menu replaces whatever was open.
  $effect(() => {
    const current = menu.current
    panels = current ? [{ items: current.items, anchor: current.anchor, active: -1, position: null }] : []
  })

  // Measure each panel after it renders and move it inside the viewport.
  $effect(() => {
    panels.forEach((panel, level) => {
      const element = elements[level]
      if (!element || panel.position) return
      const rect = element.getBoundingClientRect()
      panel.position = placeMenu(panel.anchor, rect, { width: innerWidth, height: innerHeight })
      element.focus({ preventScroll: true })
    })
  })

  function close(restore = true) {
    menu.close(restore)
  }

  function run(item: MenuItem, level: number, index: number, element?: HTMLElement) {
    if (item.disabled) return
    if (item.submenu) {
      openSubmenu(level, index, element)
      return
    }
    close()
    item.run?.()
  }

  function openSubmenu(level: number, index: number, element?: HTMLElement, focusFirst = false) {
    const item = panels[level]?.items[index]
    if (!item?.submenu) return
    const row = element ?? elements[level]?.querySelectorAll<HTMLElement>('[role="menuitem"]')[index]
    if (!row) return
    const rect = row.getBoundingClientRect()
    const rtl = document.documentElement.dir === 'rtl'
    panels = [
      ...panels.slice(0, level + 1),
      {
        items: item.submenu,
        // Opens beside the row; placeMenu flips it if there is no room.
        anchor: { x: rtl ? rect.left - 200 : rect.right - 4, y: rect.top - 4 },
        active: focusFirst ? nextIndex(item.submenu, -1, 'ArrowDown') : -1,
        position: null,
      },
    ]
  }

  function onKeydown(event: KeyboardEvent, level: number) {
    const panel = panels[level]
    if (!panel) return
    const rtl = document.documentElement.dir === 'rtl'
    const into = rtl ? 'ArrowLeft' : 'ArrowRight'
    const out = rtl ? 'ArrowRight' : 'ArrowLeft'

    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      panel.active = nextIndex(panel.items, panel.active, event.key as NavKey)
    } else if (event.key === into) {
      event.preventDefault()
      if (panel.active >= 0) openSubmenu(level, panel.active, undefined, true)
    } else if (event.key === out || (event.key === 'Escape' && level > 0)) {
      event.preventDefault()
      event.stopPropagation()
      if (level > 0) {
        panels = panels.slice(0, level)
        elements[level - 1]?.focus()
      } else if (event.key === 'Escape') {
        close()
      }
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const item = panel.items[panel.active]
      if (item?.submenu) openSubmenu(level, panel.active, undefined, true)
      else if (item) run(item, level, panel.active)
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      panel.active = typeahead(panel.items, panel.active, event.key)
    }
  }

  // Keep the highlighted row focused so screen readers follow it.
  $effect(() => {
    panels.forEach((panel, level) => {
      if (panel.active < 0) return
      const rows = elements[level]?.querySelectorAll<HTMLElement>('[role="menuitem"]')
      rows?.[panel.active]?.focus({ preventScroll: true })
    })
  })

  function onScroll(event: Event) {
    if (!menu.current) return
    if (elements.some((el) => el?.contains(event.target as Node))) return
    close(false)
  }
</script>

<svelte:window
  onresize={() => menu.current && close(false)}
  onscrollcapture={onScroll}
  onblur={() => menu.current && close(false)}
/>

{#if menu.current}
  <!-- The backdrop swallows the click that would otherwise reach the page. -->
  <div
    class="backdrop"
    role="presentation"
    onpointerdown={() => close(false)}
    oncontextmenu={(e) => {
      e.preventDefault()
      close(false)
    }}
  ></div>

  {#each panels as panel, level (level)}
    <div
      class="menu"
      bind:this={elements[level]}
      role="menu"
      aria-label={level === 0 ? menu.current.label : undefined}
      tabindex="-1"
      style="left: {panel.position?.x ?? panel.anchor.x}px; top: {panel.position?.y ??
        panel.anchor.y}px; visibility: {panel.position ? 'visible' : 'hidden'}"
      onkeydown={(e) => onKeydown(e, level)}
      transition:pop={{ duration: 110, start: 0.97 }}
    >
      {#each panel.items as item, i (item.id ?? i)}
        {#if item.separatorBefore}
          <hr class="separator" />
        {/if}
        <button
          class="item"
          data-testid="menu-item"
          class:item--danger={item.danger}
          class:item--active={panel.active === i}
          role="menuitem"
          aria-disabled={item.disabled || undefined}
          aria-haspopup={item.submenu ? 'menu' : undefined}
          aria-expanded={item.submenu ? panels.length > level + 1 && panel.active === i : undefined}
          tabindex="-1"
          onpointerenter={(e) => {
            panel.active = i
            if (item.submenu) openSubmenu(level, i, e.currentTarget)
            else if (panels.length > level + 1) panels = panels.slice(0, level + 1)
          }}
          onclick={(e) => run(item, level, i, e.currentTarget)}
        >
          <span class="icon">
            {#if item.checked}<Icon name="check" size={14} />{:else if item.icon}<Icon
                name={item.icon}
                size={14}
              />{/if}
          </span>
          <span class="label truncate">{item.label}</span>
          {#if item.shortcut}<Kbd keys={item.shortcut} />{/if}
          {#if item.submenu}<Icon name="chevron-right" size={13} class="flip" />{/if}
        </button>
      {/each}
    </div>
  {/each}
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-menu);
  }

  .menu {
    position: fixed;
    z-index: var(--z-menu);
    min-width: 200px;
    max-width: min(320px, calc(100vw - 16px));
    max-height: calc(100dvh - 16px);
    overflow-y: auto;
    padding: var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    box-shadow: var(--shadow-2);
    transform-origin: top left;
  }

  .menu:focus {
    outline: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: 30px;
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }

  .item:focus {
    outline: none;
  }

  .item--active {
    background: var(--surface-3);
  }

  .item[aria-disabled='true'] {
    opacity: 0.45;
    cursor: default;
  }

  .item--danger {
    color: var(--danger);
  }

  .item--danger.item--active {
    background: var(--danger-soft);
  }

  .icon {
    display: inline-flex;
    width: 14px;
    flex: none;
  }

  .label {
    flex: 1;
  }

  .separator {
    height: 1px;
    margin: var(--space-1) 0;
    border: none;
    background: var(--border);
  }

  @media (pointer: coarse) {
    .item {
      min-height: 40px;
    }
  }
</style>
