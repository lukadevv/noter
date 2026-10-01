<script lang="ts">
  import Icon from '../Icon.svelte'
  import Logo from '../Logo.svelte'
  import { SECTIONS } from '$lib/sections'
  import { goTo, openSettings } from '$lib/nav'
  import { ui } from '$lib/stores/ui.svelte'
  import { alerts } from '$lib/stores/alerts.svelte'
  import { formatShortcut } from '$lib/ui/keys'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    onsearch: () => void
  }

  let { onsearch }: Props = $props()
</script>

<nav class="rail" aria-label={t('nav.main')}>
  <button class="brand" aria-label={t('nav.home')} onclick={() => goTo('home')}>
    <Logo size={26} />
  </button>

  <div class="items" data-tour="nav">
    {#each SECTIONS as entry (entry.id)}
      {@const count = alerts.countFor(entry.id)}
      <button
        class="item"
        class:item--active={ui.section === entry.id}
        data-testid="nav-{entry.id}"
        data-tour="nav-{entry.id}"
        aria-label={t(entry.label)}
        aria-current={ui.section === entry.id ? 'page' : undefined}
        title="{t(entry.label)} ({formatShortcut(entry.shortcut)})"
        onclick={() => goTo(entry.id)}
      >
        <span class="indicator" aria-hidden="true"></span>
        <Icon name={entry.icon} size={19} />
        <span class="label">{t(entry.short)}</span>
        {#if count > 0}<span class="badge" aria-label={t('nav.alerts', { count })}>{count}</span>{/if}
      </button>
    {/each}
  </div>

  <div class="spacer"></div>

  <button
    class="item"
    data-tour="search"
    aria-label={t('nav.search')}
    title="{t('nav.search')} ({formatShortcut('Mod+K')})"
    onclick={onsearch}
  >
    <Icon name="search" size={19} />
    <span class="label">{t('nav.short.search')}</span>
  </button>
  <button
    class="item"
    class:item--active={ui.section === 'settings'}
    data-testid="open-settings"
    data-tour="settings"
    aria-label={t('sidebar.settings')}
    title="{t('sidebar.settings')} ({formatShortcut('Mod+,')})"
    onclick={() => openSettings()}
  >
    <span class="indicator" aria-hidden="true"></span>
    <Icon name="settings" size={19} />
    <span class="label">{t('nav.short.settings')}</span>
  </button>
</nav>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    width: 68px;
    height: 100%;
    padding: var(--space-3) 0 var(--space-3);
    background: var(--bg-2);
    border-inline-end: 1px solid var(--border);
    z-index: var(--z-nav);
  }

  .brand {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-bottom: var(--space-3);
    border: 0;
    border-radius: var(--radius);
    background: none;
    cursor: pointer;
    transition: transform var(--dur-2) var(--ease-out);
  }

  .brand:hover {
    transform: rotate(-6deg) scale(1.06);
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }

  .spacer {
    flex: 1;
  }

  .item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 100%;
    padding: var(--space-2) 0;
    border: 0;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    transition: color var(--dur-2);
  }

  .item :global(svg) {
    padding: 5px;
    width: 34px;
    height: 30px;
    border-radius: var(--radius);
    transition:
      background var(--dur-2) var(--ease-out),
      transform var(--dur-2) var(--ease-out);
  }

  .item:hover {
    color: var(--text);
  }

  .item:hover :global(svg) {
    background: var(--surface-2);
  }

  .item:active :global(svg) {
    transform: scale(0.94);
  }

  .item--active {
    color: var(--text);
  }

  .item--active :global(svg) {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .indicator {
    position: absolute;
    inset-inline-start: 0;
    top: 50%;
    width: 3px;
    height: 0;
    border-radius: 0 3px 3px 0;
    background: var(--accent);
    transform: translateY(-50%);
    transition: height var(--dur-2) var(--ease-out);
  }

  .item--active .indicator {
    height: 22px;
  }

  .label {
    max-width: 100%;
    padding-inline: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1.2;
  }

  .badge {
    position: absolute;
    top: 4px;
    inset-inline-end: 12px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: var(--radius-full);
    background: var(--danger);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
  }
</style>
