<script lang="ts">
  import Icon from './Icon.svelte'
  import { encodeNote, shareUrl, MAX_URL_LENGTH } from '$lib/share/encode'
  import { ui } from '$lib/stores/ui.svelte'
  import type { Note } from '$lib/db/schema'

  interface Props {
    note: Note
    /** Plaintext body, which differs from note.body for encrypted notes. */
    body: string
    onclose: () => void
  }

  let { note, body, onclose }: Props = $props()

  let includeImages = $state(true)
  let url = $state('')
  let imagesOmitted = $state(false)
  let tooLong = $state(false)
  let length = $state(0)
  let building = $state(true)

  $effect(() => {
    building = true
    const wanted = includeImages
    void encodeNote({ ...note, body }, { includeImages: wanted }).then((result) => {
      url = shareUrl(result.payload)
      imagesOmitted = result.imagesOmitted
      tooLong = result.tooLong
      length = result.length
      building = false
    })
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      ui.toast('Link copied.', 'ok')
    } catch {
      ui.toast('Clipboard access was denied. Select the link and copy it manually.', 'warn')
    }
  }
</script>

<div class="backdrop" role="presentation" onpointerdown={onclose}></div>

<div class="dialog" data-testid="share-dialog" role="dialog" aria-modal="true" aria-label="Share note">
  <header class="head">
    <Icon name="link" size={16} />
    <span class="title">Share a copy</span>
    <button class="btn btn--ghost btn--icon" aria-label="Close" onclick={onclose}>
      <Icon name="x" size={15} />
    </button>
  </header>

  <div class="content">
    <!-- The note travels inside the URL fragment, which browsers never send to a
         server — so this genuinely involves no backend. -->
    <p class="note faint">
      The whole note is packed into the link itself. Nothing is uploaded anywhere: whoever opens the
      link decodes it in their own browser.
    </p>

    <label class="check">
      <input type="checkbox" bind:checked={includeImages} />
      Include images (as small previews)
    </label>

    <textarea
      class="url"
      data-testid="share-url"
      readonly
      value={building ? 'Building the link…' : url}
      rows="4"
    ></textarea>

    <div class="meta faint">
      <span>{length.toLocaleString()} characters</span>
      {#if tooLong}
        <span class="warn">
          Longer than {MAX_URL_LENGTH.toLocaleString()} — some apps will truncate it.
        </span>
      {/if}
      {#if imagesOmitted}
        <span class="warn">Images were left out to keep the link usable.</span>
      {/if}
    </div>

    <p class="note faint">
      Anyone with the link can read this note. Treat it like the note itself.
    </p>
  </div>

  <footer class="foot">
    <button class="btn" data-testid="share-close" onclick={onclose}>Close</button>
    <button class="btn btn--primary" disabled={building} onclick={copy}>
      <Icon name="copy" size={14} />
      Copy link
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

  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-3) 0;
    font-size: 13px;
    cursor: pointer;
  }

  .check input {
    accent-color: var(--accent);
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
