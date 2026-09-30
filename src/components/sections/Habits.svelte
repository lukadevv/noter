<script lang="ts">
  import { flip } from 'svelte/animate'
  import Icon from '../Icon.svelte'
  import PageHeader from '../ui/PageHeader.svelte'
  import EmptyState from '../ui/EmptyState.svelte'
  import ProgressRing from '../ui/ProgressRing.svelte'
  import HabitCard from '../habits/HabitCard.svelte'
  import HabitDialog from '../habits/HabitDialog.svelte'
  import { habits } from '$lib/habits/store.svelte'
  import { isDone, isScheduled } from '$lib/habits/schedule'
  import { confirm } from '$lib/stores/confirm.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { flipDuration } from '$lib/ui/motion.svelte'
  import type { Habit } from '$lib/db/schema'
  import { addDays, parseDayKey } from '$lib/utils/dates'
  import { weekStart } from '$lib/stats/home'
  import { t } from '$lib/i18n/index.svelte'

  habits.start()

  let editing = $state<Habit | null | 'new'>(null)
  let showArchived = $state(false)

  let archived = $derived(habits.habits.filter((h) => h.archived))
  let todays = $derived(habits.active.filter((h) => isScheduled(h, habits.today)))
  let doneToday = $derived(todays.filter((h) => habits.isDoneOn(h)).length)

  /** How much of each day this week was done, across every habit on that day. */
  let week = $derived.by(() => {
    const start = weekStart(habits.today)
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i)
      const on = habits.active.filter((h) => h.schedule.kind !== 'weekdays' || isScheduled(h, day))
      const done = on.filter((h) => isDone(h, habits.countOn(h.id, day))).length
      return { day, ratio: on.length ? done / on.length : 0, future: day > habits.today }
    })
  })

  async function remove(habit: Habit) {
    const ok = await confirm.ask({
      title: t('habits.deleteTitle', { name: habit.name }),
      body: t('habits.deleteBody'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (!ok) return
    await habits.remove(habit.id)
    ui.toast(t('habits.deleted'), 'info')
  }
</script>

<div class="page" data-testid="habits">
  <PageHeader title={t('nav.habits')} subtitle={t('habits.about')}>
    {#snippet actions()}
      <button class="btn btn--primary btn--pill" data-testid="add-habit" onclick={() => (editing = 'new')}>
        <Icon name="plus" size={14} />{t('habits.new')}
      </button>
    {/snippet}
  </PageHeader>

  {#if habits.loaded && habits.habits.length === 0}
    <EmptyState icon="target" title={t('habits.empty')} body={t('habits.emptyBody')}>
      <button class="btn btn--primary" onclick={() => (editing = 'new')}>
        <Icon name="plus" size={14} />{t('habits.new')}
      </button>
    </EmptyState>
  {:else}
    {#if todays.length > 0}
      <section class="summary surface enter" aria-label={t('habits.today')}>
        <ProgressRing
          value={todays.length ? doneToday / todays.length : 0}
          size={72}
          stroke={7}
          color="var(--ok)"
        >
          <strong class="ratio">{doneToday}/{todays.length}</strong>
        </ProgressRing>
        <div class="summary-text">
          <strong>
            {doneToday === todays.length
              ? t('habits.allDone')
              : t('habits.left', { count: todays.length - doneToday })}
          </strong>
          <span class="faint">{t('habits.todayHint')}</span>
        </div>
        <div class="week" aria-label={t('habits.thisWeek')}>
          {#each week as d (d.day)}
            <span class="wk" class:wk--today={d.day === habits.today}>
              <span class="bar"
                ><span class="fill" style="height: {d.future ? 0 : Math.max(6, d.ratio * 100)}%"
                ></span></span
              >
              <span class="wk-label"
                >{parseDayKey(d.day)?.toLocaleDateString([], { weekday: 'narrow' })}</span
              >
            </span>
          {/each}
        </div>
      </section>
    {/if}

    <div class="list">
      {#each habits.active as habit, i (habit.id)}
        <div animate:flip={{ duration: flipDuration() }}>
          <HabitCard {habit} index={i} onedit={(h) => (editing = h)} ondelete={(h) => void remove(h)} />
        </div>
      {/each}
    </div>

    {#if archived.length > 0}
      <section class="archived">
        <button
          class="btn btn--ghost"
          aria-expanded={showArchived}
          onclick={() => (showArchived = !showArchived)}
        >
          <Icon name={showArchived ? 'chevron-down' : 'chevron-right'} size={14} />
          {t('habits.archived', { count: archived.length })}
        </button>
        {#if showArchived}
          <div class="list">
            {#each archived as habit, i (habit.id)}
              <HabitCard {habit} index={i} onedit={(h) => (editing = h)} ondelete={(h) => void remove(h)} />
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</div>

{#if editing}
  <HabitDialog habit={editing === 'new' ? null : editing} onclose={() => (editing = null)} />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 56rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
  }

  .summary {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    flex-wrap: wrap;
  }

  .ratio {
    font-size: var(--text-lg);
    font-variant-numeric: tabular-nums;
  }

  .summary-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 12rem;
  }

  .summary-text strong {
    font-size: var(--text-xl);
    letter-spacing: -0.01em;
  }

  .week {
    display: flex;
    gap: var(--space-2);
    height: 64px;
  }

  .wk {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 18px;
  }

  .bar {
    position: relative;
    flex: 1;
    width: 8px;
    border-radius: 4px;
    background: var(--surface-3);
    overflow: hidden;
  }

  .fill {
    position: absolute;
    inset: auto 0 0 0;
    border-radius: 4px;
    background: var(--ok);
    transition: height var(--dur-3) var(--ease-out);
  }

  .wk-label {
    color: var(--text-faint);
    font-size: var(--text-xs);
    text-transform: uppercase;
  }

  .wk--today .wk-label {
    color: var(--text);
    font-weight: 700;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .archived {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  @media (max-width: 860px) {
    .page {
      padding: var(--space-5) var(--space-4);
    }
  }
</style>
