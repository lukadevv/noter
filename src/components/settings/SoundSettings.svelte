<script lang="ts">
  import Group from './Group.svelte'
  import Field from '../ui/Field.svelte'
  import Icon from '../Icon.svelte'
  import Switch from '../ui/Switch.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { UI_SOUND_IDS, uiSound, type UiSoundId, type UiSoundSettings } from '$lib/audio/ui-sounds'
  import { t } from '$lib/i18n/index.svelte'

  let sounds = $derived(theme.settings.sounds)

  function set(patch: Partial<UiSoundSettings>) {
    theme.update({ sounds: { ...sounds, ...patch } })
  }

  function toggle(id: UiSoundId, on: boolean) {
    const muted = on ? sounds.muted.filter((m) => m !== id) : [...sounds.muted, id]
    set({ muted })
  }
</script>

<Group title={t('settings.sounds.title')} description={t('settings.sounds.about')}>
  <Switch
    label={t('settings.sounds.enable')}
    hint={t('settings.sounds.enableHint')}
    checked={sounds.enabled}
    testid="ui-sounds-enabled"
    onchange={(enabled) => set({ enabled })}
  />

  <Field label={t('settings.sounds.volume', { percent: Math.round(sounds.volume * 100) })} for="ui-volume">
    <input
      id="ui-volume"
      type="range"
      min="0.05"
      max="1"
      step="0.05"
      value={sounds.volume}
      disabled={!sounds.enabled}
      oninput={(e) => theme.live({ sounds: { ...sounds, volume: Number(e.currentTarget.value) } })}
      onchange={(e) => {
        set({ volume: Number(e.currentTarget.value) })
        uiSound.preview('primary')
      }}
    />
  </Field>
</Group>

<Group title={t('settings.sounds.choose')} description={t('settings.sounds.chooseHint')}>
  {#each UI_SOUND_IDS as id (id)}
    <div class="row" data-testid="ui-sound-{id}">
      <Switch
        label={t(`settings.sounds.names.${id}`)}
        checked={!sounds.muted.includes(id)}
        disabled={!sounds.enabled}
        onchange={(on) => toggle(id, on)}
      />
      <button
        class="btn btn--ghost btn--icon"
        data-ui-sound="none"
        aria-label={t('settings.sounds.preview', { name: t(`settings.sounds.names.${id}`) })}
        onclick={() => uiSound.preview(id)}
      >
        <Icon name="volume-2" size={15} />
      </button>
    </div>
  {/each}
</Group>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .row :global(.switch) {
    flex: 1;
  }
</style>
