<script lang="ts">
  interface Props {
    /** Current width in px of the pane this handle resizes. */
    value: number
    min: number
    max: number
    label: string
    /** Every movement, for live layout. */
    oninput: (width: number) => void
    /** Once, when the drag or key press ends, to persist. */
    onchange: (width: number) => void
  }

  let { value, min, max, label, oninput, onchange }: Props = $props()

  let dragging = $state(false)
  let start = { x: 0, width: 0 }

  const clamp = (width: number) => Math.round(Math.min(max, Math.max(min, width)))
  const direction = () => (document.documentElement.dir === 'rtl' ? -1 : 1)

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    dragging = true
    start = { x: event.clientX, width: value }
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return
    oninput(clamp(start.width + (event.clientX - start.x) * direction()))
  }

  function onPointerUp() {
    if (!dragging) return
    dragging = false
    onchange(value)
  }

  function onKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 48 : 16
    let next: number | null = null
    if (event.key === 'ArrowLeft') next = value - step * direction()
    else if (event.key === 'ArrowRight') next = value + step * direction()
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    if (next === null) return
    event.preventDefault()
    const width = clamp(next)
    oninput(width)
    onchange(width)
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="resizer"
  class:resizer--active={dragging}
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={value}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onkeydown={onKeydown}
  ondblclick={() => {
    // Double-click restores the default width.
    const width = clamp((min + max) / 2)
    oninput(width)
    onchange(width)
  }}
></div>

<style>
  .resizer {
    position: absolute;
    top: 0;
    bottom: 0;
    inset-inline-end: -3px;
    width: 6px;
    cursor: col-resize;
    z-index: 5;
    touch-action: none;
  }

  .resizer::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    inset-inline-start: 2px;
    width: 2px;
    background: transparent;
    transition: background var(--dur-2);
  }

  .resizer:hover::after,
  .resizer:focus-visible::after,
  .resizer--active::after {
    background: var(--accent);
  }

  .resizer:focus-visible {
    outline: none;
  }
</style>
