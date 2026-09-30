<script lang="ts">
  import { flip } from 'svelte/animate'
  import Icon from '../Icon.svelte'
  import EmptyState from '../ui/EmptyState.svelte'
  import TimerCard from '../timers/TimerCard.svelte'
  import PresetDialog from '../timers/PresetDialog.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { formatLength, parseDuration } from '$lib/timers/duration'
  import { menu } from '$lib/stores/menu.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { contextmenu } from '$lib/ui/contextmenu'
  import { flipDuration, rise } from '$lib/ui/motion.svelte'
  import type { TimerPreset } from '$lib/db/schema'
  import type { MenuItem } from '$lib/ui-types'
  import { t } from '$lib/i18n/index.svelte'

  timers.start()

  let quick = $state('')
  let quickError = $state(false)
  let editing = $state<TimerPreset | null | 'new'>(null)
  let now = $state(Date.now())

  // A clock for the countdowns, only while something is counting.
  $effect(() => {
    if (timers.running.length === 0) return
    const id = setInterval(() => (now = Date.now()), 250)
    return () => clearInterval(id)
  })

  function startQuick(event: SubmitEvent) {
    event.preventDefault()
    const seconds = parseDuration(quick)
    quickError = seconds === null
    if (seconds === null) return
    void timers.startTimer({ seconds })
    quick = ''
  }

  function presetMenu(preset: TimerPreset): MenuItem[] {
    return [
      { id: 'start', label: t('timers.start'), icon: 'play', run: () => void timers.startPreset(preset) },
      { id: 'edit', label: t('timers.editPreset'), icon: 'pencil', run: () => (editing = preset) },
      {
        id: 'duplicate',
        label: t('blocks.duplicate'),
        icon: 'copy',
        run: () => void timers.duplicatePreset(preset.id),
      },
      {
        id: 'up',
        label: t('blocks.moveUp'),
        icon: 'arrow-up',
        shortcut: 'Alt+←',
        separatorBefore: true,
        run: () => void timers.nudgePreset(preset.id, -1),
      },
      {
        id: 'down',
        label: t('blocks.moveDown'),
        icon: 'arrow-down',
        shortcut: 'Alt+→',
        run: () => void timers.nudgePreset(preset.id, 1),
      },
      {
        id: 'delete',
        label: t('common.delete'),
        icon: 'trash',
        danger: true,
        separatorBefore: true,
        run: () => {
          void timers.deletePreset(preset.id)
          ui.toast(t('timers.presetDeleted'), 'info')
        },
      },
    ]
  }

  // --- Drag to reorder --------------------------------------------------------
  // Pointer events rather than HTML drag and drop: they work with a finger too,
  // and nothing here needs to leave the grid.
  let drag = $state<{ id: string; x: number; y: number; target: string | null; after: boolean } | null>(
    null,
  )

  function onGripDown(event: PointerEvent, preset: TimerPreset) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    drag = { id: preset.id, x: event.clientX, y: event.clientY, target: null, after: false }
  }

  function onGripMove(event: PointerEvent) {
    if (!drag) return
    const under = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((el) => el instanceof HTMLElement && el.dataset.presetId)
    if (!(under instanceof HTMLElement)) {
      drag = { ...drag, x: event.clientX, y: event.clientY, target: null }
      return
    }
    const rect = under.getBoundingClientRect()
    const rtl = document.documentElement.dir === 'rtl'
    const after = rtl
      ? event.clientX < rect.left + rect.width / 2
      : event.clientX > rect.left + rect.width / 2
    drag = { ...drag, x: event.clientX, y: event.clientY, target: under.dataset.presetId!, after }
  }

  function onGripUp() {
    const current = drag
    drag = null
    if (!current?.target || current.target === current.id) return
    const others = timers.presets.filter((p) => p.id !== current.id)
    const index = others.findIndex((p) => p.id === current.target) + (current.after ? 1 : 0)
    void timers.movePreset(current.id, others[index - 1]?.id ?? null, others[index]?.id ?? null)
  }

  function onTileKey(event: KeyboardEvent, preset: TimerPreset) {
    if (!event.altKey) return
    const rtl = document.documentElement.dir === 'rtl'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    if (event.key === back || event.key === 'ArrowUp') {
      event.preventDefault()
      void timers.nudgePreset(preset.id, -1)
    } else if (event.key === forward || event.key === 'ArrowDown') {
      event.preventDefault()
      void timers.nudgePreset(preset.id, 1)
    }
  }
</script>

<div class="page" data-testid="timers">
  <header class="top" in:rise>
    <div>
      <h1>{t('nav.timers')}</h1>
      <p class="faint">{t('timers.about')}</p>
    </div>
    <form class="quick" onsubmit={startQuick}>
      <input
        class="input"
        class:input--error={quickError}
        placeholder={t('timers.quickPlaceholder')}
        aria-label={t('timers.quickLabel')}
        data-testid="quick-timer"
        bind:value={quick}
        oninput={() => (quickError = false)}
      />
      <button class="btn btn--primary" type="submit"
        ><Icon name="play" size={14} />{t('timers.start')}</button
      >
    </form>
  </header>

  {#if timers.running.length > 0}
    <section class="block">
      <h2>{t('timers.running')}</h2>
      <div class="running">
        {#each timers.running as timer (timer.id)}
          <div animate:flip={{ duration: flipDuration() }} in:rise>
            <TimerCard {timer} {now} color={timers.presets.find((p) => p.id === timer.presetId)?.color} />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section class="block">
    <h2>{t('timers.presets')}</h2>
    {#if timers.loaded && timers.presets.length === 0}
      <EmptyState icon="timer" title={t('timers.noPresets')} body={t('timers.noPresetsBody')}>
        <button class="btn btn--primary" onclick={() => (editing = 'new')}>
          <Icon name="plus" size={14} />{t('timers.newPreset')}
        </button>
      </EmptyState>
    {:else}
      <div class="grid" role="list">
        {#each timers.presets as preset (preset.id)}
          <div
            class="tile"
            class:tile--dragging={drag?.id === preset.id}
            class:tile--before={drag?.target === preset.id && !drag.after && drag.id !== preset.id}
            class:tile--after={drag?.target === preset.id && drag.after && drag.id !== preset.id}
            data-preset-id={preset.id}
            style={preset.color ? `--tile: ${preset.color}` : ''}
            role="listitem"
            animate:flip={{ duration: flipDuration() }}
            use:contextmenu={() => presetMenu(preset)}
          >
            <button
              class="start"
              data-testid="timer-preset"
              onclick={() => void timers.startPreset(preset)}
              onkeydown={(e) => onTileKey(e, preset)}
              aria-label={t('timers.startNamed', {
                label: preset.label,
                length: formatLength(preset.seconds),
              })}
            >
              <span class="length">{formatLength(preset.seconds)}</span>
              <span class="name truncate">{preset.label}</span>
              {#if preset.repeat}<span class="repeat" title={t('timers.repeat')}
                  ><Icon name="refresh-cw" size={12} /></span
                >{/if}
            </button>
            <span
              class="grip"
              role="button"
              tabindex="-1"
              aria-label={t('timers.dragToReorder')}
              onpointerdown={(e) => onGripDown(e, preset)}
              onpointermove={onGripMove}
              onpointerup={onGripUp}
              onpointercancel={() => (drag = null)}
            >
              <Icon name="grip-vertical" size={14} />
            </span>
            <button
              class="more"
              aria-label={t('timers.presetActions')}
              onclick={(e) => menu.open(presetMenu(preset), e.currentTarget, preset.label)}
            >
              <Icon name="more" size={14} />
            </button>
          </div>
        {/each}
        <button class="tile tile--new" data-testid="new-preset" onclick={() => (editing = 'new')}>
          <Icon name="plus" size={18} />
          <span>{t('timers.newPreset')}</span>
        </button>
      </div>
    {/if}
  </section>
</div>

{#if editing}
  <PresetDialog preset={editing === 'new' ? null : editing} onclose={() => (editing = null)} />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 60rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
  }

  .top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  h1 {
    font-size: var(--text-3xl);
    font-weight: 700;
  }

  h2 {
    margin-bottom: var(--space-3);
    font-size: var(--text-sm);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .quick {
    display: flex;
    gap: var(--space-2);
    min-width: min(100%, 22rem);
  }

  .input--error {
    border-color: var(--danger);
  }

  .running {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-3);
  }

  .tile {
    --tile: var(--accent);
    position: relative;
    min-height: 104px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    overflow: hidden;
    transition:
      transform var(--dur-2) var(--ease-out),
      border-color var(--dur-2);
  }

  .tile::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 4px;
    background: var(--tile);
  }

  .tile:hover {
    transform: translateY(-2px);
    border-color: var(--tile);
  }

  .tile--dragging {
    opacity: 0.5;
  }

  .tile--before {
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .tile--after {
    box-shadow: inset -3px 0 0 var(--accent);
  }

  .start {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    gap: 2px;
    width: 100%;
    height: 100%;
    min-height: 104px;
    padding: var(--space-3);
    border: 0;
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }

  .start:active {
    transform: scale(0.98);
  }

  .length {
    font-size: var(--text-xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .name {
    max-width: 100%;
    color: var(--text-dim);
  }

  .repeat {
    position: absolute;
    top: 12px;
    inset-inline-start: 12px;
    color: var(--text-faint);
  }

  .grip,
  .more {
    position: absolute;
    top: 8px;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    opacity: 0;
    transition: opacity var(--dur-1);
  }

  .grip {
    inset-inline-end: 34px;
    cursor: grab;
    touch-action: none;
  }

  .more {
    inset-inline-end: 6px;
    cursor: pointer;
  }

  .tile:hover .grip,
  .tile:hover .more,
  .tile:focus-within .more {
    opacity: 1;
  }

  .grip:hover,
  .more:hover {
    background: var(--surface-3);
    color: var(--text);
  }

  @media (pointer: coarse) {
    .grip,
    .more {
      opacity: 1;
    }
  }

  .tile--new {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    border-style: dashed;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  .tile--new::before {
    display: none;
  }

  .tile--new:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  @media (max-width: 860px) {
    .page {
      padding: var(--space-5) var(--space-4);
    }

    h1 {
      font-size: var(--text-2xl);
    }
  }
</style>
