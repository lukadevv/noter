<script lang="ts">
  import { flip } from 'svelte/animate'
  import Icon from '../Icon.svelte'
  import EmptyState from '../ui/EmptyState.svelte'
  import TimerCard from './TimerCard.svelte'
  import PresetDialog from './PresetDialog.svelte'
  import { confirm } from '$lib/stores/confirm.svelte'
  import { press } from '$lib/ui/press'
  import { timers } from '$lib/timers/store.svelte'
  import { formatLength, parseDuration } from '$lib/timers/duration'
  import { menu } from '$lib/stores/menu.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { contextmenu } from '$lib/ui/contextmenu'
  import { flipDuration } from '$lib/ui/motion.svelte'
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
    if (timers.alarms.length === 0) return
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
        run: () => void removePreset(preset),
      },
    ]
  }

  async function removePreset(preset: TimerPreset) {
    const ok = await confirm.ask({
      title: t('timers.deletePresetTitle', { label: preset.label }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (!ok) return
    await timers.deletePreset(preset.id)
    ui.toast(t('timers.presetDeleted'), 'info')
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

<div class="alarms">
  <form class="quick surface enter" onsubmit={startQuick}>
    <Icon name="timer" size={18} />
    <input
      class="quick-input"
      class:quick-input--error={quickError}
      placeholder={t('timers.quickPlaceholder')}
      aria-label={t('timers.quickLabel')}
      data-testid="quick-timer"
      bind:value={quick}
      oninput={() => (quickError = false)}
    />
    <button class="btn btn--primary btn--pill" type="submit"
      ><Icon name="play" size={14} />{t('timers.start')}</button
    >
  </form>

  {#if timers.alarms.length > 0}
    <section class="block">
      <h2 class="title-sm">{t('timers.running')}</h2>
      <div class="running">
        {#each timers.alarms as timer, i (timer.id)}
          <div animate:flip={{ duration: flipDuration() }}>
            <TimerCard
              {timer}
              {now}
              index={i}
              color={timers.presets.find((p) => p.id === timer.presetId)?.color}
            />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section class="block">
    <h2 class="title-sm">{t('timers.presets')}</h2>
    {#if timers.loaded && timers.presets.length === 0}
      <EmptyState icon="timer" title={t('timers.noPresets')} body={t('timers.noPresetsBody')}>
        <button class="btn btn--primary" onclick={() => (editing = 'new')}>
          <Icon name="plus" size={14} />{t('timers.newPreset')}
        </button>
      </EmptyState>
    {:else}
      <div class="grid" role="list">
        {#each timers.presets as preset, i (preset.id)}
          <div
            class="tile surface enter"
            class:tile--dragging={drag?.id === preset.id}
            class:tile--before={drag?.target === preset.id && !drag.after && drag.id !== preset.id}
            class:tile--after={drag?.target === preset.id && drag.after && drag.id !== preset.id}
            data-preset-id={preset.id}
            style="--i: {i}; {preset.color ? `--tile: ${preset.color}` : ''}"
            role="listitem"
            animate:flip={{ duration: flipDuration() }}
            use:contextmenu={() => presetMenu(preset)}
          >
            <button
              class="start"
              data-testid="timer-preset"
              use:press
              onclick={() => void timers.startPreset(preset)}
              onkeydown={(e) => onTileKey(e, preset)}
              aria-label={t('timers.startNamed', {
                label: preset.label,
                length: formatLength(preset.seconds),
              })}
            >
              <span class="play-dot"><Icon name="play" size={12} /></span>
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
  .alarms {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .quick {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    color: var(--text-faint);
  }

  .quick:focus-within {
    border-color: var(--accent);
  }

  .quick-input {
    flex: 1;
    min-width: 0;
    height: 36px;
    border: 0;
    background: none;
    color: var(--text);
    font-size: var(--text-lg);
  }

  .quick-input:focus {
    outline: none;
  }

  .quick-input::placeholder {
    color: var(--text-faint);
  }

  .quick-input--error {
    color: var(--danger);
  }

  .running {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: var(--space-3);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-3);
  }

  .tile {
    --tile: var(--accent);
    position: relative;
    min-height: 112px;
    overflow: hidden;
    transition:
      transform var(--dur-2) var(--ease-out),
      border-color var(--dur-2),
      box-shadow var(--dur-2);
  }

  .tile:not(.tile--new)::before {
    content: '';
    position: absolute;
    inset: auto -30px -30px auto;
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in oklab, var(--tile) 22%, transparent), transparent 70%);
    pointer-events: none;
    transition: transform var(--dur-3) var(--ease-out);
  }

  .tile:hover::before {
    transform: scale(1.6);
  }

  .tile:hover {
    transform: translateY(-2px);
    border-color: color-mix(in oklab, var(--tile) 60%, var(--border));
    box-shadow: var(--shadow-2);
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
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    gap: 2px;
    width: 100%;
    height: 100%;
    min-height: 112px;
    padding: var(--space-3) var(--space-4);
    overflow: hidden;
    border: 0;
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
    transition: transform var(--dur-1) var(--ease-out);
  }

  .start:active {
    transform: scale(0.97);
  }

  .play-dot {
    position: absolute;
    top: var(--space-3);
    inset-inline-start: var(--space-4);
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: color-mix(in oklab, var(--tile) 20%, transparent);
    color: var(--tile);
    transition:
      transform var(--dur-2) var(--ease-spring),
      background var(--dur-2);
  }

  .tile:hover .play-dot {
    transform: scale(1.12);
    background: var(--tile);
    color: var(--accent-contrast);
  }

  .length {
    font-size: var(--text-2xl);
    font-weight: 720;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .name {
    max-width: 100%;
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  .repeat {
    position: absolute;
    bottom: var(--space-3);
    inset-inline-end: var(--space-3);
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
    min-height: 112px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  .tile--new:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .tile--new:active {
    transform: scale(0.97);
  }
</style>
