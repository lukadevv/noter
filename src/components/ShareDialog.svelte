<script lang="ts">
  import Icon from './Icon.svelte'
  import { encodeNote, shareUrl, MAX_URL_LENGTH } from '$lib/share/encode'
  import { ui } from '$lib/stores/ui.svelte'
  import type { Note } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    note: Note
    /** Plaintext body, which differs from note.body for encrypted notes. */
    body: string
    onclose: () => void
  }

  let { note, body, onclose }: Props = $props()

  // Encoding is synchronous: the link carries text only, so nothing is read
  // from the database to build it.
  let encoded = $derived(encodeNote({ ...note, body }))
  let url = $derived(shareUrl(encoded.payload))

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      ui.toast(t('toast.linkCopied'), 'ok')
    } catch {
      ui.toast(t('toast.linkCopyDenied'), 'warn')
    }
  }
</script>

<div class="backdrop" role="presentation" onpointerdown={onclose}></div>

<div
  class="dialog"
  data-testid="share-dialog"
  role="dialog"
  aria-modal="true"
  aria-label={t('share.title')}
>
  <header class="head">
    <Icon name="link" size={16} />
    <span class="title">{t('share.title')}</span>
    <button class="btn btn--ghost btn--icon" aria-label={t('common.close')} onclick={onclose}>
      <Icon name="x" size={15} />
    </button>
  </header>

  <div class="content">
    <!-- The note travels inside the URL fragment, which browsers never send to a
         server — so this genuinely involves no backend. -->
    <p class="note faint">
      {t('share.about')}
    </p>

    <p class="callout">
      <Icon name="image" size={14} />
      <span>
        <strong>{t('share.noImages')}</strong>
        {t('share.noImagesBody')}
        {#if encoded.imagesOmitted > 0}
          {t('share.imageCount', { count: encoded.imagesOmitted })}
        {/if}
      </span>
    </p>

    <textarea class="url" data-testid="share-url" readonly value={url} rows="4"></textarea>

    <div class="meta faint">
      <span>{t('share.characters', { count: encoded.length.toLocaleString() })}</span>
      {#if encoded.tooLong}
        <span class="warn">
          {t('share.tooLong', { max: MAX_URL_LENGTH.toLocaleString() })}
        </span>
      {/if}
    </div>

    <p class="note faint">{t('share.warning')}</p>
  </div>

  <footer class="foot">
    <button class="btn" data-testid="share-close" onclick={onclose}>{t('common.close')}</button>
    <button class="btn btn--primary" onclick={copy}>
      <Icon name="copy" size={14} />
      {t('share.copyLink')}
    </button>
  </footer>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 52;
    background: var(--overlay);
  }

  .dialog {
    position: fixed;
    z-index: 53;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    width: min(94vw, 30rem);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-2);
    overflow: hidden;
  }

  .head,
  .foot {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .head {
    border-bottom: 1px solid var(--border);
  }

  .foot {
    justify-content: flex-end;
    border-top: 1px solid var(--border);
  }

  .title {
    flex: 1;
    font-weight: 650;
  }

  .content {
    padding: var(--space-4);
  }

  .note {
    font-size: 12px;
    line-height: 1.55;
  }

  .callout {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin: var(--space-3) 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    font-size: 12px;
    line-height: 1.55;
    color: var(--text-dim);
  }

  .callout :global(svg) {
    flex: none;
    margin-top: 2px;
  }

  .callout strong {
    color: var(--text);
  }

  .url {
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    resize: vertical;
    word-break: break-all;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: var(--space-2) 0 var(--space-3);
    font-size: 11px;
  }

  .warn {
    color: var(--warn);
  }
</style>
