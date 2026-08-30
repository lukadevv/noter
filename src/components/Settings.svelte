<script lang="ts">
  import Icon from './Icon.svelte'
  import ThemeEditor from './ThemeEditor.svelte'
  import Lazy from './Lazy.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { requestPersistence, storageInfo, type StorageEstimateInfo } from '$lib/db/db'
  import { notes } from '$lib/stores/notes.svelte'
  import { derivedTitle } from '$lib/db/repo/notes'
  import { assetStorageUsed, purgeOrphanAssets } from '$lib/db/repo/assets'
  import { formatDailyTitle, todayKey } from '$lib/db/repo/daily'
  import { ROOT } from '$lib/db/schema'
  import type { Density, FontChoice } from '$lib/db/repo/settings'
  import { i18n, LOCALES, LOCALE_INFO, t, type Locale } from '$lib/i18n/index.svelte'

  interface Props {
    onclose: () => void
  }

  let { onclose }: Props = $props()

  let editingTheme = $state<string | null>(null)
  let storage = $state<StorageEstimateInfo | null>(null)
  let assets = $state<{ count: number; bytes: number } | null>(null)

  $effect(() => {
    void storageInfo().then((info) => (storage = info))
    void assetStorageUsed().then((used) => (assets = used))
  })

  let daily = $derived(theme.settings.dailyNotes)

  const DENSITIES: Density[] = ['compact', 'cozy', 'comfortable']
  const FONTS: FontChoice[] = ['system', 'sans', 'serif', 'mono']

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    const units = ['KB', 'MB', 'GB']
    let value = bytes / 1024
    let unit = 0
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024
      unit++
    }
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
  }

  async function enablePersistence() {
    const granted = await requestPersistence()
    storage = await storageInfo()
    ui.toast(t(granted ? 'toast.persistGranted' : 'toast.persistDenied'), granted ? 'ok' : 'warn')
  }
</script>

<div class="backdrop" role="presentation" onpointerdown={onclose}></div>

{#if editingTheme}
  <ThemeEditor baseId={editingTheme} onclose={() => (editingTheme = null)} />
{/if}

<div
  class="dialog"
  data-testid="settings-dialog"
  role="dialog"
  aria-modal="true"
  aria-label={t('settings.title')}
>
  <header class="head">
    <h2>{t('settings.title')}</h2>
    <button class="btn btn--ghost btn--icon" aria-label={t('settings.close')} onclick={onclose}>
      <Icon name="x" size={16} />
    </button>
  </header>

  <div class="content">
    <!-- Language comes first: someone who cannot read the interface needs to
         find this without reading anything else. -->
    <section>
      <h3>{t('settings.language')}</h3>
      <div class="field">
        <label for="language-select">{t('settings.language')}</label>
        <select
          id="language-select"
          class="input"
          data-testid="language-select"
          value={i18n.locale}
          onchange={(e) => void i18n.setLocale(e.currentTarget.value as Locale)}
        >
          {#each LOCALES as locale (locale)}
            <option value={locale}>{LOCALE_INFO[locale].name}</option>
          {/each}
        </select>
        <span class="hint faint">{t('settings.languageHint')}</span>
      </div>
    </section>

    <section>
      <h3>{t('settings.appearance')}</h3>

      <div class="field">
        <label for="theme-select">{t('settings.theme')}</label>
        <div class="row">
          <select
            id="theme-select"
            class="input"
            value={theme.settings.themeId}
            onchange={(e) => theme.applyThemeId(e.currentTarget.value)}
          >
            {#each theme.available as option (option.id)}
              <option value={option.id}
                >{option.name}{option.builtin ? '' : ` ${t('settings.custom')}`}</option
              >
            {/each}
          </select>
          <button class="btn" onclick={() => (editingTheme = theme.settings.themeId)}>
            <Icon name="pencil" size={14} />
            {t('settings.customise')}
          </button>
        </div>
        <span class="hint faint">
          {t('settings.customThemeHint')}
        </span>
      </div>

      <div class="field">
        <span class="label">{t('settings.density')}</span>
        <div class="segmented">
          {#each DENSITIES as density (density)}
            <button
              class="segment"
              class:segment--active={theme.settings.density === density}
              onclick={() => theme.update({ density })}
            >
              {t(`settings.densities.${density}`)}
            </button>
          {/each}
        </div>
      </div>

      <div class="field">
        <span class="label">{t('settings.font')}</span>
        <div class="segmented">
          {#each FONTS as font (font)}
            <button
              class="segment"
              class:segment--active={theme.settings.font === font}
              onclick={() => theme.update({ font })}
            >
              {t(`settings.fonts.${font}`)}
            </button>
          {/each}
        </div>
      </div>

      <div class="field">
        <label for="font-size"
          >{t('settings.editorTextSize', { size: theme.settings.editorFontSize })}</label
        >
        <input
          id="font-size"
          type="range"
          min="12"
          max="22"
          step="1"
          value={theme.settings.editorFontSize}
          oninput={(e) => theme.update({ editorFontSize: Number(e.currentTarget.value) })}
        />
      </div>

      <div class="field">
        <label for="radius">{t('settings.cornerRoundness')}</label>
        <input
          id="radius"
          type="range"
          min="0"
          max="2"
          step="0.25"
          value={theme.settings.radiusScale}
          oninput={(e) => theme.update({ radiusScale: Number(e.currentTarget.value) })}
        />
      </div>

      <label class="check">
        <input
          type="checkbox"
          checked={theme.settings.reduceMotion}
          onchange={(e) => theme.update({ reduceMotion: e.currentTarget.checked })}
        />
        {t('settings.reduceMotion')}
      </label>

      <label class="check">
        <input
          type="checkbox"
          checked={theme.settings.showLineNumbers}
          onchange={(e) => theme.update({ showLineNumbers: e.currentTarget.checked })}
        />
        {t('settings.lineNumbers')}
      </label>
    </section>

    <section>
      <h3>{t('settings.daily.title')}</h3>
      <p class="note faint">
        {t('settings.daily.about')}
      </p>

      <label class="check">
        <input
          type="checkbox"
          checked={daily.enabled}
          onchange={(e) => theme.update({ dailyNotes: { ...daily, enabled: e.currentTarget.checked } })}
        />
        {t('settings.daily.enable')}
      </label>

      {#if daily.enabled}
        <div class="field">
          <label for="daily-folder">{t('settings.daily.folder')}</label>
          <select
            id="daily-folder"
            class="input"
            value={daily.folderId}
            onchange={(e) => theme.update({ dailyNotes: { ...daily, folderId: e.currentTarget.value } })}
          >
            <option value={ROOT}>{t('settings.daily.noFolder')}</option>
            {#each notes.visibleFolders as folder (folder.id)}
              <option value={folder.id}>{'\u00a0'.repeat(folder.depth * 2)}{folder.name}</option>
            {/each}
          </select>
        </div>

        <div class="field">
          <label for="daily-format">
            {t('settings.daily.titleFormat', {
              preview: formatDailyTitle(todayKey(), daily.titleFormat),
            })}
          </label>
          <input
            id="daily-format"
            class="input"
            value={daily.titleFormat}
            onchange={(e) => theme.update({ dailyNotes: { ...daily, titleFormat: e.currentTarget.value } })}
          />
          <span class="hint faint">{t('settings.daily.formatTokens')}</span>
        </div>

        {#if notes.templates.length > 0}
          <div class="field">
            <label for="daily-template">{t('settings.daily.template')}</label>
            <select
              id="daily-template"
              class="input"
              value={daily.templateId ?? ''}
              onchange={(e) =>
                theme.update({
                  dailyNotes: { ...daily, templateId: e.currentTarget.value || null },
                })}
            >
              <option value="">{t('common.none')}</option>
              {#each notes.templates as template (template.id)}
                <option value={template.id}>{derivedTitle(template)}</option>
              {/each}
            </select>
          </div>
        {/if}

        <p class="note faint">{t('settings.daily.shortcut', { shortcut: 'Ctrl+Shift+D' })}</p>
      {/if}
    </section>

    <Lazy load={() => import('./BackupSettings.svelte')} />

    <section>
      <h3>{t('settings.storage.title')}</h3>
      {#if storage?.supported}
        <p class="stat">
          {t('settings.storage.used', { used: formatBytes(storage.usage) })}
          {#if storage.quota > 0}{t('settings.storage.available', {
              total: formatBytes(storage.quota),
            })}{/if}
        </p>
        <p class="note faint">
          {#if storage.persisted}
            {t('settings.storage.persistent')}
          {:else}
            Storage is <strong>not</strong> persistent. Browsers may clear it when disk space runs low, and Safari
            clears it after seven days without a visit. Export backups regularly.
          {/if}
        </p>
        {#if assets}
          <p class="stat">
            {t('settings.storage.images', { count: assets.count, size: formatBytes(assets.bytes) })}
          </p>
        {/if}
        <div class="row">
          {#if !storage.persisted}
            <button class="btn" onclick={enablePersistence}>
              {t('settings.storage.requestPersistent')}
            </button>
          {/if}
          <button
            class="btn"
            onclick={async () => {
              const removed = await purgeOrphanAssets()
              assets = await assetStorageUsed()
              ui.toast(
                removed === 0
                  ? t('toast.noOrphanImages')
                  : t('toast.orphanImagesRemoved', { count: removed }),
                'ok',
              )
            }}
          >
            {t('settings.storage.cleanUp')}
          </button>
        </div>
      {:else}
        <p class="note faint">{t('settings.storage.unsupported')}</p>
      {/if}
    </section>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: var(--overlay);
  }

  .dialog {
    position: fixed;
    z-index: 51;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    width: min(94vw, 34rem);
    max-height: min(86vh, 44rem);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-2);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-2) var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
  }

  .head h2 {
    font-size: 15px;
    font-weight: 650;
  }

  .content {
    padding: var(--space-4);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  h3 {
    margin-bottom: var(--space-3);
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .field label,
  .label {
    font-size: 12px;
    color: var(--text-dim);
  }

  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
  }

  .segment {
    flex: 1;
    height: calc(26px * var(--density));
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-dim);
    font-size: 12px;
    text-transform: capitalize;
    cursor: pointer;
  }

  .segment:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .segment--active {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }

  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    font-size: 13px;
    cursor: pointer;
  }

  .check input {
    accent-color: var(--accent);
  }

  .stat {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .note {
    margin: var(--space-2) 0 var(--space-3);
    font-size: 12px;
    line-height: 1.5;
  }

  .hint {
    font-size: 11px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
