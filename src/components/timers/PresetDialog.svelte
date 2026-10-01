<script lang="ts">
  import { untrack } from 'svelte'
  import Dialog from '../ui/Dialog.svelte'
  import Switch from '../ui/Switch.svelte'
  import Stepper from '../ui/Stepper.svelte'
  import SoundPicker from './SoundPicker.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { formatLength } from '$lib/timers/duration'
  import { theme } from '$lib/stores/theme.svelte'
  import type { TimerPreset } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    preset: TimerPreset | null
    onclose: () => void
  }

  let { preset, onclose }: Props = $props()

  const COLORS = [null, '#e06a5a', '#d9a441', '#5cbf92', '#4fb3d9', '#8b8ce8', '#c27ad8']

  const initial = untrack(() => preset)
  let label = $state(initial?.label ?? '')
  let hours = $state(Math.floor((initial?.seconds ?? 600) / 3600))
  let minutes = $state(Math.floor(((initial?.seconds ?? 600) % 3600) / 60))
  let seconds = $state((initial?.seconds ?? 600) % 60)
  let soundId = $state(initial?.soundId ?? theme.settings.timers.defaultSoundId)
  let color = $state<string | null>(initial?.color ?? null)
  let repeat = $state(initial?.repeat === 1)

  const QUICK = [60, 300, 600, 900, 1500, 1800, 3600]

  function setTotal(value: number) {
    hours = Math.floor(value / 3600)
    minutes = Math.floor((value % 3600) / 60)
    seconds = value % 60
  }

  let total = $derived(Math.max(0, hours * 3600 + minutes * 60 + seconds))

  async function save() {
    if (total <= 0) return
    await timers.savePreset({
      id: initial?.id,
      label: label.trim() || t('timers.timer'),
      seconds: total,
      soundId,
      color,
      repeat: repeat ? 1 : 0,
    })
    onclose()
  }
</script>

<Dialog
  label={t(initial ? 'timers.editPreset' : 'timers.newPreset')}
  icon="timer"
  {onclose}
  testid="preset-dialog"
>
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault()
      void save()
    }}
  >
    <label class="field">
      <span>{t('timers.label')}</span>
      <input
        class="input"
        data-autofocus
        bind:value={label}
        placeholder={t('timers.labelPlaceholder')}
        maxlength="40"
      />
    </label>

    <fieldset class="field">
      <legend>{t('timers.duration')}</legend>
      <div class="total" aria-live="polite">{total > 0 ? formatLength(total) : '-'}</div>
      <div class="hms">
        <Stepper label={t('timers.hours')} unit="h" max={23} bind:value={hours} />
        <Stepper label={t('timers.minutes')} unit="min" max={59} bind:value={minutes} />
        <Stepper label={t('timers.seconds')} unit="s" max={59} step={5} bind:value={seconds} />
      </div>
      <div class="chips">
        {#each QUICK as value (value)}
          <button
            type="button"
            class="chip"
            class:chip--active={total === value}
            onclick={() => setTotal(value)}>{formatLength(value)}</button
          >
        {/each}
      </div>
    </fieldset>

    <fieldset class="field">
      <legend>{t('timers.sound')}</legend>
      <SoundPicker label={t('timers.sound')} bind:value={soundId} />
    </fieldset>

    <fieldset class="field">
      <legend>{t('timers.color')}</legend>
      <div class="swatches">
        {#each COLORS as swatch (swatch ?? 'none')}
          <button
            type="button"
            class="swatch"
            class:swatch--active={color === swatch}
            class:swatch--none={swatch === null}
            style={swatch ? `--c: ${swatch}` : ''}
            aria-label={swatch ?? t('common.none')}
            aria-pressed={color === swatch}
            onclick={() => (color = swatch)}
          ></button>
        {/each}
      </div>
    </fieldset>

    <Switch label={t('timers.repeat')} hint={t('timers.repeatHint')} bind:checked={repeat} />

    <div class="actions">
      <button type="button" class="btn" onclick={onclose}>{t('common.cancel')}</button>
      <button type="submit" class="btn btn--primary" disabled={total <= 0}>{t('common.save')}</button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }

  .field > span,
  legend {
    color: var(--text-dim);
    font-size: var(--text-md);
    padding: 0;
    margin-bottom: var(--space-2);
  }

  .total {
    font-size: var(--text-2xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .hms {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .chip {
    height: 28px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    background: none;
    color: var(--text-dim);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition:
      background var(--dur-1),
      transform var(--dur-1);
  }

  .chip:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }

  .chip:active {
    transform: scale(0.94);
  }

  .chip--active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--text);
  }

  .swatches {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .swatch {
    width: 28px;
    height: 28px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--c);
    cursor: pointer;
    outline-offset: 2px;
  }

  .swatch--none {
    background: repeating-linear-gradient(45deg, var(--surface-3) 0 4px, var(--surface-2) 4px 8px);
  }

  .swatch {
    transition: transform var(--dur-2) var(--ease-spring);
  }

  .swatch:hover {
    transform: scale(1.1);
  }

  .swatch--active {
    border-color: var(--text);
    transform: scale(1.15);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
