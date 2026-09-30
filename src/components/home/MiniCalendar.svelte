<script lang="ts">
  import { untrack } from 'svelte'
  import Icon from '../Icon.svelte'
  import { monthGrid } from '$lib/stats/home'
  import { parseDayKey } from '$lib/utils/dates'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    today: string
    /** Days that have a daily note. */
    marked: Set<string>
    onopen: (day: string) => void
  }

  let { today, marked, onopen }: Props = $props()

  const start = parseDayKey(untrack(() => today)) ?? new Date()
  let year = $state(start.getFullYear())
  let month = $state(start.getMonth())

  let cells = $derived(monthGrid(year, month))
  let title = $derived(
    new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  )

  // Monday-first narrow weekday names, in the user's language.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 8, 28 + i).toLocaleDateString(undefined, { weekday: 'narrow' }),
  )
  const fullDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  function shift(delta: number) {
    const next = new Date(year, month + delta, 1)
    year = next.getFullYear()
    month = next.getMonth()
  }
</script>

<div class="calendar" data-testid="mini-calendar">
  <div class="head">
    <strong class="title">{title}</strong>
    <button
      class="btn btn--ghost btn--icon"
      aria-label={t('home.calendar.previous')}
      onclick={() => shift(-1)}
    >
      <Icon name="chevron-left" size={15} />
    </button>
    <button class="btn btn--ghost btn--icon" aria-label={t('home.calendar.next')} onclick={() => shift(1)}>
      <Icon name="chevron-right" size={15} />
    </button>
  </div>
  <div class="grid" role="group" aria-label={title}>
    {#each weekdays as weekday, i (i)}
      <span class="weekday" aria-hidden="true">{weekday}</span>
    {/each}
    {#each cells as day, i (day ?? `blank-${i}`)}
      {#if day}
        <button
          class="day"
          class:day--today={day === today}
          class:day--marked={marked.has(day)}
          aria-label={`${fullDate.format(parseDayKey(day)!)}${marked.has(day) ? ` · ${t('home.calendar.hasNote')}` : ''}`}
          aria-current={day === today ? 'date' : undefined}
          onclick={() => onopen(day)}
        >
          {Number(day.slice(8))}
        </button>
      {:else}
        <span></span>
      {/if}
    {/each}
  </div>
</div>

<style>
  .calendar {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .title {
    flex: 1;
    font-size: var(--text-md);
    text-transform: capitalize;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    text-align: center;
  }

  .weekday {
    padding: 2px 0;
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .day {
    position: relative;
    aspect-ratio: 1;
    max-height: 36px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-dim);
    font-size: var(--text-md);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .day:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .day--marked {
    color: var(--text);
    font-weight: 600;
  }

  .day--marked::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 3px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
    transform: translateX(-50%);
  }

  .day--today {
    background: var(--accent-soft);
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
</style>
