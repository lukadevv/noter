<script lang="ts">
  import Icon from './Icon.svelte'
  import ReadingView from './ReadingView.svelte'
  import { decodeNote, inlineSharedImages, type SharePayload } from '$lib/share/encode'
  import { createNote } from '$lib/db/repo/notes'
  import { extractTags } from '$lib/md/links'
  import { ui } from '$lib/stores/ui.svelte'
  import { navigate, HOME } from '../routes/router'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    payload: string
  }

  let { payload }: Props = $props()

  let shared = $state<SharePayload | null>(null)
  let failed = $state(false)

  $effect(() => {
    const decoded = decodeNote(payload)
    shared = decoded
    failed = decoded === null
  })

  let body = $derived(shared ? inlineSharedImages(shared.b, shared.i) : '')

  async function keep() {
    if (!shared) return
    const note = await createNote({
      title: shared.t,
      body: shared.b,
      tags: extractTags(shared.b),
    })
    // Straight to the saved copy, not to Home: that is what the user just made.
    navigate({ kind: 'notes', folderId: null, noteId: note.id })
    ui.toast(t('toast.savedFromLink'), 'ok')
  }
</script>

<div class="shared">
  <header class="bar">
    <Icon name="link" size={16} />
    <span class="label">{t('share.sharedNote')}</span>
    <div class="spacer"></div>
    <button class="btn" onclick={() => navigate(HOME)}>{t('share.openApp')}</button>
    <button class="btn btn--primary" disabled={!shared} onclick={keep}>
      <Icon name="plus" size={14} />
      {t('share.saveToNotes')}
    </button>
  </header>

  <div class="content">
    {#if failed}
      <div class="error">
        <Icon name="x" size={22} />
        <h1>{t('share.unreadable')}</h1>
        <p class="faint">
          {t('share.unreadableBody')}
        </p>
      </div>
    {:else if shared}
      <article class="note">
        <h1>{shared.t}</h1>
        <!-- Untrusted content from whoever made the link: rendered through the
             same sanitising pipeline as everything else. -->
        <ReadingView {body} readOnly imagesUnavailable />
      </article>
    {/if}
  </div>
</div>

<style>
  .shared {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: var(--bg);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border);
    color: var(--text-dim);
  }

  .label {
    font-size: 13px;
  }

  .spacer {
    flex: 1;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .note {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 46rem;
    margin: 0 auto;
    padding: var(--space-5) 0 0;
  }

  .note h1 {
    padding: 0 var(--space-4) var(--space-3);
    font-size: 1.7em;
    font-weight: 680;
  }

  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-4);
    text-align: center;
    color: var(--text-faint);
  }

  .error h1 {
    font-size: 16px;
    color: var(--text);
  }

  .error p {
    max-width: 30rem;
    font-size: 13px;
    line-height: 1.6;
  }
</style>
