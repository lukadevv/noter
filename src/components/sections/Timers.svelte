<script lang="ts">
  import PageHeader from '../ui/PageHeader.svelte'
  import Tabs from '../ui/Tabs.svelte'
  import Lazy from '../Lazy.svelte'
  import Skeleton from '../ui/Skeleton.svelte'
  import AlarmsTab from '../timers/AlarmsTab.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { stopwatch } from '$lib/timers/stopwatch.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { replaceRoute, type TimerTab } from '../../routes/router'
  import { t } from '$lib/i18n/index.svelte'

  timers.start()
  stopwatch.start()

  const SUBTITLE: Record<TimerTab, string> = {
    alarms: 'timers.about',
    pomodoro: 'pomodoro.about',
    stopwatch: 'stopwatch.about',
  }

  let tabs = $derived([
    {
      value: 'alarms' as const,
      label: t('timers.tabs.alarms'),
      icon: 'alarm-clock',
      badge: timers.alarms.length || null,
    },
    {
      value: 'pomodoro' as const,
      label: t('timers.tabs.pomodoro'),
      icon: 'target',
      badge: !!timers.pomodoro && timers.pomodoro.pausedRemaining === null,
    },
    {
      value: 'stopwatch' as const,
      label: t('timers.tabs.stopwatch'),
      icon: 'timer',
      badge: stopwatch.running,
    },
  ])

  function choose(tab: TimerTab) {
    ui.timersTab = tab
    replaceRoute({ kind: 'timers', tab })
  }
</script>

<div class="page" data-testid="timers">
  <PageHeader title={t('nav.timers')} subtitle={t(SUBTITLE[ui.timersTab])} />
  <div class="tabs enter" style="--i: 1" data-tour="timer-tabs">
    <Tabs {tabs} value={ui.timersTab} label={t('nav.timers')} testid="timer-tabs" onchange={choose} />
  </div>

  {#key ui.timersTab}
    <div class="tab">
      {#if ui.timersTab === 'alarms'}
        <AlarmsTab />
      {:else if ui.timersTab === 'pomodoro'}
        <Lazy load={() => import('../timers/PomodoroTab.svelte')}>
          {#snippet fallback()}<Skeleton rows={4} />{/snippet}
        </Lazy>
      {:else}
        <Lazy load={() => import('../timers/StopwatchTab.svelte')}>
          {#snippet fallback()}<Skeleton rows={4} />{/snippet}
        </Lazy>
      {/if}
    </div>
  {/key}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 64rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
  }

  .tabs {
    margin-top: calc(var(--space-2) * -1);
  }

  @media (max-width: 860px) {
    .page {
      padding: var(--space-5) var(--space-4);
    }
  }
</style>
