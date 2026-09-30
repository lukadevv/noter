<script lang="ts">
  import { untrack } from 'svelte'
  import Dialog from '../ui/Dialog.svelte'
  import Segmented from '../ui/Segmented.svelte'
  import Icon from '../Icon.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { alarm, hzToNote, parseMelody } from '$lib/audio/beeps'
  import { theme } from '$lib/stores/theme.svelte'
  import type { Sound, SoundRecipe } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    sound: Sound | null
    onclose: () => void
  }

  let { sound, onclose }: Props = $props()

  /** Envelope presets: how each note starts and fades. */
  const STYLES = {
    beep: { attackMs: 3, releaseMs: 25 },
    bell: { attackMs: 4, releaseMs: 600 },
    soft: { attackMs: 40, releaseMs: 200 },
  } as const
  type Style = keyof typeof STYLES

  const start = untrack(() => sound)
  const base: SoundRecipe = start?.recipe ?? {
    wave: 'sine',
    notes: [880, 1174.66, 880],
    noteMs: 160,
    gapMs: 500,
    volume: 0.7,
    attackMs: 4,
    releaseMs: 600,
  }

  let name = $state(start?.name ?? t('sounds.custom'))
  let wave = $state<SoundRecipe['wave']>(base.wave)
  let melody = $state(base.notes.map(hzToNote).join(' '))
  let noteMs = $state(base.noteMs)
  let gapMs = $state(base.gapMs)
  let volume = $state(base.volume)
  let style = $state<Style>(base.releaseMs > 400 ? 'bell' : base.attackMs > 20 ? 'soft' : 'beep')

  let notes = $derived(parseMelody(melody))
  let recipe = $derived<SoundRecipe | null>(
    notes ? { wave, notes, noteMs, gapMs, volume, ...STYLES[style] } : null,
  )

  async function save() {
    if (!recipe) return
    await timers.saveSound({ id: start?.id, name: name.trim() || t('sounds.custom'), recipe })
    onclose()
  }
</script>

<Dialog label={t(start ? 'sounds.edit' : 'sounds.new')} icon="music" {onclose} testid="sound-editor">
  <div class="form">
    <label class="field">
      <span>{t('sounds.name')}</span>
      <input class="input" bind:value={name} maxlength="30" />
    </label>

    <label class="field">
      <span>{t('sounds.melody')}</span>
      <input class="input mono" class:input--error={!notes} bind:value={melody} spellcheck="false" />
      <span class="hint">{t('sounds.melodyHint')}</span>
    </label>

    <div class="field">
      <span>{t('sounds.wave')}</span>
      <Segmented
        label={t('sounds.wave')}
        bind:value={wave}
        options={[
          { value: 'sine', label: t('sounds.waves.sine') },
          { value: 'triangle', label: t('sounds.waves.triangle') },
          { value: 'square', label: t('sounds.waves.square') },
          { value: 'sawtooth', label: t('sounds.waves.sawtooth') },
        ]}
      />
    </div>

    <div class="field">
      <span>{t('sounds.style')}</span>
      <Segmented
        label={t('sounds.style')}
        bind:value={style}
        options={[
          { value: 'beep', label: t('sounds.styles.beep') },
          { value: 'bell', label: t('sounds.styles.bell') },
          { value: 'soft', label: t('sounds.styles.soft') },
        ]}
      />
    </div>

    <label class="field">
      <span>{t('sounds.speed', { ms: noteMs })}</span>
      <input type="range" min="60" max="700" step="10" bind:value={noteMs} />
    </label>
    <label class="field">
      <span>{t('sounds.pause', { ms: gapMs })}</span>
      <input type="range" min="0" max="2000" step="50" bind:value={gapMs} />
    </label>
    <label class="field">
      <span>{t('sounds.volume')}</span>
      <input type="range" min="0.05" max="1" step="0.05" bind:value={volume} />
    </label>

    <div class="actions">
      <button
        class="btn"
        disabled={!recipe}
        onclick={() => recipe && alarm.preview(recipe, theme.settings.timers.volume)}
      >
        <Icon name="play" size={14} />{t('timers.preview')}
      </button>
      <span class="spacer"></span>
      <button class="btn" onclick={onclose}>{t('common.cancel')}</button>
      <button class="btn btn--primary" disabled={!recipe} onclick={save}>{t('common.save')}</button>
    </div>
  </div>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field > span {
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  .hint {
    color: var(--text-faint) !important;
    font-size: var(--text-sm) !important;
  }

  .mono {
    font-family: var(--font-mono);
  }

  .input--error {
    border-color: var(--danger);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .spacer {
    flex: 1;
  }
</style>
