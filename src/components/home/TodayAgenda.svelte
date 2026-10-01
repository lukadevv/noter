<script lang="ts">
  import { flip } from 'svelte/animate'
  import Icon from '../Icon.svelte'
  import IconBadge from '../ui/IconBadge.svelte'
  import { meds } from '$lib/meds/store.svelte'
  import { habits } from '$lib/habits/store.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { isExpectedOn } from '$lib/habits/schedule'
  import { formatSpan, startOfDay, DAY } from '$lib/meds/schedule'
  import { formatClock } from '$lib/timers/duration'
  import { PHASE_COLOR } from '$lib/timers/pomodoro'
  import { goTo } from '$lib/nav'
  import { navigate } from '../../routes/router'
  import { flipDuration } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  /**
   * Everything that wants doing today, in one list: doses due, habits not
   * ticked yet, countdowns running. Actionable in place - "Taken" and the habit
   * check work right here - so Home is somewhere you act, not just look.
   */
  interface Props {
    now: number
  }

  let { now }: Props = $props()

  type Row =
    | { kind: 'med'; key: string; rank: number; id: string }
    | { kind: 'habit'; key: string; rank: number; id: string; done: boolean }
    | { kind: 'timer'; key: string; rank: number; id: string }

  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  let rows = $derived.by(() => {
    const list: Row[] = []
    const endOfDay = startOfDay(meds.now) + DAY
    for (const med of meds.active) {
      const status = meds.statuses.get(med.id)
      if (!status) continue
      const rank = { overdue: 0, due: 1, first: 5, soon: 3, ok: 4, paused: 9 }[status.state]
      if (status.state === 'ok' && (status.nextDue ?? Infinity) >= endOfDay) continue
      if (status.state === 'paused') continue
      list.push({ kind: 'med', key: `m${med.id}`, rank, id: med.id })
    }
    for (const habit of habits.active) {
      if (!isExpectedOn(habit, habits.counts.get(habit.id) ?? new Map(), habits.today, habits.today))
        continue
      const done = habits.isDoneOn(habit)
      list.push({ kind: 'habit', key: `h${habit.id}`, rank: done ? 8 : 2, id: habit.id, done })
    }
    for (const timer of timers.running)
      list.push({ kind: 'timer', key: `t${timer.id}`, rank: 6, id: timer.id })
    return list.sort((a, b) => a.rank - b.rank)
  })

  let pending = $derived(rows.filter((r) => !(r.kind === 'habit' && r.done)).length)
</script>

{#if rows.length === 0}
  <div class="empty">
    <span class="sun"><Icon name="sun" size={26} /></span>
    <strong>{t('home.today.clear')}</strong>
    <span class="faint">{t('home.today.clearHint')}</span>
    <div class="empty-actions">
      <button class="btn btn--pill" onclick={() => goTo('habits')}
        ><Icon name="target" size={14} />{t('habits.new')}</button
      >
      <button class="btn btn--pill" onclick={() => goTo('meds')}
        ><Icon name="pill" size={14} />{t('meds.add')}</button
      >
    </div>
  </div>
{:else}
  <p class="count faint">{t('home.today.pending', { count: pending })}</p>
  <ul class="rows">
    {#each rows as row (row.key)}
      <li animate:flip={{ duration: flipDuration() }}>
        {#if row.kind === 'med'}
          {@const med = meds.meds.find((m) => m.id === row.id)}
          {@const status = meds.statuses.get(row.id)}
          {#if med && status}
            <div class="row" class:row--alert={status.state === 'overdue' || status.state === 'due'}>
              <IconBadge
                name="pill"
                color={status.state === 'overdue' ? 'var(--danger)' : (med.color ?? 'var(--accent)')}
                size={34}
                round
              />
              <button class="text" onclick={() => goTo('meds')}>
                <strong class="truncate">{med.name}{med.dose ? ` · ${med.dose}` : ''}</strong>
                <span class="sub" class:sub--late={status.state === 'overdue'}>
                  {#if status.state === 'first'}{t('meds.state.first')}
                  {:else if status.state === 'due'}{t('meds.state.due')}
                  {:else if status.state === 'overdue'}{t('meds.state.overdue', {
                      span: formatSpan(status.remaining),
                    })}
                  {:else}{t('home.today.medAt', {
                      time: time(status.nextDue!),
                      span: formatSpan(status.remaining),
                    })}{/if}
                </span>
              </button>
              <button
                class="btn btn--pill btn--sm"
                class:btn--primary={status.state !== 'ok' && status.state !== 'soon'}
                onclick={() => void meds.requestTake(med.id)}
              >
                <Icon name="check" size={13} />{t('meds.taken')}
              </button>
            </div>
          {/if}
        {:else if row.kind === 'habit'}
          {@const habit = habits.habits.find((h) => h.id === row.id)}
          {#if habit}
            {@const count = habits.countOn(habit.id)}
            <div class="row" class:row--done={row.done}>
              <IconBadge name={habit.icon} color={habit.color ?? 'var(--accent)'} size={34} round />
              <button class="text" onclick={() => goTo('habits')}>
                <strong class="truncate">{habit.name}</strong>
                <span class="sub"
                  >{row.done
                    ? t('habits.done')
                    : habit.target > 1
                      ? `${count}/${habit.target}`
                      : t('home.today.habit')}</span
                >
              </button>
              <button
                class="check"
                class:check--done={row.done}
                style="--c: {habit.color ?? 'var(--accent)'}"
                aria-pressed={row.done}
                aria-label={row.done
                  ? t('habits.doneNamed', { name: habit.name })
                  : t('habits.checkNamed', { name: habit.name })}
                data-testid="home-habit-check"
                onclick={() => void habits.check(habit.id)}
              >
                <Icon name="check" size={16} />
              </button>
            </div>
          {/if}
        {:else}
          {@const timer = timers.running.find((x) => x.id === row.id)}
          {#if timer}
            {@const remaining =
              timer.firedAt > 0
                ? 0
                : timer.pausedRemaining !== null
                  ? timer.pausedRemaining
                  : Math.max(0, timer.endAt - now)}
            {@const color =
              timer.kind === 'pomodoro' ? PHASE_COLOR[timer.phase ?? 'focus'] : 'var(--accent)'}
            <div class="row">
              <IconBadge
                name={timer.firedAt > 0 ? 'bell-ring' : timer.kind === 'pomodoro' ? 'target' : 'timer'}
                {color}
                size={34}
                round
              />
              <button
                class="text"
                onclick={() =>
                  navigate({ kind: 'timers', tab: timer.kind === 'pomodoro' ? 'pomodoro' : 'alarms' })}
              >
                <strong class="truncate">{timer.label || t('timers.timer')}</strong>
                <span class="sub"
                  >{timer.pausedRemaining !== null
                    ? t('timers.paused')
                    : t('timers.endsAt', { time: time(timer.endAt) })}</span
                >
              </button>
              <span class="clock">{formatClock(remaining)}</span>
            </div>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .count {
    margin-top: calc(var(--space-2) * -1);
    font-size: var(--text-sm);
  }

  .rows {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2);
    border-radius: var(--radius);
    transition:
      background var(--dur-2),
      opacity var(--dur-3);
  }

  .row:hover {
    background: var(--surface-2);
  }

  .row--alert {
    background: color-mix(in oklab, var(--warn) 8%, transparent);
  }

  .row--done {
    opacity: 0.6;
  }

  .row--done strong {
    text-decoration: line-through;
    text-decoration-color: var(--text-faint);
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }

  .sub {
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .sub--late {
    color: var(--danger);
    font-weight: 600;
  }

  .btn--sm {
    height: 28px;
    padding: 0 var(--space-3);
    font-size: var(--text-md);
  }

  .check {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 2px solid color-mix(in oklab, var(--c) 55%, var(--border));
    border-radius: 50%;
    background: none;
    color: transparent;
    cursor: pointer;
    transition:
      background var(--dur-2),
      color var(--dur-2),
      transform var(--dur-2) var(--ease-spring);
  }

  .check:hover {
    color: var(--c);
  }

  .check:active {
    transform: scale(0.85);
  }

  .check--done {
    border-color: var(--c);
    background: var(--c);
    color: var(--bg);
    animation: enter-pop 360ms var(--ease-out);
  }

  .clock {
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-4) 0;
    text-align: center;
  }

  .sun {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    margin-bottom: var(--space-2);
    border-radius: 50%;
    background: color-mix(in oklab, var(--warn) 16%, transparent);
    color: var(--warn);
    animation: enter-pop 500ms var(--ease-out);
  }

  .empty-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
