<script lang="ts">
  import Icon from '../Icon.svelte'
  import { secrets } from '$lib/secrets/store.svelte'
  import { strengthOf } from '$lib/secrets/generate'
  import { rise } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  /** First run creates the vault; afterwards this is the unlock screen. */
  let creating = $derived(secrets.metaLoaded && !secrets.meta)

  let password = $state('')
  let confirm = $state('')
  let acknowledged = $state(false)
  let show = $state(false)
  let busy = $state(false)
  let error = $state('')

  let strength = $derived(strengthOf(password))
  let canCreate = $derived(
    password.length >= 10 && password === confirm && acknowledged && strength.level !== 'weak',
  )

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    error = ''
    busy = true
    try {
      if (creating) {
        if (!canCreate) return
        await secrets.setup(password)
      } else if (!(await secrets.unlock(password))) {
        error = t('vault.wrongPassword')
        password = ''
        return
      }
      password = ''
      confirm = ''
    } finally {
      busy = false
    }
  }
</script>

<div class="gate" in:rise>
  <div class="badge"><Icon name={creating ? 'shield' : 'lock-keyhole'} size={30} /></div>
  <h1>{t(creating ? 'vault.setupTitle' : 'vault.lockedTitle')}</h1>
  <p class="faint lead">{t(creating ? 'vault.setupBody' : 'vault.lockedBody')}</p>

  <form class="form" onsubmit={submit}>
    <label class="field">
      <span>{t('vault.masterPassword')}</span>
      <div class="with-button">
        <input
          class="input"
          type={show ? 'text' : 'password'}
          autocomplete={creating ? 'new-password' : 'current-password'}
          data-testid="vault-password"
          bind:value={password}
          data-autofocus
        />
        <button
          type="button"
          class="btn btn--ghost btn--icon"
          aria-label={t(show ? 'vault.hide' : 'vault.show')}
          onclick={() => (show = !show)}
        >
          <Icon name={show ? 'eye-off' : 'eye'} size={15} />
        </button>
      </div>
    </label>

    {#if creating}
      <div class="meter meter--{strength.level}" aria-hidden="true"><span></span></div>
      <p class="hint">{t(`vault.strength.${strength.level}`)} · {t('vault.minLength')}</p>

      <label class="field">
        <span>{t('vault.repeatPassword')}</span>
        <input
          class="input"
          type={show ? 'text' : 'password'}
          autocomplete="new-password"
          data-testid="vault-confirm"
          bind:value={confirm}
        />
      </label>
      {#if confirm && confirm !== password}<p class="error">{t('lock.mismatch')}</p>{/if}

      <label class="check">
        <input type="checkbox" data-testid="vault-ack" bind:checked={acknowledged} />
        <span>{t('vault.noRecovery')}</span>
      </label>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <button
      class="btn btn--primary submit"
      type="submit"
      disabled={busy || (creating ? !canCreate : !password)}
    >
      {#if busy}{t('lock.unlocking')}{:else}<Icon
          name={creating ? 'shield-check' : 'lock-open'}
          size={15}
        />{t(creating ? 'vault.create' : 'vault.unlock')}{/if}
    </button>
  </form>
</div>

<style>
  .gate {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    max-width: 26rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }

  .badge {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    margin-bottom: var(--space-2);
    border-radius: var(--radius-lg);
    background: var(--accent-soft);
    color: var(--accent);
  }

  h1 {
    font-size: var(--text-2xl);
  }

  .lead {
    margin-bottom: var(--space-3);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 100%;
    text-align: start;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  .with-button {
    display: flex;
    gap: var(--space-1);
  }

  .meter {
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--surface-3);
    overflow: hidden;
  }

  .meter span {
    display: block;
    height: 100%;
    width: 15%;
    background: var(--danger);
    transition:
      width var(--dur-3) var(--ease-out),
      background var(--dur-2);
  }

  .meter--fair span {
    width: 45%;
    background: var(--warn);
  }

  .meter--good span {
    width: 72%;
    background: var(--ok);
  }

  .meter--strong span {
    width: 100%;
    background: var(--ok);
  }

  .hint {
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .check {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    color: var(--text-dim);
    font-size: var(--text-md);
    cursor: pointer;
  }

  .error {
    color: var(--danger);
    font-size: var(--text-md);
  }

  .submit {
    height: 38px;
  }
</style>
