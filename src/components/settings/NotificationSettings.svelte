<script lang="ts">
  import Group from './Group.svelte'
  import Switch from '../ui/Switch.svelte'
  import Icon from '../Icon.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import * as notify from '$lib/platform/notify'
  import { isCapacitor, isTauri } from '$lib/platform/native'
  import { t } from '$lib/i18n/index.svelte'

  let permission = $state<notify.Permission | null>(null)

  $effect(() => {
    void notify.permission().then((p) => (permission = p))
  })

  const platformNote = isCapacitor()
    ? 'settings.notifications.android'
    : isTauri()
      ? 'settings.notifications.desktop'
      : 'settings.notifications.web'

  async function allow() {
    permission = await notify.requestPermission()
    if (permission !== 'granted') ui.toast(t('settings.notifications.denied'), 'warn')
  }

  async function test() {
    await notify.notify({
      id: 'test',
      title: t('settings.notifications.testTitle'),
      body: t('settings.notifications.testBody'),
    })
  }
</script>

<Group description={t(platformNote)}>
  <Switch
    label={t('settings.notifications.enable')}
    hint={t('settings.notifications.enableHint')}
    checked={theme.settings.notifications}
    onchange={(notifications) => theme.update({ notifications })}
  />

  <div class="status">
    {#if permission === 'granted'}
      <span class="ok"><Icon name="circle-check" size={15} />{t('settings.notifications.granted')}</span>
      <button class="btn" onclick={test}
        ><Icon name="bell" size={14} />{t('settings.notifications.test')}</button
      >
    {:else if permission === 'unsupported'}
      <span class="faint">{t('settings.notifications.unsupported')}</span>
    {:else if permission === 'denied'}
      <span class="warn"><Icon name="triangle-alert" size={15} />{t('settings.notifications.blocked')}</span
      >
    {:else if permission === 'prompt'}
      <button class="btn btn--primary" onclick={allow}>
        <Icon name="bell" size={14} />{t('settings.notifications.allow')}
      </button>
    {/if}
  </div>
</Group>

<style>
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .ok,
  .warn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .ok {
    color: var(--ok);
  }

  .warn {
    color: var(--warn);
  }
</style>
