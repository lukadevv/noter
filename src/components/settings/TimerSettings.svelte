<script lang="ts">
  import Group from './Group.svelte'
  import Field from '../ui/Field.svelte'
  import Icon from '../Icon.svelte'
  import SoundEditor from '../timers/SoundEditor.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import SoundPicker from '../timers/SoundPicker.svelte'
  import Switch from '../ui/Switch.svelte'
  import Stepper from '../ui/Stepper.svelte'
  import { alarm } from '$lib/audio/beeps'
  import { confirm } from '$lib/stores/confirm.svelte'
  import type { PomodoroSettings, TimerSettings, Sound } from '$lib/db/repo/settings'
  import { t } from '$lib/i18n/index.svelte'

  timers.start()

  let editing = $state<Sound | null | 'new'>(null)
  let settings = $derived(theme.settings.timers)

  let pomodoro = $derived(theme.settings.pomodoro)

  function set(patch: Partial<TimerSettings>) {
    theme.update({ timers: { ...settings, ...patch } })
  }

  function setPomodoro(patch: Partial<PomodoroSettings>) {
    theme.update({ pomodoro: { ...pomodoro, ...patch } })
  }

  async function removeSound(sound: Sound) {
    const ok = await confirm.ask({
      title: t('sounds.deleteTitle', { name: sound.name }),
      body: t('sounds.deleteBody'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) await timers.deleteSound(sound.id)
  }
</script>

{#if editing}
  <SoundEditor sound={editing === 'new' ? null : editing} onclose={() => (editing = null)} />
{/if}

<Group title={t('settings.timers.alarm')}>
  <div class="picker-field">
    <span class="picker-label">{t('settings.timers.defaultSound')}</span>
    <SoundPicker
      label={t('settings.timers.defaultSound')}
      value={settings.defaultSoundId}
      onchange={(id) => set({ defaultSoundId: id })}
    />
  </div>

  <Field
    label={t('settings.timers.volume', { percent: Math.round(settings.volume * 100) })}
    for="alarm-volume"
  >
    <input
      id="alarm-volume"
      type="range"
      min="0.05"
      max="1"
      step="0.05"
      value={settings.volume}
      onchange={(e) => {
        set({ volume: Number(e.currentTarget.value) })
        alarm.preview(timers.recipe(settings.defaultSoundId), Number(e.currentTarget.value))
      }}
    />
  </Field>

  <Field label={t('settings.timers.ringFor')} for="ring-seconds">
    <select
      id="ring-seconds"
      class="input"
      value={String(settings.ringSeconds)}
      onchange={(e) => set({ ringSeconds: Number(e.currentTarget.value) })}
    >
      {#each [15, 30, 60, 120, 300] as seconds (seconds)}
        <option value={String(seconds)}>{seconds < 60 ? `${seconds} s` : `${seconds / 60} min`}</option>
      {/each}
    </select>
  </Field>
</Group>

<Group title={t('pomodoro.title')} description={t('settings.timers.pomodoroHint')}>
  <div class="steppers">
    {#each [['focusMinutes', 'pomodoro.phase.focus', 1, 120], ['shortMinutes', 'pomodoro.phase.short', 1, 60], ['longMinutes', 'pomodoro.phase.long', 1, 90], ['longEvery', 'settings.timers.longEvery', 2, 12]] as const as [key, label, min, max] (key)}
      {@const current = pomodoro[key]}
      <div class="stepper-row">
        <span>{t(label)}</span>
        <Stepper
          label={t(label)}
          unit={key === 'longEvery' ? '×' : 'min'}
          {min}
          {max}
          value={current}
          testid="pomodoro-{key}"
          onchange={(v) => setPomodoro({ [key]: v })}
        />
      </div>
    {/each}
  </div>
  <Switch
    label={t('settings.timers.autoStart')}
    hint={t('settings.timers.autoStartHint')}
    checked={pomodoro.autoStart}
    onchange={(autoStart) => setPomodoro({ autoStart })}
  />
  <div class="picker-field">
    <span class="picker-label">{t('settings.timers.pomodoroSound')}</span>
    <SoundPicker
      label={t('settings.timers.pomodoroSound')}
      value={pomodoro.soundId}
      onchange={(id) => setPomodoro({ soundId: id })}
    />
  </div>
</Group>

<Group title={t('settings.timers.customSounds')} description={t('settings.timers.customSoundsHint')}>
  {#each timers.sounds as sound (sound.id)}
    <div class="sound">
      <Icon name="music" size={15} />
      <span class="truncate name">{sound.name}</span>
      <button
        class="btn btn--ghost btn--icon"
        aria-label={t('timers.preview')}
        onclick={() => alarm.preview(sound.recipe, settings.volume)}
      >
        <Icon name="play" size={14} />
      </button>
      <button
        class="btn btn--ghost btn--icon"
        aria-label={t('sounds.edit')}
        onclick={() => (editing = sound)}
      >
        <Icon name="pencil" size={14} />
      </button>
      <button
        class="btn btn--ghost btn--icon btn--danger"
        aria-label={t('common.delete')}
        onclick={() => void removeSound(sound)}
      >
        <Icon name="trash" size={14} />
      </button>
    </div>
  {/each}
  <div>
    <button class="btn" onclick={() => (editing = 'new')}
      ><Icon name="plus" size={14} />{t('sounds.new')}</button
    >
  </div>
</Group>

<style>
  .sound {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .name {
    flex: 1;
  }

  .picker-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .picker-label {
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  .steppers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-2) var(--space-4);
  }

  .stepper-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
</style>
