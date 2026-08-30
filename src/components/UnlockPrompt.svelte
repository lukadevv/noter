<script lang="ts">
  import Icon from './Icon.svelte'
  import { keyring } from '$lib/crypto/keyring.svelte'
  import { notes } from '$lib/stores/notes.svelte'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    folderId: string
  }

  let { folderId }: Props = $props()

  let passphrase = $state('')
  let error = $state('')
  let busy = $state(false)

  let folderName = $derived(notes.folders.find((f) => f.id === folderId)?.name ?? t('sidebar.newFolder'))

  async function unlock(event: SubmitEvent) {
    event.preventDefault()
    if (!passphrase || busy) return
    busy = true
    error = ''
    // Key derivation is intentionally slow; the button reflects that rather
    // than appearing frozen.
    const ok = await keyring.unlock(folderId, passphrase)
    busy = false
    if (ok) passphrase = ''
    else error = t('lock.wrongPassphrase')
  }
</script>

<div class="lock" data-testid="lock-prompt">
  <Icon name="lock" size={26} />
  <h2>{t('lock.lockedHeading', { name: folderName })}</h2>
  <p class="faint">
    {t('lock.lockedBody')}
  </p>

  <form onsubmit={unlock}>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="input"
      type="password"
      autocomplete="current-password"
      placeholder={t('lock.passphrase')}
      aria-label={t('lock.folderPassphrase')}
      autofocus
      bind:value={passphrase}
    />
    <button class="btn btn--primary" disabled={busy || !passphrase}>
      {t(busy ? 'lock.unlocking' : 'lock.unlock')}
    </button>
  </form>

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .lock {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    height: 100%;
    padding: var(--space-5);
    text-align: center;
    color: var(--text-faint);
  }

  h2 {
    font-size: 15px;
    font-weight: 650;
    color: var(--text);
  }

  p {
    max-width: 30rem;
    font-size: 13px;
    line-height: 1.6;
  }

  form {
    display: flex;
    gap: var(--space-2);
    width: min(100%, 22rem);
  }

  .error {
    color: var(--danger);
    font-size: 12px;
  }
</style>
