<script lang="ts">
  import Icon from '../Icon.svelte'
  import { habits } from '$lib/habits/store.svelte'
  import { isScheduled, streak } from '$lib/habits/schedule'
  import { weekStart } from '$lib/stats/home'
  import { addDays } from '$lib/utils/dates'
  import { goTo } from '$lib/nav'

  /** Every habit's week at a glance, with its streak. */
  let week = $derived(Array.from({ length: 7 }, (_, i) => addDays(weekStart(habits.today), i)))
  let list = $derived(habits.active.slice(0, 6))
</script>

<ul class="list">
  {#each list as habit (habit.id)}
    {@const counts = habits.counts.get(habit.id) ?? new Map()}
    {@const run = streak(habit, counts, habits.today, addDays(habits.today, -120))}
    <li>
      <button class="row" style="--c: {habit.color ?? 'var(--accent)'}" onclick={() => goTo('habits')}>
        <span class="icon"><Icon name={habit.icon} size={14} /></span>
        <span class="name truncate">{habit.name}</span>
        <span class="dots" aria-hidden="true">
          {#each week as day (day)}
            <span
              class="dot"
              class:dot--done={(counts.get(day) ?? 0) >= Math.max(1, habit.target)}
              class:dot--off={habit.schedule.kind === 'weekdays' && !isScheduled(habit, day)}
              class:dot--today={day === habits.today}
            ></span>
          {/each}
        </span>
        <span class="streak" class:streak--zero={run.current === 0}>
          <Icon name="flame" size={12} />{run.current}
        </span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2);
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }

  .row:hover {
    background: var(--surface-2);
  }

  .icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    background: color-mix(in oklab, var(--c) 17%, transparent);
    color: var(--c);
  }

  .name {
    flex: 1;
    min-width: 0;
    font-size: var(--text-md);
  }

  .dots {
    display: flex;
    gap: 3px;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--surface-3);
  }

  .dot--off {
    background: none;
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .dot--done {
    background: var(--c);
  }

  .dot--today:not(.dot--done) {
    box-shadow: inset 0 0 0 1.5px var(--text-dim);
  }

  .streak {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    min-width: 2.4em;
    justify-content: flex-end;
    color: var(--warn);
    font-size: var(--text-sm);
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }

  .streak--zero {
    color: var(--text-faint);
  }
</style>
