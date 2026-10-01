<script lang="ts">
  import Group from './Group.svelte'
  import Logo from '../Logo.svelte'
  import Kbd from '../ui/Kbd.svelte'
  import Switch from '../ui/Switch.svelte'
  import Icon from '../Icon.svelte'
  import { isNative } from '$lib/platform/native'
  import { updates } from '$lib/platform/updates.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { t } from '$lib/i18n/index.svelte'

  const version = __APP_VERSION__
  const SITE = 'https://noter.lukadevv.com'
  const REPO = 'https://github.com/lukadevv/noter'
  // Inside the desktop and Android shells the policy page is bundled too, but
  // links there open in the app's own window; the public URL is what to share.
  const privacyUrl = isNative() ? `${SITE}/privacy.html` : '/privacy.html'

  void updates.detectKind()

  let statusLine = $derived.by(() => {
    switch (updates.status) {
      case 'checking':
        return t('updates.checking')
      case 'current':
        return t('updates.current')
      case 'available':
      case 'downloading':
      case 'ready':
        return updates.available?.version
          ? t('updates.available', { version: updates.available.version })
          : t('updates.availableWeb')
      case 'managed':
        return t('updates.store')
      case 'error':
        return t('updates.failed')
      default:
        return updates.kind === 'store' ? t('updates.store') : ''
    }
  })

  const SHORTCUTS: [string, string][] = [
    ['Mod+K', 'settings.about.keys.palette'],
    ['Mod+N', 'actions.newNote'],
    ['Mod+Shift+D', 'actions.openToday'],
    ['Mod+Shift+Space', 'actions.openScratchpad'],
    ['Mod+,', 'actions.openSettings'],
    ['Mod+Shift+L', 'settings.about.keys.lock'],
    ['Mod+Click', 'settings.about.keys.link'],
    ['Mod+1', 'settings.about.keys.home'],
    ['Mod+2', 'settings.about.keys.notes'],
    ['Mod+\\', 'settings.about.keys.sidebar'],
    ['Alt+↑', 'settings.about.keys.reorder'],
    ['F2', 'settings.about.keys.rename'],
    ['Shift+F10', 'settings.about.keys.menu'],
  ]
</script>

<div class="hero">
  <Logo size={56} />
  <div>
    <h3>{t('app.name')}</h3>
    <p class="faint">{t('app.tagline')}</p>
    <p class="faint version">{t('settings.about.version', { version })}</p>
  </div>
</div>

<Group title={t('updates.title')} description={t(`updates.how.${updates.kind}`)}>
  <div class="update-row">
    <button
      class="btn"
      data-testid="check-updates"
      disabled={updates.status === 'checking' ||
        updates.status === 'downloading' ||
        updates.kind === 'store'}
      onclick={() => {
        updates.dismissed = false
        void updates.check()
      }}
    >
      <Icon name="refresh-cw" size={14} />{t('updates.check')}
    </button>
    {#if statusLine}<span class="faint" data-testid="update-status">{statusLine}</span>{/if}
  </div>
  {#if updates.kind !== 'web' && updates.kind !== 'store'}
    <Switch
      label={t('updates.auto')}
      checked={theme.settings.updates.autoCheck}
      onchange={(autoCheck) => theme.update({ updates: { ...theme.settings.updates, autoCheck } })}
    />
  {/if}
</Group>

<Group title={t('settings.about.privacy')} description={t('settings.about.privacySummary')}>
  <div class="links">
    <a href={privacyUrl} target="_blank" rel="noopener">{t('settings.about.privacyPolicy')}</a>
    <a href={REPO} target="_blank" rel="noopener">{t('settings.about.source')}</a>
    <a href="{REPO}/blob/main/LICENSE" target="_blank" rel="noopener">{t('settings.about.license')}</a>
  </div>
</Group>

<Group title={t('settings.about.shortcuts')}>
  <dl class="keys">
    {#each SHORTCUTS as [keys, label] (keys)}
      <dt>{t(label)}</dt>
      <dd><Kbd {keys} /></dd>
    {/each}
  </dl>
</Group>

<style>
  .hero {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  h3 {
    font-size: var(--text-xl);
  }

  .update-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .version {
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .keys {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2) var(--space-4);
    margin: 0;
  }

  dt {
    color: var(--text-dim);
  }

  dd {
    margin: 0;
  }

  .keys > :global(* + *) {
    border: 0;
    padding: 0;
  }
</style>
