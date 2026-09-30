<script lang="ts">
  import Group from './Group.svelte'
  import Switch from '../ui/Switch.svelte'
  import Icon from '../Icon.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import type { HomeSettings } from '$lib/db/repo/settings'
  import { flip } from 'svelte/animate'
  import { flipDuration } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  let home = $derived(theme.settings.home)

  function set(patch: Partial<HomeSettings>) {
    theme.update({ home: { ...home, ...patch } })
  }

  function toggle(index: number, visible: boolean) {
    set({ widgets: home.widgets.map((w, i) => (i === index ? { ...w, visible } : w)) })
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= home.widgets.length) return
    const widgets = [...home.widgets]
    ;[widgets[index], widgets[target]] = [widgets[target]!, widgets[index]!]
    set({ widgets })
  }
</script>

<Group title={t('settings.home.reminders')}>
  <Switch
    label={t('settings.daily.homeAlert')}
    hint={t('settings.daily.homeAlertHint')}
    checked={theme.settings.dailyNotes.homeAlert}
    onchange={(homeAlert) => theme.update({ dailyNotes: { ...theme.settings.dailyNotes, homeAlert } })}
  />
</Group>

<Group title={t('settings.home.widgets')} description={t('settings.home.widgetsAbout')}>
  <ul class="widgets" data-testid="home-widgets">
    {#each home.widgets as widget, index (widget.id)}
      <li class="widget" animate:flip={{ duration: flipDuration() }}>
        <div class="grow">
          <Switch
            label={t(`settings.home.widget.${widget.id}`)}
            checked={widget.visible}
            testid="widget-{widget.id}"
            onchange={(visible) => toggle(index, visible)}
          />
        </div>
        <button
          class="btn btn--ghost btn--icon"
          aria-label={t('settings.home.moveUp', { name: t(`settings.home.widget.${widget.id}`) })}
          disabled={index === 0}
          onclick={() => move(index, -1)}
        >
          <Icon name="arrow-up" size={14} />
        </button>
        <button
          class="btn btn--ghost btn--icon"
          aria-label={t('settings.home.moveDown', { name: t(`settings.home.widget.${widget.id}`) })}
          disabled={index === home.widgets.length - 1}
          onclick={() => move(index, 1)}
        >
          <Icon name="arrow-down" size={14} />
        </button>
      </li>
    {/each}
  </ul>
</Group>

<style>
  .widgets {
    list-style: none;
    display: flex;
    flex-direction: column;
  }

  .widget {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .widget + .widget {
    border-top: 1px solid var(--border);
  }

  .grow {
    flex: 1;
    min-width: 0;
  }
</style>
