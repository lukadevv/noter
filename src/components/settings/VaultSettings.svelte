<script lang="ts">
  import Group from './Group.svelte'
  import Field from '../ui/Field.svelte'
  import Switch from '../ui/Switch.svelte'
  import Dialog from '../ui/Dialog.svelte'
  import Icon from '../Icon.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { secrets } from '$lib/secrets/store.svelte'
  import { strengthOf } from '$lib/secrets/generate'
  import type { VaultSettings } from '$lib/db/repo/settings'
  import { t } from '$lib/i18n/index.svelte'

  secrets.start()

  let settings = $derived(theme.settings.vault)

  function set(patch: Partial<VaultSettings>) {
    theme.update({ vault: { ...settings, ...patch } })
  }

  let changing = $state(false)
  let current = $state('')
  let next = $state('')
  let repeat = $state('')
  let error = $state('')
  let busy = $state(false)

  let deleting = $state(false)
  let confirmText = $state('')

  let canChange = $derived(
    current.length > 0 && next.length >= 10 && next === repeat && strengthOf(next).level !== 'weak',
  )

  function closeChange() {
    changing = false
    current = next = repeat = error = ''
  }

  async function change(event: SubmitEvent) {
    event.preventDefault()
    if (!canChange) return
    busy = true
    try {
      if (await secrets.changePassphrase(current, next)) {
        ui.toast(t('vault.passwordChanged'), 'ok')
        closeChange()
      } else {
        error = t('vault.wrongPassword')
      }
    } finally {
      busy = false
    }
  }

  async function destroy() {
    await secrets.destroy()
    deleting = false
    confirmText = ''
    ui.toast(t('vault.destroyed'), 'info')
  }
</script>

<Group title={t('settings.vault.security')} description={t('settings.vault.about')}>
  <Field label={t('settings.vault.autoLock')} hint={t('settings.vault.autoLockHint')} for="vault-autolock">
    <select
      id="vault-autolock"
      class="input"
      value={String(settings.autoLockMinutes)}
      onchange={(e) => set({ autoLockMinutes: Number(e.currentTarget.value) })}
    >
      {#each [1, 2, 5, 10, 15, 30, 60] as minutes (minutes)}
        <option value={String(minutes)}>{t('settings.vault.minutes', { count: minutes })}</option>
      {/each}
    </select>
  </Field>

  <Switch
    label={t('settings.vault.lockOnHide')}
    hint={t('settings.vault.lockOnHideHint')}
    checked={settings.lockOnHide}
    onchange={(lockOnHide) => set({ lockOnHide })}
  />

  <Field
    label={t('settings.vault.clipboard')}
    hint={t('settings.vault.clipboardHint')}
    for="vault-clipboard"
  >
    <select
      id="vault-clipboard"
      class="input"
      value={String(settings.clipboardSeconds)}
      onchange={(e) => set({ clipboardSeconds: Number(e.currentTarget.value) })}
    >
      {#each [10, 20, 30, 60, 120] as seconds (seconds)}
        <option value={String(seconds)}>{t('settings.vault.seconds', { count: seconds })}</option>
      {/each}
      <option value="0">{t('settings.vault.never')}</option>
    </select>
  </Field>
</Group>

{#if secrets.meta}
  <Group title={t('settings.vault.masterPassword')}>
    <Field label={t('settings.vault.change')} hint={t('settings.vault.changeHint')}>
      <button class="btn" onclick={() => (changing = true)}>
        <Icon name="key-round" size={14} />{t('settings.vault.change')}
      </button>
    </Field>
    <Field label={t('settings.vault.delete')} hint={t('settings.vault.deleteHint')}>
      <button class="btn btn--danger" onclick={() => (deleting = true)}>
        <Icon name="trash" size={14} />{t('settings.vault.delete')}
      </button>
    </Field>
  </Group>
{/if}

{#if changing}
  <Dialog label={t('settings.vault.change')} icon="key-round" size="sm" onclose={closeChange}>
    <form class="form" onsubmit={change}>
      <label class="stack">
        <span>{t('settings.vault.current')}</span>
        <input
          class="input"
          type="password"
          autocomplete="current-password"
          data-autofocus
          bind:value={current}
        />
      </label>
      <label class="stack">
        <span>{t('settings.vault.new')}</span>
        <input class="input" type="password" autocomplete="new-password" bind:value={next} />
      </label>
      {#if next}<p class="faint small">
          {t(`vault.strength.${strengthOf(next).level}`)} · {t('vault.minLength')}
        </p>{/if}
      <label class="stack">
        <span>{t('vault.repeatPassword')}</span>
        <input class="input" type="password" autocomplete="new-password" bind:value={repeat} />
      </label>
      {#if repeat && repeat !== next}<p class="error">{t('lock.mismatch')}</p>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="row">
        <button type="button" class="btn" onclick={closeChange}>{t('common.cancel')}</button>
        <button type="submit" class="btn btn--primary" disabled={!canChange || busy}
          >{t('common.save')}</button
        >
      </div>
    </form>
  </Dialog>
{/if}

{#if deleting}
  <Dialog
    label={t('settings.vault.delete')}
    icon="triangle-alert"
    size="sm"
    onclose={() => (deleting = false)}
  >
    <div class="form">
      <p>{t('settings.vault.deleteConfirm', { count: secrets.count })}</p>
      <label class="stack">
        <span>{t('settings.vault.typeDelete', { word: t('settings.vault.deleteWord') })}</span>
        <input class="input" data-autofocus bind:value={confirmText} />
      </label>
      <div class="row">
        <button class="btn" onclick={() => (deleting = false)}>{t('common.cancel')}</button>
        <button
          class="btn btn--danger"
          disabled={confirmText.trim().toLowerCase() !== t('settings.vault.deleteWord').toLowerCase()}
          onclick={() => void destroy()}>{t('settings.vault.delete')}</button
        >
      </div>
    </div>
  </Dialog>
{/if}

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  .small {
    font-size: var(--text-sm);
  }

  .error {
    color: var(--danger);
    font-size: var(--text-md);
  }

  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
