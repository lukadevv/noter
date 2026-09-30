<script lang="ts">
  import Icon from '../Icon.svelte'
  import ProgressRing from '../ui/ProgressRing.svelte'
  import CheckBurst from '../ui/CheckBurst.svelte'
  import { habits } from '$lib/habits/store.svelte'
  import { completion, isScheduled, streak } from '$lib/habits/schedule'
  import type { Habit } from '$lib/db/schema'
  import { menu } from '$lib/stores/menu.svelte'
  import { contextmenu } from '$lib/ui/contextmenu'
  import type { MenuItem } from '$lib/ui-types'
  import { addDays, parseDayKey } from '$lib/utils/dates'
  import { weekStart } from '$lib/stats/home'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    habit: Habit
    index?: number
    onedit: (habit: Habit) => void
    ondelete: (habit: Habit) => void
  }

  let { habit, index = 0, onedit, ondelete }: Props = $props()

  let color = $derived(habit.color ?? 'var(--accent)')
  let today = $derived(habits.today)
  let counts = $derived(habits.counts.get(habit.id) ?? new Map<string, number>())
  let count = $derived(counts.get(today) ?? 0)
  let target = $derived(Math.max(1, habit.target))
  let done = $derived(count >= target)
  let scheduledToday = $derived(isScheduled(habit, today))
  let run = $derived(streak(habit, counts, today, addDays(today, -400)))
  let rate = $derived(completion(habit, counts, today, 30))
  /** Bumped each time a tap completes the habit, to replay the burst. */
  let burst = $state(0)
  let open = $state(false)

  let week = $derived(Array.from({ length: 7 }, (_, i) => addDays(weekStart(today), i)))

  /** 17 weeks, Monday-first columns, for the history grid. */
  let grid = $derived.by(() => {
    const start = addDays(weekStart(today), -16 * 7)
    return Array.from({ length: 17 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
    )
  })

  let scheduleText = $derived.by(() => {
    const s = habit.schedule
    if (s.kind === 'daily') return t('habits.schedule.daily')
    if (s.kind === 'perWeek') return t('habits.perWeekShort', { count: s.times })
    const names = [1, 2, 3, 4, 5, 6, 0]
      .filter((d) => s.days.includes(d))
      .map((d) => new Date(2026, 8, 27 + d).toLocaleDateString([], { weekday: 'short' }))
    return names.join(' · ')
  })

  async function tap() {
    const was = done
    const nowDone = await habits.check(habit.id)
    if (nowDone && !was) burst++
  }

  function items(): MenuItem[] {
    return [
      { id: 'edit', label: t('habits.edit'), icon: 'pencil', run: () => onedit(habit) },
      ...(count > 0
        ? [
            {
              id: 'less',
              label: t('habits.undoOne'),
              icon: 'minus',
              run: () => void habits.uncheck(habit.id),
            },
          ]
        : []),
      {
        id: 'archive',
        label: t(habit.archived ? 'habits.unarchive' : 'habits.archive'),
        icon: 'archive',
        run: () => void habits.setArchived(habit.id, !habit.archived),
      },
      {
        id: 'delete',
        label: t('common.delete'),
        icon: 'trash',
        danger: true,
        separatorBefore: true,
        run: () => ondelete(habit),
      },
    ]
  }

  const dayLabel = (day: string) =>
    parseDayKey(day)?.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) ?? day
</script>

<article
  class="card surface enter"
  class:card--done={done}
  class:card--off={!scheduledToday}
  style="--i: {index}; --c: {color}"
  data-testid="habit-card"
  use:contextmenu={items}
>
  <div class="main">
    <button class="expand" aria-expanded={open} onclick={() => (open = !open)}>
      <span class="badge"><Icon name={habit.icon} size={20} /></span>
      <span class="text">
        <strong class="name truncate">{habit.name}</strong>
        <span class="meta">
          {scheduleText}
          {#if run.current > 0}
            <span class="streak" title={t('habits.bestStreak', { count: run.best })}>
              <Icon name="flame" size={12} />
              {t(run.unit === 'weeks' ? 'habits.streakWeeks' : 'habits.streakDays', { count: run.current })}
            </span>
          {/if}
        </span>
      </span>
    </button>

    <div class="week" aria-label={t('habits.thisWeek')}>
      {#each week as day (day)}
        {@const on = isScheduled(habit, day) || habit.schedule.kind === 'perWeek'}
        {@const ok = (counts.get(day) ?? 0) >= target}
        <button
          class="wd"
          class:wd--done={ok}
          class:wd--today={day === today}
          class:wd--off={!on}
          disabled={day > today}
          title={dayLabel(day)}
          aria-label="{dayLabel(day)}: {ok ? t('habits.done') : t('habits.notDone')}"
          onclick={() => void habits.toggleDay(habit, day)}
        >
          {parseDayKey(day)?.toLocaleDateString([], { weekday: 'narrow' })}
        </button>
      {/each}
    </div>

    <button
      class="tap"
      class:tap--done={done}
      data-testid="habit-check"
      aria-label={done
        ? t('habits.doneNamed', { name: habit.name })
        : t('habits.checkNamed', { name: habit.name })}
      aria-pressed={done}
      onclick={tap}
    >
      {#if done}
        {#key burst}<CheckBurst size={40} {color} />{/key}
      {:else if target > 1}
        <ProgressRing value={count / target} size={44} stroke={4} {color}>
          <span class="count">{count}/{target}</span>
        </ProgressRing>
      {:else}
        <span class="empty"><Icon name="check" size={18} /></span>
      {/if}
    </button>

    <button
      class="more"
      aria-label={t('habits.actions')}
      onclick={(e) => menu.open(items(), e.currentTarget, habit.name)}
    >
      <Icon name="more" size={15} />
    </button>
  </div>

  {#if open}
    <div class="history">
      <div class="grid" role="img" aria-label={t('habits.history')}>
        {#each grid as column, w (w)}
          <div class="col">
            {#each column as day (day)}
              {@const c = counts.get(day) ?? 0}
              <span
                class="cell"
                class:cell--future={day > today}
                style="--a: {day > today ? 0 : Math.min(1, c / target)}"
                title="{dayLabel(day)} · {c}/{target}"
              ></span>
            {/each}
          </div>
        {/each}
      </div>
      <dl class="figures">
        <div>
          <dt>{t('habits.current')}</dt>
          <dd>{run.current}</dd>
        </div>
        <div>
          <dt>{t('habits.best')}</dt>
          <dd>{run.best}</dd>
        </div>
        <div>
          <dt>{t('habits.last30')}</dt>
          <dd>{rate === null ? '—' : `${Math.round(rate * 100)}%`}</dd>
        </div>
      </dl>
    </div>
  {/if}
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
    transition:
      border-color var(--dur-3),
      background var(--dur-3);
  }

  .card--done {
    border-color: color-mix(in oklab, var(--c) 45%, var(--border));
    background: linear-gradient(
      90deg,
      color-mix(in oklab, var(--c) 9%, var(--surface)),
      var(--surface) 60%
    );
  }

  .card--off:not(.card--done) {
    opacity: 0.72;
  }

  .main {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .expand {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }

  .badge {
    display: grid;
    place-items: center;
    flex: none;
    width: 42px;
    height: 42px;
    border-radius: 13px;
    background: color-mix(in oklab, var(--c) 17%, transparent);
    color: var(--c);
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .card--done .name {
    color: var(--text-dim);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .streak {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: var(--warn);
    font-weight: 600;
  }

  .week {
    display: flex;
    gap: 4px;
  }

  .wd {
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: none;
    color: var(--text-faint);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      background var(--dur-2),
      transform var(--dur-1);
  }

  .wd:active:not(:disabled) {
    transform: scale(0.88);
  }

  .wd:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .wd--off {
    border-style: dashed;
  }

  .wd--today {
    border-color: var(--text-dim);
    color: var(--text);
  }

  .wd--done {
    border-color: transparent;
    background: var(--c);
    color: var(--bg);
  }

  .tap {
    display: grid;
    place-items: center;
    flex: none;
    width: 52px;
    height: 52px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    transition: transform var(--dur-1) var(--ease-out);
  }

  .tap:active {
    transform: scale(0.88);
  }

  .empty {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 2px solid color-mix(in oklab, var(--c) 55%, var(--border));
    border-radius: 50%;
    color: transparent;
    transition:
      color var(--dur-2),
      background var(--dur-2);
  }

  .tap:hover .empty {
    background: color-mix(in oklab, var(--c) 14%, transparent);
    color: var(--c);
  }

  .count {
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .more {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  .more:hover {
    background: var(--surface-3);
    color: var(--text);
  }

  .history {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    flex-wrap: wrap;
    padding: var(--space-3) 0 var(--space-1);
    border-top: 1px solid var(--border);
    animation: enter-rise 300ms var(--ease-out);
  }

  .grid {
    display: flex;
    gap: 3px;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .cell {
    width: 11px;
    height: 11px;
    border-radius: 3px;
    background: color-mix(in oklab, var(--c) calc(var(--a) * 100%), var(--surface-3));
  }

  .cell--future {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .figures {
    display: flex;
    gap: var(--space-5);
    margin: 0;
  }

  .figures div {
    display: flex;
    flex-direction: column;
  }

  dt {
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  dd {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 640px) {
    .main {
      flex-wrap: wrap;
    }

    .expand {
      flex: 1 1 0;
    }

    .week {
      order: 3;
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
