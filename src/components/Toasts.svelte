<script lang="ts">
  import Icon from './Icon.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'

  import { flip } from 'svelte/animate'
  import { flipDuration, rise } from '$lib/ui/motion.svelte'

  const ICON = {
    info: 'info',
    ok: 'circle-check',
    warn: 'triangle-alert',
    danger: 'triangle-alert',
  } as const
</script>

<div class="stack" role="status" aria-live="polite">
  {#each ui.toasts as toast (toast.id)}
    <div
      class="toast toast--{toast.tone}"
      data-testid="toast"
      role="presentation"
      in:rise={{ y: 12 }}
      out:rise={{ y: 6, duration: 140 }}
      animate:flip={{ duration: flipDuration() }}
      onpointerenter={() => ui.holdToast(toast.id)}
      onpointerleave={() => ui.releaseToast(toast.id)}
      onfocusin={() => ui.holdToast(toast.id)}
      onfocusout={() => ui.releaseToast(toast.id)}
    >
      <Icon name={ICON[toast.tone]} size={14} />
      <span class="text">{toast.message}</span>
      {#if toast.action}
        <button
          class="action"
          onclick={() => {
            toast.action?.run()
            ui.dismiss(toast.id)
          }}
        >
          {toast.action.label}
        </button>
      {/if}
      <button class="close" aria-label={t('common.dismiss')} onclick={() => ui.dismiss(toast.id)}>
        <Icon name="x" size={13} />
      </button>
    </div>
  {/each}
</div>

<style>
  .stack {
    position: fixed;
    left: 50%;
    bottom: var(--space-4);
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    transform: translateX(-50%);
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: min(90vw, 30rem);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    box-shadow: var(--shadow-2);
    pointer-events: auto;
  }

  .toast--ok {
    border-color: var(--ok);
  }

  .toast--warn {
    border-color: var(--warn);
  }

  .toast--danger {
    border-color: var(--danger);
  }

  .text {
    flex: 1;
    font-size: 13px;
  }

  .action {
    flex: none;
    padding: 2px var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--accent);
    font-size: 12px;
    cursor: pointer;
  }

  .action:hover {
    background: var(--surface-3);
  }

  .close {
    display: flex;
    flex: none;
    padding: 4px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  .close:hover {
    background: var(--surface-3);
    color: var(--text);
  }
</style>
