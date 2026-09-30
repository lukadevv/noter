<script lang="ts">
  import Icon from './Icon.svelte'
  import { updates } from '$lib/platform/updates.svelte'
  import { rise } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  /** "A new version is ready", in the corner: never a modal, never in the way of writing. */
  let update = $derived(updates.available)
</script>

{#if update && !updates.dismissed}
  <aside
    class="banner surface"
    role="status"
    aria-live="polite"
    data-testid="update-banner"
    transition:rise={{ y: 16 }}
  >
    <span class="icon" class:spin={updates.status === 'downloading'}>
      <Icon name={updates.status === 'ready' ? 'circle-check' : 'download'} size={18} />
    </span>
    <div class="text">
      <strong>
        {#if updates.status === 'ready'}{t('updates.ready')}
        {:else if update.version}{t('updates.available', { version: update.version })}
        {:else}{t('updates.availableWeb')}{/if}
      </strong>
      {#if updates.status === 'downloading'}
        <span class="bar"
          ><span class="fill" style="width: {Math.round(updates.progress * 100)}%"></span></span
        >
      {:else if updates.status === 'error'}
        <span class="faint small">{t('updates.failed')}</span>
      {:else}
        <span class="faint small">
          {update.mode === 'download' ? t('updates.downloadHint') : t('updates.installHint')}
        </span>
      {/if}
    </div>
    <div class="actions">
      {#if updates.status === 'ready'}
        <button class="btn btn--primary btn--pill" onclick={() => void updates.restart()}
          >{t('updates.restart')}</button
        >
      {:else if updates.status !== 'downloading'}
        {#if update.version}
          <button class="btn btn--ghost" onclick={() => updates.skip()}>{t('updates.skip')}</button>
        {/if}
        <button class="btn btn--ghost" onclick={() => updates.later()}>{t('updates.later')}</button>
        <button
          class="btn btn--primary btn--pill"
          data-testid="update-apply"
          onclick={() => void updates.apply()}
        >
          {update.mode === 'download'
            ? t('updates.download')
            : update.mode === 'reload'
              ? t('updates.reload')
              : t('updates.install')}
        </button>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .banner {
    position: fixed;
    right: var(--space-4);
    bottom: var(--space-4);
    z-index: var(--z-toast);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: min(30rem, calc(100vw - 32px));
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
    box-shadow: var(--shadow-3);
    flex-wrap: wrap;
  }

  :global([dir='rtl']) .banner {
    right: auto;
    left: var(--space-4);
  }

  .icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
  }

  .spin :global(svg) {
    animation: bob 1s var(--ease-in-out) infinite alternate;
  }

  @keyframes bob {
    to {
      transform: translateY(3px);
    }
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 10rem;
  }

  .small {
    font-size: var(--text-sm);
  }

  .bar {
    height: 5px;
    border-radius: 3px;
    background: var(--surface-3);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width var(--dur-2) linear;
  }

  .actions {
    display: flex;
    gap: var(--space-1);
    margin-inline-start: auto;
  }

  @media (max-width: 860px) {
    .banner {
      bottom: calc(72px + env(safe-area-inset-bottom));
    }
  }
</style>
