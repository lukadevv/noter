<script lang="ts">
  import Dialog from './Dialog.svelte'
  import IconBadge from './IconBadge.svelte'
  import { confirm } from '$lib/stores/confirm.svelte'
  import { t } from '$lib/i18n/index.svelte'

  const TONE = {
    default: 'var(--accent)',
    warn: 'var(--warn)',
    danger: 'var(--danger)',
  } as const

  const ICON = { default: 'info', warn: 'triangle-alert', danger: 'trash' } as const
</script>

{#if confirm.current}
  {@const request = confirm.current}
  {@const tone = request.tone ?? 'default'}
  <Dialog label={request.title} size="sm" onclose={() => confirm.answer(false)} testid="confirm-dialog">
    {#snippet head()}{/snippet}
    <div class="confirm">
      <IconBadge name={request.icon ?? ICON[tone]} color={TONE[tone]} size={44} round />
      <h2>{request.title}</h2>
      {#if request.body}<p class="body">{request.body}</p>{/if}
      {#if request.details?.length}
        <ul class="details">
          {#each request.details as line, i (i)}
            <li>{line}</li>
          {/each}
        </ul>
      {/if}
      <div class="actions">
        <button class="btn btn--lg" data-testid="confirm-cancel" onclick={() => confirm.answer(false)}>
          {request.cancelLabel ?? t('common.cancel')}
        </button>
        <button
          class="btn btn--lg btn--primary"
          class:btn--danger-solid={tone === 'danger'}
          class:btn--warn-solid={tone === 'warn'}
          data-testid="confirm-ok"
          data-autofocus
          onclick={() => confirm.answer(true)}
        >
          {request.confirmLabel}
        </button>
      </div>
    </div>
  </Dialog>
{/if}

<style>
  .confirm {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding-top: var(--space-2);
    text-align: center;
  }

  h2 {
    margin-top: var(--space-2);
    font-size: var(--text-xl);
    font-weight: 680;
    letter-spacing: -0.01em;
  }

  .body {
    color: var(--text-dim);
  }

  .details {
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-1);
    padding: var(--space-3);
    border-radius: var(--radius);
    background: var(--bg-2);
    list-style: none;
    text-align: start;
    font-size: var(--text-md);
    color: var(--text-dim);
  }

  .details li::before {
    content: '•';
    margin-inline-end: var(--space-2);
    color: var(--text-faint);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
    align-self: stretch;
    margin-top: var(--space-3);
  }

  .btn--danger-solid {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }

  .btn--danger-solid:hover {
    background: color-mix(in oklab, var(--danger) 88%, white);
    border-color: var(--danger);
  }

  .btn--warn-solid {
    background: var(--warn);
    border-color: var(--warn);
    color: #1a1305;
  }

  .btn--warn-solid:hover {
    background: color-mix(in oklab, var(--warn) 88%, white);
    border-color: var(--warn);
  }
</style>
