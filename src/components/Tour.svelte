<script lang="ts">
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import { TOUR } from '$lib/tour/steps'
  import { ui } from '$lib/stores/ui.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { navigate } from '../routes/router'
  import { portal, trapFocus } from '$lib/ui/portal'
  import { fadeIn, pop } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  /**
   * The welcome tour. A spotlight - a hole cut in a dimmed overlay - moves
   * from one part of the app to the next, with a card explaining each. It
   * navigates for you, and falls back to a centred card when what it wants to
   * point at is not on screen.
   */
  let index = $state(0)
  let rect = $state<{ x: number; y: number; w: number; h: number } | null>(null)
  let card = $state<HTMLElement>()
  let place = $state({ x: 0, y: 0 })

  let step = $derived(TOUR[index]!)
  let last = $derived(index === TOUR.length - 1)

  const PAD = 8

  function findTarget(): HTMLElement | null {
    for (const selector of step.target ?? []) {
      const el = document.querySelector<HTMLElement>(selector)
      if (el && el.getClientRects().length > 0) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) return el
      }
    }
    return null
  }

  async function measure() {
    const el = findTarget()
    if (el) {
      const r = el.getBoundingClientRect()
      rect = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 }
    } else rect = null
    await tick()
    position()
  }

  /** Beside the spotlight where there is room, else below or above it; centred without one. */
  function position() {
    const w = card?.offsetWidth ?? 340
    const h = card?.offsetHeight ?? 200
    const margin = 16
    if (!rect) {
      place = { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2 }
      return
    }
    let x: number
    let y: number
    if (rect.x + rect.w + margin + w < innerWidth) {
      x = rect.x + rect.w + margin
      y = rect.y
    } else if (rect.y + rect.h + margin + h < innerHeight) {
      x = rect.x
      y = rect.y + rect.h + margin
    } else {
      x = rect.x
      y = rect.y - h - margin
    }
    place = {
      x: Math.min(Math.max(margin, x), innerWidth - w - margin),
      y: Math.min(Math.max(margin, y), innerHeight - h - margin),
    }
  }

  // Each step: go where it lives, give the section a moment to render, then aim.
  $effect(() => {
    const current = step
    if (current.route) navigate(current.route)
    let cancelled = false
    let tries = 0
    const aim = () => {
      if (cancelled) return
      // Sections load lazily; keep looking briefly before settling on centred.
      if (!findTarget() && current.target && tries++ < 12) {
        setTimeout(aim, 80)
        return
      }
      void measure()
    }
    setTimeout(aim, current.route ? 120 : 0)
    return () => {
      cancelled = true
    }
  })

  function finish() {
    ui.tourOpen = false
    if (!theme.settings.tourDone) theme.update({ tourDone: true })
    navigate({ kind: 'home' })
  }

  function go(delta: number) {
    const next = index + delta
    if (next < 0) return
    if (next >= TOUR.length) finish()
    else index = next
  }

  function onKeydown(event: KeyboardEvent) {
    const rtl = document.documentElement.dir === 'rtl'
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish()
    } else if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) go(1)
    else if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) go(-1)
  }
</script>

<svelte:window onresize={() => void measure()} />

<div use:portal>
  <div class="tour" transition:fadeIn data-testid="tour">
    {#if rect}
      <div
        class="spot"
        style="transform: translate({rect.x}px, {rect.y}px); width: {rect.w}px; height: {rect.h}px"
      ></div>
    {:else}
      <div class="dim"></div>
    {/if}
    <!-- Clicks outside the card do nothing: the tour ends with its own buttons or Esc. -->
    <div class="blocker"></div>

    <div
      class="card"
      role="dialog"
      aria-modal="true"
      aria-label={t(`tour.${step.id}.title`)}
      tabindex="-1"
      bind:this={card}
      style="transform: translate({place.x}px, {place.y}px)"
      use:trapFocus
      onkeydown={onKeydown}
      transition:pop
    >
      {#key index}
        <div class="content">
          <span class="icon" class:icon--big={!step.target}
            ><Icon name={step.icon} size={!step.target ? 26 : 18} /></span
          >
          <h2>{t(`tour.${step.id}.title`)}</h2>
          <p>{t(`tour.${step.id}.body`)}</p>
        </div>
      {/key}
      <div class="progress" aria-label={t('tour.progress', { n: index + 1, total: TOUR.length })}>
        {#each TOUR as s, i (s.id)}
          <span class="dot" class:dot--on={i === index} class:dot--past={i < index}></span>
        {/each}
      </div>
      <div class="actions">
        {#if !last}
          <button class="btn btn--ghost" data-testid="tour-skip" onclick={finish}>{t('tour.skip')}</button>
        {/if}
        <span class="spacer"></span>
        {#if index > 0}
          <button class="btn" onclick={() => go(-1)}>{t('tour.back')}</button>
        {/if}
        <button class="btn btn--primary" data-testid="tour-next" data-autofocus onclick={() => go(1)}>
          {index === 0 ? t('tour.start') : last ? t('tour.finish') : t('tour.next')}
          {#if !last}<Icon name="arrow-right" size={14} class="flip" />{/if}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .tour {
    position: fixed;
    inset: 0;
    z-index: var(--z-palette);
  }

  .spot,
  .dim {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
  }

  .dim {
    inset: 0;
    background: var(--overlay);
  }

  .spot {
    border-radius: var(--radius-lg);
    box-shadow:
      0 0 0 2px var(--accent),
      0 0 0 9999px var(--overlay);
    transition:
      transform 420ms var(--ease-out),
      width 420ms var(--ease-out),
      height 420ms var(--ease-out);
  }

  .blocker {
    position: fixed;
    inset: 0;
  }

  .card {
    position: fixed;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: min(340px, calc(100vw - 32px));
    padding: var(--space-4);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-3);
    transition: transform 420ms var(--ease-out);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    animation: enter-rise 320ms var(--ease-out);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 11px;
    background: var(--accent-soft);
    color: var(--accent);
  }

  .icon--big {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    animation: enter-pop 500ms var(--ease-out);
  }

  h2 {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  p {
    color: var(--text-dim);
  }

  .progress {
    display: flex;
    gap: 5px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--surface-3);
    transition:
      width var(--dur-3) var(--ease-out),
      background var(--dur-3);
  }

  .dot--past {
    background: color-mix(in oklab, var(--accent) 45%, var(--surface-3));
  }

  .dot--on {
    width: 18px;
    background: var(--accent);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .spacer {
    flex: 1;
  }
</style>
