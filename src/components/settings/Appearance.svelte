<script lang="ts">
  import Icon from '../Icon.svelte'
  import Lazy from '../Lazy.svelte'
  import Group from './Group.svelte'
  import Field from '../ui/Field.svelte'
  import Segmented from '../ui/Segmented.svelte'
  import Switch from '../ui/Switch.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import type { Density, FontChoice } from '$lib/db/repo/settings'
  import type { MotionSetting } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  let editingTheme = $state<string | null>(null)

  const DENSITIES: Density[] = ['compact', 'cozy', 'comfortable']
  const FONTS: FontChoice[] = ['system', 'sans', 'serif', 'mono']
  const MOTIONS: MotionSetting[] = ['system', 'full', 'reduced', 'off']
</script>

{#if editingTheme}
  <Lazy
    load={() => import('../ThemeEditor.svelte')}
    props={{ baseId: editingTheme, onclose: () => (editingTheme = null) }}
  />
{/if}

<Group title={t('settings.theme')}>
  <div class="themes" role="radiogroup" aria-label={t('settings.theme')}>
    {#each theme.available as option (option.id)}
      {@const tokens = theme.tokensFor(option.id)}
      <button
        class="swatch"
        class:swatch--active={theme.settings.themeId === option.id}
        role="radio"
        aria-checked={theme.settings.themeId === option.id}
        onclick={() => theme.applyThemeId(option.id)}
        style="--sw-bg: {tokens?.bg}; --sw-surface: {tokens?.[
          'surface-2'
        ]}; --sw-text: {tokens?.text}; --sw-accent: {tokens?.accent}"
      >
        <span class="preview" aria-hidden="true">
          <span class="bar"></span>
          <span class="bar bar--short"></span>
          <span class="dot"></span>
        </span>
        <span class="name truncate">{option.name}{option.builtin ? '' : ` ${t('settings.custom')}`}</span>
      </button>
    {/each}
  </div>

  <Field label={t('settings.theme')} hint={t('settings.customThemeHint')} for="theme-select">
    <select
      id="theme-select"
      class="input"
      value={theme.settings.themeId}
      onchange={(e) => theme.applyThemeId(e.currentTarget.value)}
    >
      {#each theme.available as option (option.id)}
        <option value={option.id}>{option.name}{option.builtin ? '' : ` ${t('settings.custom')}`}</option>
      {/each}
    </select>
    <button class="btn" onclick={() => (editingTheme = theme.settings.themeId)}>
      <Icon name="pencil" size={14} />
      {t('settings.customise')}
    </button>
  </Field>
</Group>

<Group title={t('settings.layout')}>
  <Field label={t('settings.density')}>
    <Segmented
      label={t('settings.density')}
      value={theme.settings.density}
      options={DENSITIES.map((d) => ({ value: d, label: t(`settings.densities.${d}`) }))}
      onchange={(density) => theme.update({ density })}
    />
  </Field>

  <Field label={t('settings.font')}>
    <Segmented
      label={t('settings.font')}
      value={theme.settings.font}
      options={FONTS.map((f) => ({ value: f, label: t(`settings.fonts.${f}`) }))}
      onchange={(font) => theme.update({ font })}
    />
  </Field>

  <Field label={t('settings.cornerRoundness')} for="radius">
    <input
      id="radius"
      type="range"
      min="0"
      max="2"
      step="0.25"
      value={theme.settings.radiusScale}
      oninput={(e) => theme.live({ radiusScale: Number(e.currentTarget.value) })}
      onchange={(e) => theme.update({ radiusScale: Number(e.currentTarget.value) })}
    />
  </Field>

  <Switch
    label={t('settings.notesInTree')}
    checked={theme.settings.showNotesInTree}
    testid="notes-in-tree"
    onchange={(showNotesInTree) => theme.update({ showNotesInTree })}
  />
</Group>

<Group title={t('settings.motion')} description={t('settings.motionHint')}>
  <Field label={t('settings.motion')}>
    <Segmented
      label={t('settings.motion')}
      testid="motion-setting"
      value={theme.settings.motion}
      options={MOTIONS.map((m) => ({ value: m, label: t(`settings.motions.${m}`) }))}
      onchange={(motion) => theme.update({ motion })}
    />
  </Field>
</Group>

<style>
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: var(--space-2);
  }

  .swatch {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: none;
    color: var(--text-dim);
    cursor: pointer;
    text-align: start;
    transition:
      border-color var(--dur-2),
      transform var(--dur-2) var(--ease-out);
  }

  .swatch:hover {
    transform: translateY(-1px);
    border-color: var(--border-strong);
  }

  .swatch--active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
    color: var(--text);
  }

  .preview {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 5px;
    height: 58px;
    padding: 10px;
    border-radius: calc(var(--radius) - 2px);
    background: var(--sw-bg);
  }

  .bar {
    height: 6px;
    width: 70%;
    border-radius: 3px;
    background: var(--sw-text);
    opacity: 0.8;
  }

  .bar--short {
    width: 45%;
    opacity: 0.45;
  }

  .dot {
    position: absolute;
    bottom: 9px;
    inset-inline-end: 9px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--sw-accent);
  }

  .name {
    padding: 0 2px 2px;
    font-size: var(--text-sm);
  }
</style>
