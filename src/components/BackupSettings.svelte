<script lang="ts">
  import Icon from './Icon.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { notes } from '$lib/stores/notes.svelte'
  import { t } from '$lib/i18n/index.svelte'
  import {
    archiveFileName,
    download,
    exportMarkdownArchive,
    importMarkdownArchive,
  } from '$lib/backup/archive'
  import { SaveCancelled } from '$lib/platform/save-file'
  import {
    describeVault,
    exportVault,
    importVault,
    vaultFileName,
    VaultFileError,
  } from '$lib/backup/vault-file'
  import type { ImportMode, VaultHeader } from '$lib/backup/vault-file'
  import {
    chooseDirectory,
    daysSinceBackup,
    directoryName,
    ensurePermission,
    forgetDirectory,
    loadBackupState,
    runBackup,
    saveBackupState,
    supportsDirectoryAccess,
    type BackupFrequency,
    type BackupState,
  } from '$lib/backup/fsaccess'

  // Named `backup` rather than `state`: a local called `state` collides with the
  // `$state` rune in the compiled output.
  let backup = $state<BackupState | null>(null)
  let folder = $state<string | null>(null)
  let busy = $state('')

  let vaultPassphrase = $state('')
  let pending = $state<{ file: File; header: VaultHeader } | null>(null)
  let importPassphrase = $state('')
  let importMode = $state<ImportMode>('merge')
  let importError = $state('')

  $effect(() => {
    void loadBackupState().then((loaded) => (backup = loaded))
    void directoryName().then((name) => (folder = name))
  })

  let staleDays = $derived(backup ? daysSinceBackup(backup) : null)

  async function update(patch: Partial<BackupState>) {
    if (!backup) return
    const next = { ...backup, ...patch }
    backup = next
    await saveBackupState(next)
  }

  async function exportVaultFile() {
    busy = 'vault'
    try {
      // An export taken moments after typing must include what was typed.
      await notes.flushPending()
      const blob = await exportVault(vaultPassphrase ? { passphrase: vaultPassphrase } : {})
      await download(blob, vaultFileName())
      ui.toast(
        t(vaultPassphrase ? 'toast.vaultEncrypted' : 'toast.vaultPlain'),
        vaultPassphrase ? 'ok' : 'warn',
      )
      vaultPassphrase = ''
    } catch (cause) {
      // Backing out of the native save dialog is a choice, not a failure.
      if (!(cause instanceof SaveCancelled)) ui.toast(t('toast.saveFailed'), 'warn')
    } finally {
      busy = ''
    }
  }

  async function exportArchive() {
    busy = 'archive'
    try {
      await notes.flushPending()
      await download(await exportMarkdownArchive(), archiveFileName())
      ui.toast(t('toast.archiveDownloaded'), 'ok')
    } catch (cause) {
      if (!(cause instanceof SaveCancelled)) ui.toast(t('toast.saveFailed'), 'warn')
    } finally {
      busy = ''
    }
  }

  function pickFile(accept: string, onpick: (file: File) => void) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file) onpick(file)
    })
    input.click()
  }

  function chooseVaultFile() {
    pickFile('.noter', async (file) => {
      importError = ''
      try {
        pending = { file, header: await describeVault(file) }
      } catch (cause) {
        importError = cause instanceof VaultFileError ? cause.message : t('toast.fileUnreadable')
      }
    })
  }

  async function confirmImport() {
    if (!pending) return
    busy = 'import'
    importError = ''
    try {
      const result = await importVault(pending.file, importMode, importPassphrase || undefined)
      ui.toast(
        t('toast.vaultRestored', {
          notes: result.notes,
          assets: result.assets,
          skipped: result.skipped,
        }),
        'ok',
      )
      if (result.secretsSkipped) ui.toast(t('toast.secretsSkipped'), 'warn')
      pending = null
      importPassphrase = ''
    } catch (cause) {
      importError = cause instanceof VaultFileError ? cause.message : t('toast.vaultUnreadable')
    } finally {
      busy = ''
    }
  }

  function importArchive() {
    pickFile('.zip', async (file) => {
      busy = 'import-zip'
      try {
        const summary = await importMarkdownArchive(file)
        ui.toast(
          t('toast.zipImported', {
            notes: summary.notes,
            folders: summary.folders,
            skipped: summary.skipped,
          }),
          'ok',
        )
      } catch {
        ui.toast(t('toast.zipUnreadable'), 'warn')
      } finally {
        busy = ''
      }
    })
  }

  async function pickFolder() {
    const name = await chooseDirectory()
    if (name) {
      folder = name
      await update({ frequency: backup?.frequency === 'off' ? 'daily' : (backup?.frequency ?? 'daily') })
      ui.toast(t('toast.backupFolderSet', { name }), 'ok')
    }
  }

  async function backupNow() {
    busy = 'backup'
    try {
      await notes.flushPending()
      if (!(await ensurePermission())) {
        ui.toast(t('toast.backupDenied'), 'warn')
        return
      }
      const result = await runBackup(backup?.encrypt ? vaultPassphrase || undefined : undefined)
      backup = await loadBackupState()
      ui.toast(
        result.ok ? `Wrote ${result.files.join(' and ')}.` : (result.error ?? t('toast.backupFailed')),
        result.ok ? 'ok' : 'danger',
      )
    } finally {
      busy = ''
    }
  }

  const FREQUENCIES: { id: BackupFrequency; label: string }[] = [
    { id: 'off', label: 'Off' },
    { id: 'manual', label: 'Manual' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
  ]
</script>

<section>
  <h3>{t('settings.backup.title')}</h3>

  {#if staleDays !== null && staleDays > 14}
    <p class="warning">
      <Icon name="archive" size={14} />
      {t('settings.backup.stale', { count: staleDays })}
    </p>
  {/if}

  <p class="note faint">
    {t('settings.backup.about')}
  </p>

  <div class="field">
    <label for="vault-pass">{t('settings.backup.passphrase')}</label>
    <input
      id="vault-pass"
      class="input"
      type="password"
      autocomplete="new-password"
      placeholder={t('settings.backup.passphrasePlaceholder')}
      bind:value={vaultPassphrase}
    />
    <span class="hint faint">
      {t('settings.backup.passphraseHint')}
    </span>
  </div>

  <div class="row">
    <button class="btn btn--primary" disabled={busy === 'vault'} onclick={exportVaultFile}>
      <Icon name="archive" size={14} />
      {t(busy === 'vault' ? 'settings.backup.preparing' : 'settings.backup.exportVault')}
    </button>
    <button class="btn" onclick={chooseVaultFile}>{t('settings.backup.importVault')}</button>
  </div>

  <div class="row spaced">
    <button class="btn" disabled={busy === 'archive'} onclick={exportArchive}>
      <Icon name="file-text" size={14} />
      {t('settings.backup.exportMarkdown')}
    </button>
    <button class="btn" disabled={busy === 'import-zip'} onclick={importArchive}>
      {t('settings.backup.importMarkdown')}
    </button>
  </div>

  {#if importError}
    <p class="error">{importError}</p>
  {/if}

  {#if pending}
    <div class="pending" data-testid="restore-preview">
      <h4>{t('settings.backup.restoreTitle')}</h4>
      <p class="faint">
        {t('settings.backup.restoreSummary', {
          notes: pending.header.counts.notes,
          folders: pending.header.counts.folders,
          assets: pending.header.counts.assets,
          date: new Date(pending.header.createdAt).toLocaleString(),
        })}
        {pending.header.encrypted ? t('settings.backup.encryptedSuffix') : ''}
      </p>

      {#if pending.header.encrypted}
        <input
          class="input"
          type="password"
          autocomplete="current-password"
          placeholder={t('settings.backup.backupPassphrase')}
          aria-label="Backup passphrase"
          bind:value={importPassphrase}
        />
      {/if}

      <div class="segmented">
        {#each ['merge', 'replace'] as const as id (id)}
          <button
            class="segment"
            class:segment--active={importMode === id}
            onclick={() => (importMode = id)}
          >
            {t(`settings.backup.${id}`)}
          </button>
        {/each}
      </div>
      <span class="hint faint">
        {importMode === 'merge' ? t('settings.backup.mergeHint') : t('settings.backup.replaceHint')}
      </span>

      <div class="row">
        <button class="btn" onclick={() => (pending = null)}>{t('common.cancel')}</button>
        <button
          class="btn btn--primary"
          data-testid="confirm-restore"
          disabled={busy === 'import'}
          onclick={confirmImport}
        >
          {t(busy === 'import' ? 'settings.backup.restoring' : 'settings.backup.restore')}
        </button>
      </div>
    </div>
  {/if}
</section>

<section>
  <h3>{t('settings.auto.title')}</h3>

  {#if supportsDirectoryAccess()}
    <p class="note faint">
      {t('settings.auto.about')}
    </p>

    <div class="row">
      <button class="btn" onclick={pickFolder}>
        <Icon name="folder" size={14} />
        {folder ? t('settings.auto.folderNamed', { name: folder }) : t('settings.auto.chooseFolder')}
      </button>
      {#if folder}
        <button class="btn" disabled={busy === 'backup'} onclick={backupNow}>
          {t(busy === 'backup' ? 'settings.auto.writing' : 'settings.auto.backupNow')}
        </button>
        <button
          class="btn btn--ghost btn--danger"
          onclick={async () => {
            await forgetDirectory()
            folder = null
            await update({ frequency: 'off' })
          }}
        >
          {t('settings.auto.forget')}
        </button>
      {/if}
    </div>

    {#if folder && backup}
      <div class="field spaced">
        <span class="label">{t('settings.auto.frequency')}</span>
        <div class="segmented">
          {#each FREQUENCIES as option (option.id)}
            <button
              class="segment"
              class:segment--active={backup.frequency === option.id}
              onclick={() => void update({ frequency: option.id })}
            >
              {t(`settings.auto.frequencies.${option.id}`)}
            </button>
          {/each}
        </div>
      </div>

      <p class="note faint">
        {#if backup.lastRunAt}
          {t('settings.auto.lastBackup', { date: new Date(backup.lastRunAt).toLocaleString() })}
        {:else}
          {t('settings.auto.never')}
        {/if}
        {#if backup.lastError}
          <span class="error">{backup.lastError}</span>
        {/if}
      </p>
    {/if}
  {:else}
    <p class="note faint">
      {t('settings.auto.unsupported')}
      <strong>Export vault</strong> above and save the file somewhere safe - a reminder appears here once a backup
      is more than two weeks old.
    </p>
  {/if}
</section>

<style>
  h3 {
    margin-bottom: var(--space-3);
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  h4 {
    font-size: 13px;
    font-weight: 650;
  }

  .note {
    margin: var(--space-2) 0 var(--space-3);
    font-size: 12px;
    line-height: 1.55;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .field label,
  .label {
    font-size: 12px;
    color: var(--text-dim);
  }

  .hint {
    font-size: 11px;
    line-height: 1.5;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .spaced {
    margin-top: var(--space-2);
  }

  .warning {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--warn);
    border-radius: var(--radius);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 12px;
  }

  .error {
    color: var(--danger);
    font-size: 12px;
  }

  .pending {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: var(--accent-soft);
  }

  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
  }

  .segment {
    flex: 1;
    height: 26px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
  }

  .segment--active {
    background: var(--accent);
    color: var(--accent-contrast);
  }
</style>
