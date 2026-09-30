<script lang="ts">
  import Group from './Group.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { requestPersistence, storageInfo, type StorageEstimateInfo } from '$lib/db/db'
  import { assetStorageUsed, purgeOrphanAssets } from '$lib/db/repo/assets'
  import { formatBytes } from '$lib/utils/bytes'
  import { t } from '$lib/i18n/index.svelte'

  let storage = $state<StorageEstimateInfo | null>(null)
  let assets = $state<{ count: number; bytes: number } | null>(null)

  // Only measured when this section is opened: counting images reads every
  // image record, which is not free on a large notebook.
  $effect(() => {
    void storageInfo().then((info) => (storage = info))
    void assetStorageUsed().then((used) => (assets = used))
  })

  let ratio = $derived(storage && storage.quota > 0 ? storage.usage / storage.quota : 0)

  async function enablePersistence() {
    const granted = await requestPersistence()
    storage = await storageInfo()
    ui.toast(t(granted ? 'toast.persistGranted' : 'toast.persistDenied'), granted ? 'ok' : 'warn')
  }

  async function cleanUp() {
    const removed = await purgeOrphanAssets()
    assets = await assetStorageUsed()
    ui.toast(
      removed === 0 ? t('toast.noOrphanImages') : t('toast.orphanImagesRemoved', { count: removed }),
      'ok',
    )
  }
</script>

<Group>
  {#if storage?.supported}
    <div class="usage">
      <p class="stat">
        {t('settings.storage.used', { used: formatBytes(storage.usage) })}
        {#if storage.quota > 0}{t('settings.storage.available', { total: formatBytes(storage.quota) })}{/if}
      </p>
      {#if storage.quota > 0}
        <div class="meter" role="presentation">
          <span style="width: {Math.max(1, ratio * 100)}%"></span>
        </div>
      {/if}
    </div>
    <p class="faint">
      {storage.persisted ? t('settings.storage.persistent') : t('settings.storage.notPersistent')}
    </p>
    {#if assets}
      <p class="stat">
        {t('settings.storage.images', { count: assets.count, size: formatBytes(assets.bytes) })}
      </p>
    {/if}
    <div class="row">
      {#if !storage.persisted}
        <button class="btn" onclick={enablePersistence}>{t('settings.storage.requestPersistent')}</button>
      {/if}
      <button class="btn" onclick={cleanUp}>{t('settings.storage.cleanUp')}</button>
    </div>
  {:else}
    <p class="faint">{t('settings.storage.unsupported')}</p>
  {/if}
</Group>

<style>
  .usage {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .stat {
    font-variant-numeric: tabular-nums;
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
    background: var(--accent);
    border-radius: inherit;
    transition: width var(--dur-3) var(--ease-out);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
