<script lang="ts">
  import { untrack } from 'svelte'
  import Dialog from '../ui/Dialog.svelte'
  import Switch from '../ui/Switch.svelte'
  import Icon from '../Icon.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { alarm, BUILTIN_SOUNDS } from '$lib/audio/beeps'
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
      <div class="hms">
        <label
          ><input class="input" type="number" min="0" max="23" bind:value={hours} /><span>h</span></label
        >
        <label
          ><input class="input" type="number" min="0" max="59" bind:value={minutes} /><span>min</span
          ></label
        >
        <label
          ><input class="input" type="number" min="0" max="59" bind:value={seconds} /><span>s</span></label
        >
      </div>
    </fieldset>

    <label class="field">
      <span>{t('timers.sound')}</span>
      <div class="row">
        <select class="input" bind:value={soundId}>
          {#each BUILTIN_SOUNDS as sound (sound.id)}
            <option value={sound.id}>{t(sound.label)}</option>
          {/each}
          {#each timers.sounds as sound (sound.id)}
            <option value={sound.id}>{sound.name}</option>
          {/each}
        </select>
        <button
          type="button"
          class="btn btn--icon"
          aria-label={t('timers.preview')}
          title={t('timers.preview')}
          onclick={() => alarm.preview(timers.recipe(soundId), theme.settings.timers.volume)}
        >
          <Icon name="volume-2" size={15} />
        </button>
      </div>
    </label>

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

  .hms {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  .hms label {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-faint);
  }

  .row {
    display: flex;
    gap: var(--space-2);
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

  .swatch--active {
    border-color: var(--text);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
