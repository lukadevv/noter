<script lang="ts">
  import Icon from './Icon.svelte'
  import { decryptFolder, encryptFolder, keyring } from '$lib/crypto/keyring.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import type { Folder } from '$lib/db/schema'

  interface Props {
    folder: Folder
    onclose: () => void
  }

  let { folder, onclose }: Props = $props()

  let passphrase = $state('')
  let confirmation = $state('')
  let acknowledged = $state(false)
  let busy = $state(false)
  let error = $state('')

  let unlocked = $derived(keyring.unlocked.includes(folder.id))
  let canEncrypt = $derived(
    passphrase.length >= 8 && passphrase === confirmation && acknowledged && !busy,
  )

  async function encrypt() {
    if (!canEncrypt) return
    busy = true
    error = ''
    try {
      const count = await encryptFolder(folder.id, passphrase)
      ui.toast(`${count} note(s) encrypted.`, 'ok')
      onclose()
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Encryption failed.'
    } finally {
      busy = false
    }
  }

  async function remove() {
    busy = true
    try {
      const count = await decryptFolder(folder.id)
      ui.toast(`${count} note(s) decrypted.`, 'ok')
      onclose()
    } catch {
      error = 'Unlock the folder before removing its encryption.'
    } finally {
      busy = false
    }
  }
</script>

<div class="backdrop" role="presentation" onpointerdown={onclose}></div>

<div class="dialog" data-testid="folder-lock" role="dialog" aria-modal="true" aria-label="Folder encryption">
  <header class="head">
    <Icon name="lock" size={16} />
    <span class="title truncate">{folder.name}</span>
    <button class="btn btn--ghost btn--icon" aria-label="Close" onclick={onclose}>
      <Icon name="x" size={15} />
    </button>
  </header>

  <div class="content">
    {#if folder.encrypted}
      <p class="note">
        This folder is encrypted. It is currently <strong>{unlocked ? 'unlocked' : 'locked'}</strong>.
      </p>
      <p class="note faint">
        Unlocked folders re-lock automatically after 15 minutes of inactivity, and whenever the tab
        is closed.
      </p>
      <div class="row">
        {#if unlocked}
          <button class="btn" onclick={() => keyring.lock(folder.id)}>Lock now</button>
          <button class="btn btn--danger" disabled={busy} onclick={remove}>Remove encryption</button>
        {:else}
          <p class="faint">Open a note inside it to unlock.</p>
        {/if}
      </div>
    {:else}
      <p class="note">
        Encrypting a folder rewrites every note inside it as ciphertext. Titles, bodies and tags all
        become unreadable without the passphrase.
      </p>

      <div class="field">
        <label for="pass">Passphrase</label>
        <input id="pass" class="input" type="password" autocomplete="new-password" bind:value={passphrase} />
        {#if passphrase && passphrase.length < 8}
          <span class="hint faint">At least 8 characters.</span>
        {/if}
      </div>

      <div class="field">
        <label for="confirm">Repeat it</label>
        <input id="confirm" class="input" type="password" autocomplete="new-password" bind:value={confirmation} />
        {#if confirmation && passphrase !== confirmation}
          <span class="hint danger">The two do not match.</span>
        {/if}
      </div>

      <!-- There is genuinely no recovery path, so this is a checkbox rather
           than fine print. -->
      <label class="check">
        <input type="checkbox" data-testid="ack-no-recovery" bind:checked={acknowledged} />
        I understand that if I forget this passphrase, these notes are gone for good.
      </label>

      <div class="row">
        <button class="btn" onclick={onclose}>Cancel</button>
        <button class="btn btn--primary" disabled={!canEncrypt} onclick={encrypt}>
          {busy ? 'Encrypting…' : 'Encrypt folder'}
        </button>
      </div>
    {/if}

    {#if error}
      <p class="danger">{error}</p>
    {/if}
  </div>
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
    width: min(94vw, 26rem);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-2);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  .title {
    flex: 1;
    min-width: 0;
    font-weight: 650;
  }

  .content {
    padding: var(--space-4);
  }

  .note {
    margin-bottom: var(--space-3);
    font-size: 13px;
    line-height: 1.6;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }

  .field label {
    font-size: 12px;
    color: var(--text-dim);
  }

  .hint {
    font-size: 11px;
  }

  .danger {
    color: var(--danger);
    font-size: 12px;
  }

  .check {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    font-size: 12px;
    line-height: 1.5;
    cursor: pointer;
  }

  .check input {
    flex: none;
    margin-top: 2px;
    accent-color: var(--accent);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
