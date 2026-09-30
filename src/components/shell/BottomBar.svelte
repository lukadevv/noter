<script lang="ts">
  import Icon from '../Icon.svelte'
  import { SECTIONS } from '$lib/sections'
  import { goTo } from '$lib/nav'
  import { ui } from '$lib/stores/ui.svelte'
  import { alerts } from '$lib/stores/alerts.svelte'
  import { t } from '$lib/i18n/index.svelte'
</script>

<nav class="bar" aria-label={t('nav.main')}>
  {#each SECTIONS as entry (entry.id)}
    {@const count = alerts.countFor(entry.id)}
    <button
      class="item"
      class:item--active={ui.section === entry.id}
      data-testid="nav-{entry.id}"
      aria-current={ui.section === entry.id ? 'page' : undefined}
      onclick={() => goTo(entry.id)}
    >
      <span class="pill"><Icon name={entry.icon} size={20} /></span>
      <span class="label">{t(entry.label)}</span>
      {#if count > 0}<span class="badge">{count}</span>{/if}
    </button>
  {/each}
</nav>

<style>
  .bar {
    display: flex;
    justify-content: space-around;
    gap: var(--space-1);
    padding: 6px var(--space-2) calc(6px + env(safe-area-inset-bottom));
    background: var(--bg-2);
    border-top: 1px solid var(--border);
    z-index: var(--z-nav);
  }

  .item {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    max-width: 96px;
    padding: 2px 0;
    border: 0;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .pill {
    display: grid;
    place-items: center;
    width: 52px;
    height: 28px;
    border-radius: var(--radius-full);
    transition:
      background var(--dur-2) var(--ease-out),
      transform var(--dur-2) var(--ease-out);
  }

  .item:active .pill {
    transform: scale(0.92);
  }

  .item--active {
    color: var(--text);
  }

  .item--active .pill {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .label {
    font-size: 11px;
    font-weight: 500;
  }

  .badge {
    position: absolute;
    top: 0;
    inset-inline-start: calc(50% + 8px);
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
