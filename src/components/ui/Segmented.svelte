<script lang="ts" generics="T extends string | number">
  import Icon from '../Icon.svelte'

  interface Option {
    value: T
    label: string
    icon?: string
  }

  interface Props {
    options: Option[]
    value: T
    label: string
    /** Hide labels and show only icons (labels stay as tooltips). */
    iconsOnly?: boolean
    testid?: string
    onchange?: (value: T) => void
  }

  let { options, value = $bindable(), label, iconsOnly = false, testid, onchange }: Props = $props()

  let root = $state<HTMLElement>()
  let pill = $state({ x: 0, y: 0, w: 0, h: 0, ready: false })

  // The highlight slides between segments instead of jumping.
  $effect(() => {
    void value
    void options.length
    const el = root?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!el) return
    const measure = () => {
      pill = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, ready: true }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  })

  function choose(next: T) {
    value = next
    onchange?.(next)
  }

  function onKeydown(event: KeyboardEvent) {
    const index = options.findIndex((o) => o.value === value)
    const rtl = document.documentElement.dir === 'rtl'
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'
    if (event.key !== forward && event.key !== back) return
    const next =
      event.key === forward ? (index + 1) % options.length : (index - 1 + options.length) % options.length
    event.preventDefault()
    choose(options[next]!.value)
    const buttons = (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button')
    buttons[next]?.focus()
  }
</script>

<div
  class="segmented"
  role="radiogroup"
  aria-label={label}
  data-testid={testid}
  tabindex="-1"
  bind:this={root}
  onkeydown={onKeydown}
>
  <span
    class="pill"
    class:pill--ready={pill.ready}
    style="transform: translate({pill.x}px, {pill.y}px); width: {pill.w}px; height: {pill.h}px"
    aria-hidden="true"
  ></span>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      class="segment"
      class:segment--active={option.value === value}
      aria-checked={option.value === value}
      tabindex={option.value === value ? 0 : -1}
      title={iconsOnly ? option.label : undefined}
      aria-label={iconsOnly ? option.label : undefined}
      onclick={() => choose(option.value)}
    >
      {#if option.icon}<Icon name={option.icon} size={14} />{/if}
      {#if !iconsOnly}<span>{option.label}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    position: relative;
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 2px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .pill {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: calc(var(--radius) - 2px);
    background: var(--surface-3);
    box-shadow: var(--shadow-1);
    opacity: 0;
  }

  .pill--ready {
    opacity: 1;
    transition:
      transform var(--dur-3) var(--ease-out),
      width var(--dur-3) var(--ease-out);
  }

  .segment:active {
    transform: scale(0.96);
  }

  .segment {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: calc(26px * var(--density));
    padding: 0 var(--space-3);
    border: 0;
    border-radius: calc(var(--radius) - 2px);
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
    transition:
      color var(--dur-2),
      transform var(--dur-1);
  }

  .segment:hover {
    color: var(--text);
  }

  .segment--active {
    color: var(--text);
  }
</style>
