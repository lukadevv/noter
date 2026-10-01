<script lang="ts">
  import Icon from '../Icon.svelte'
  import Lazy from '../Lazy.svelte'
  import Skeleton from '../ui/Skeleton.svelte'
  import { SETTINGS_SECTIONS } from './registry'
  import { ui } from '$lib/stores/ui.svelte'
  import { closeSettings, openSettings } from '$lib/nav'
  import { t } from '$lib/i18n/index.svelte'

  let query = $state('')

  /** On phones the list and the section are two screens; wide layouts show both. */
  let active = $derived(
    SETTINGS_SECTIONS.find((s) => s.id === ui.settingsSection) ??
      (ui.narrow ? null : SETTINGS_SECTIONS[0]!),
  )

  let visible = $derived.by(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return SETTINGS_SECTIONS
    return SETTINGS_SECTIONS.filter((section) =>
      [section.label, ...section.keywords].some((key) => t(key).toLowerCase().includes(needle)),
    )
  })

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    event.preventDefault()
    if (ui.narrow && active) openSettings(null)
    else closeSettings()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="page" data-testid="settings-dialog" role="region" aria-label={t('settings.title')}>
  <header class="top">
    {#if ui.narrow && active}
      <button
        class="btn btn--ghost btn--icon"
        aria-label={t('common.back')}
        onclick={() => openSettings(null)}
      >
        <Icon name="chevron-left" size={18} class="flip" />
      </button>
      <h1>{t(active.label)}</h1>
    {:else}
      <h1>{t('settings.title')}</h1>
    {/if}
    <button class="btn btn--ghost btn--icon" aria-label={t('settings.close')} onclick={closeSettings}>
      <Icon name="x" size={18} />
    </button>
  </header>

  <div class="body">
    {#if !ui.narrow || !active}
      <nav class="nav" aria-label={t('settings.title')}>
        <label class="search">
          <Icon name="search" size={14} />
          <input
            class="search-input"
            type="search"
            placeholder={t('settings.search')}
            aria-label={t('settings.search')}
            bind:value={query}
          />
        </label>
        {#each visible as section (section.id)}
          <button
            class="entry"
            class:entry--active={active?.id === section.id}
            data-testid="settings-section-{section.id}"
            aria-current={active?.id === section.id ? 'page' : undefined}
            onclick={() => openSettings(section.id)}
          >
            <Icon name={section.icon} size={16} />
            <span class="label">{t(section.label)}</span>
            {#if ui.narrow}<Icon name="chevron-right" size={14} class="flip chev" />{/if}
          </button>
        {:else}
          <p class="empty faint">{t('settings.noResults')}</p>
        {/each}
      </nav>
    {/if}

    {#if active}
      <main class="content">
        {#key active.id}
          <div class="section enter">
            {#if !ui.narrow}<h2 class="title">{t(active.label)}</h2>{/if}
            <Lazy load={active.load}>
              {#snippet fallback()}<Skeleton rows={5} />{/snippet}
            </Lazy>
          </div>
        {/key}
      </main>
    {/if}
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--bg);
  }

  .top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
  }

  h1 {
    flex: 1;
    font-size: var(--text-lg);
    font-weight: 650;
  }

  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 240px;
    flex: none;
    padding: var(--space-3);
    border-inline-end: 1px solid var(--border);
    overflow-y: auto;
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    padding: 0 var(--space-2);
    height: 32px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
    color: var(--text-faint);
  }

  .search:focus-within {
    border-color: var(--accent);
  }

  .search-input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    outline: none;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 34px;
    padding: 6px var(--space-2);
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: var(--text-dim);
    text-align: start;
    cursor: pointer;
    transition: background var(--dur-1);
  }

  .entry :global(svg) {
    flex-shrink: 0;
  }

  /* Long names wrap instead of losing their ending ("Timers and sou…"). */
  .label {
    min-width: 0;
    line-height: 1.25;
  }

  .entry:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .entry--active {
    background: var(--accent-soft);
    color: var(--text);
  }

  .entry--active :global(svg) {
    color: var(--accent);
  }

  .entry :global(.chev) {
    margin-inline-start: auto;
  }

  .empty {
    padding: var(--space-2);
    font-size: var(--text-md);
  }

  .content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: var(--space-5) var(--space-5) var(--space-6);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 44rem;
    margin: 0 auto;
  }

  .title {
    font-size: var(--text-2xl);
    font-weight: 650;
  }

  @media (max-width: 860px) {
    .nav {
      width: 100%;
      border: 0;
      padding: var(--space-3) var(--space-4);
    }

    .entry {
      min-height: 46px;
      font-size: var(--text-lg);
    }

    .content {
      padding: var(--space-4) var(--space-4) var(--space-6);
    }
  }
</style>
