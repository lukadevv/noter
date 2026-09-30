<script lang="ts">
  import Group from './Group.svelte'
  import Field from '../ui/Field.svelte'
  import Icon from '../Icon.svelte'
  import SoundEditor from '../timers/SoundEditor.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { alarm, BUILTIN_SOUNDS } from '$lib/audio/beeps'
  import type { TimerSettings, Sound } from '$lib/db/repo/settings'
  import { t } from '$lib/i18n/index.svelte'

  timers.start()

  let editing = $state<Sound | null | 'new'>(null)
  let settings = $derived(theme.settings.timers)

  function set(patch: Partial<TimerSettings>) {
    theme.update({ timers: { ...settings, ...patch } })
  }
</script>

{#if editing}
  <SoundEditor sound={editing === 'new' ? null : editing} onclose={() => (editing = null)} />
{/if}

<Group title={t('settings.timers.alarm')}>
  <Field label={t('settings.timers.defaultSound')} for="default-sound">
    <select
      id="default-sound"
      class="input"
      value={settings.defaultSoundId}
      onchange={(e) => set({ defaultSoundId: e.currentTarget.value })}
    >
      {#each BUILTIN_SOUNDS as sound (sound.id)}
        <option value={sound.id}>{t(sound.label)}</option>
      {/each}
      {#each timers.sounds as sound (sound.id)}
        <option value={sound.id}>{sound.name}</option>
      {/each}
    </select>
    <button
      class="btn btn--icon"
      aria-label={t('timers.preview')}
      onclick={() => alarm.preview(timers.recipe(settings.defaultSoundId), settings.volume)}
    >
      <Icon name="volume-2" size={15} />
    </button>
  </Field>

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
        onclick={() => void timers.deleteSound(sound.id)}
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
</style>
