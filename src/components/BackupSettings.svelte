<script lang="ts">
  import Icon from './Icon.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { notes } from '$lib/stores/notes.svelte'
  import { archiveFileName, download, exportMarkdownArchive, importMarkdownArchive } from '$lib/backup/archive'
  import { describeVault, exportVault, importVault, vaultFileName, VaultFileError } from '$lib/backup/vault-file'
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
      download(blob, vaultFileName())
      ui.toast(
        vaultPassphrase ? 'Encrypted backup downloaded.' : 'Backup downloaded (not encrypted).',
        vaultPassphrase ? 'ok' : 'warn',
      )
      vaultPassphrase = ''
    } finally {
      busy = ''
    }
  }

  async function exportArchive() {
    busy = 'archive'
    try {
      await notes.flushPending()
      download(await exportMarkdownArchive(), archiveFileName())
      ui.toast('Markdown archive downloaded.', 'ok')
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
        importError = cause instanceof VaultFileError ? cause.message : 'That file could not be read.'
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
        `Restored ${result.notes} note(s) and ${result.assets} image(s); ${result.skipped} already current.`,
        'ok',
      )
      pending = null
      importPassphrase = ''
    } catch (cause) {
      importError = cause instanceof VaultFileError ? cause.message : 'The backup could not be restored.'
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
          `Imported ${summary.notes} note(s) into ${summary.folders} new folder(s); ${summary.skipped} already current.`,
          'ok',
        )
      } catch {
        ui.toast('That zip could not be read as a Noter export.', 'warn')
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
      ui.toast(`Backups will be written to “${name}”.`, 'ok')
    }
  }

  async function backupNow() {
    busy = 'backup'
    try {
      await notes.flushPending()
      if (!(await ensurePermission())) {
        ui.toast('Permission to that folder was declined.', 'warn')
        return
      }
      const result = await runBackup(backup?.encrypt ? vaultPassphrase || undefined : undefined)
      backup = await loadBackupState()
      ui.toast(result.ok ? `Wrote ${result.files.join(' and ')}.` : (result.error ?? 'Backup failed.'), result.ok ? 'ok' : 'danger')
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
  <h3>Backup and transfer</h3>

  {#if staleDays !== null && staleDays > 14}
    <p class="warning">
      <Icon name="archive" size={14} />
      Your last backup was {staleDays} days ago.
    </p>
  {/if}

  <p class="note faint">
    A <strong>vault file</strong> holds everything — notes, folders, images, themes and settings —
    in one file, for moving between computers. The <strong>Markdown archive</strong> is a zip of
    readable <code>.md</code> files that opens in any editor.
  </p>

  <div class="field">
    <label for="vault-pass">Vault passphrase (optional)</label>
    <input
      id="vault-pass"
      class="input"
      type="password"
      autocomplete="new-password"
      placeholder="Leave empty for an unencrypted file"
      bind:value={vaultPassphrase}
    />
    <span class="hint faint">
      With a passphrase the file is encrypted with AES-GCM. Without one it is still binary and
      compressed, but that is obfuscation, not security.
    </span>
  </div>

  <div class="row">
    <button class="btn btn--primary" disabled={busy === 'vault'} onclick={exportVaultFile}>
      <Icon name="archive" size={14} />
      {busy === 'vault' ? 'Preparing…' : 'Export vault'}
    </button>
    <button class="btn" onclick={chooseVaultFile}>Import vault…</button>
  </div>

  <div class="row spaced">
    <button class="btn" disabled={busy === 'archive'} onclick={exportArchive}>
      <Icon name="file-text" size={14} />
      Export Markdown zip
    </button>
    <button class="btn" disabled={busy === 'import-zip'} onclick={importArchive}>Import Markdown zip…</button>
  </div>

  {#if importError}
    <p class="error">{importError}</p>
  {/if}

  {#if pending}
    <div class="pending" data-testid="restore-preview">
      <h4>Restore this backup?</h4>
      <p class="faint">
        {pending.header.counts.notes} notes · {pending.header.counts.folders} folders ·
        {pending.header.counts.assets} images · written
        {new Date(pending.header.createdAt).toLocaleString()}
        {pending.header.encrypted ? '· encrypted' : ''}
      </p>

      {#if pending.header.encrypted}
        <input
          class="input"
          type="password"
          autocomplete="current-password"
          placeholder="Backup passphrase"
          aria-label="Backup passphrase"
          bind:value={importPassphrase}
        />
      {/if}

      <div class="segmented">
        {#each [['merge', 'Merge'], ['replace', 'Replace everything']] as const as [id, label] (id)}
          <button class="segment" class:segment--active={importMode === id} onclick={() => (importMode = id)}>
            {label}
          </button>
        {/each}
      </div>
      <span class="hint faint">
        {importMode === 'merge'
          ? 'Keeps whichever copy of each note was edited most recently. Safe to run repeatedly.'
          : 'Deletes everything here first, then restores the backup exactly.'}
      </span>

      <div class="row">
        <button class="btn" onclick={() => (pending = null)}>Cancel</button>
        <button
          class="btn btn--primary"
          data-testid="confirm-restore"
          disabled={busy === 'import'}
          onclick={confirmImport}
        >
          {busy === 'import' ? 'Restoring…' : 'Restore'}
        </button>
      </div>
    </div>
  {/if}
</section>

<section>
  <h3>Automatic backups</h3>

  {#if supportsDirectoryAccess()}
    <p class="note faint">
      Choose a folder once and Noter writes both formats into it. Because browsers can clear their
      own storage, this is the copy that actually keeps your notes safe.
    </p>

    <div class="row">
      <button class="btn" onclick={pickFolder}>
        <Icon name="folder" size={14} />
        {folder ? `Folder: ${folder}` : 'Choose a folder'}
      </button>
      {#if folder}
        <button class="btn" disabled={busy === 'backup'} onclick={backupNow}>
          {busy === 'backup' ? 'Writing…' : 'Back up now'}
        </button>
        <button
          class="btn btn--ghost btn--danger"
          onclick={async () => {
            await forgetDirectory()
            folder = null
            await update({ frequency: 'off' })
          }}
        >
          Forget
        </button>
      {/if}
    </div>

    {#if folder && backup}
      <div class="field spaced">
        <span class="label">Frequency</span>
        <div class="segmented">
          {#each FREQUENCIES as option (option.id)}
            <button
              class="segment"
              class:segment--active={backup.frequency === option.id}
              onclick={() => void update({ frequency: option.id })}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>

      <p class="note faint">
        {#if backup.lastRunAt}
          Last backup {new Date(backup.lastRunAt).toLocaleString()}.
        {:else}
          No backup written yet.
        {/if}
        {#if backup.lastError}
          <span class="error">{backup.lastError}</span>
        {/if}
      </p>
    {/if}
  {:else}
    <p class="note faint">
      This browser cannot write to a folder directly (only Chrome and Edge implement it). Use
      <strong>Export vault</strong> above and save the file somewhere safe — a reminder appears here
      once a backup is more than two weeks old.
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

  code {
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 0.92em;
  }
</style>
