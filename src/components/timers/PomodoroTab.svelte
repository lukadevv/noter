<script lang="ts">
  import Icon from '../Icon.svelte'
  import ProgressRing from '../ui/ProgressRing.svelte'
  import StatTile from '../ui/StatTile.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { formatClock } from '$lib/timers/duration'
  import { PHASE_COLOR, phaseMinutes } from '$lib/timers/pomodoro'
  import { theme } from '$lib/stores/theme.svelte'
  import { openSettings } from '$lib/nav'
  import { press } from '$lib/ui/press'
  import type { PomodoroPhase } from '$lib/db/schema'
  import { dayKey } from '$lib/utils/dates'
  import { t } from '$lib/i18n/index.svelte'

  timers.start()

  let settings = $derived(theme.settings.pomodoro)
  let current = $derived(timers.pomodoro)
  /** The phase picked while nothing is running. */
  let chosen = $state<PomodoroPhase>('focus')
  let phase = $derived(current?.phase ?? chosen)
  let cycle = $derived(current?.cycle ?? 0)
  let now = $state(Date.now())

  let paused = $derived(current ? current.pausedRemaining !== null : true)
  let ringing = $derived((current?.firedAt ?? 0) > 0)
  let total = $derived(current ? current.seconds * 1000 : phaseMinutes(chosen, settings) * 60_000)
  let remaining = $derived(
    !current
      ? total
      : ringing
        ? 0
        : current.pausedRemaining !== null
          ? current.pausedRemaining
          : Math.max(0, current.endAt - now),
  )
  let progress = $derived(total > 0 ? 1 - remaining / total : 0)
  let color = $derived(PHASE_COLOR[phase])

  $effect(() => {
    if (!current || paused) return
    const id = setInterval(() => (now = Date.now()), 250)
    return () => clearInterval(id)
  })

  // Ticks the title too, so the countdown shows in the tab strip.
  $effect(() => {
    if (!current || paused) return
    const before = document.title
    document.title = `${formatClock(remaining)} · ${t(`pomodoro.phase.${phase}`)}`
    return () => {
      document.title = before
    }
  })

  function toggle() {
    if (!current) void timers.startPomodoro({ phase: chosen, cycle: 0 })
    else if (ringing) void timers.dismiss(current.id)
    else if (paused) void timers.resume(current.id)
    else void timers.pause(current.id)
  }

  function pick(next: PomodoroPhase) {
    if (current) void timers.startPomodoro({ phase: next, cycle: current.cycle ?? 0 }, false)
    else chosen = next
  }

  let week = $derived(timers.focusSeries(7))
  let today = $derived(timers.focusByDay.get(dayKey()) ?? 0)
  let sessionsToday = $derived(timers.focus.filter((s) => s.day === dayKey()).length)
  let weekTotal = $derived(week.reduce((a, b) => a + b, 0))

  const PHASES: PomodoroPhase[] = ['focus', 'short', 'long']
  const days = (i: number) =>
    new Date(Date.now() - (6 - i) * 86_400_000).toLocaleDateString([], { weekday: 'short' })
</script>

<div class="pomodoro" style="--phase: {color}">
  <section class="stage surface enter" data-testid="pomodoro">
    <div class="phases" role="radiogroup" aria-label={t('pomodoro.title')}>
      {#each PHASES as p (p)}
        <button
          type="button"
          role="radio"
          aria-checked={phase === p}
          class="phase"
          class:phase--active={phase === p}
          style="--c: {PHASE_COLOR[p]}"
          onclick={() => pick(p)}
        >
          {t(`pomodoro.phase.${p}`)}
        </button>
      {/each}
    </div>

    <div class="dial" class:dial--running={current && !paused}>
      <ProgressRing value={progress} size={248} stroke={10} {color}>
        <span class="center">
          <span class="clock" data-testid="pomodoro-clock">{formatClock(remaining)}</span>
          <span class="sub">
            {#if ringing}
              {t('timers.timesUp')}
            {:else if current && paused}
              {t('timers.paused')}
            {:else}
              {t('pomodoro.session', {
                n: Math.min(cycle + 1, settings.longEvery),
                total: settings.longEvery,
              })}
            {/if}
          </span>
        </span>
      </ProgressRing>
    </div>

    <div class="dots" aria-hidden="true">
      {#each Array.from({ length: settings.longEvery }) as _, i (i)}
        <span class="dot" class:dot--done={i < cycle} class:dot--now={i === cycle && phase === 'focus'}
        ></span>
      {/each}
    </div>

    <div class="controls">
      <button
        class="round"
        aria-label={t('pomodoro.reset')}
        title={t('pomodoro.reset')}
        disabled={!current}
        onclick={() => void timers.resetPomodoro()}
      >
        <Icon name="restore" size={18} />
      </button>
      <button class="round round--main" data-testid="pomodoro-toggle" use:press onclick={toggle}>
        <Icon name={current && !paused && !ringing ? 'pause' : 'play'} size={26} />
        <span class="sr-only">{current && !paused ? t('timers.pause') : t('timers.start')}</span>
      </button>
      <button
        class="round"
        aria-label={t('pomodoro.skip')}
        title={t('pomodoro.skip')}
        disabled={!current}
        onclick={() => void timers.skipPomodoro()}
      >
        <Icon name="skip-forward" size={18} />
      </button>
    </div>

    <button class="btn btn--ghost settings-link" onclick={() => openSettings('timers')}>
      <Icon name="settings" size={14} />
      {t('pomodoro.lengths', {
        focus: settings.focusMinutes,
        short: settings.shortMinutes,
        long: settings.longMinutes,
      })}
    </button>
  </section>

  <div class="stats">
    <StatTile
      label={t('pomodoro.today')}
      icon="target"
      value={today}
      format={(v) => `${Math.round(v)} min`}
      note={t('pomodoro.sessions', { count: sessionsToday })}
      tone="var(--danger)"
      index={1}
    />
    <StatTile
      label={t('pomodoro.week')}
      icon="flame"
      value={weekTotal}
      format={(v) => `${Math.round(v)} min`}
      series={week}
      describe={(v, i) => `${days(i)} · ${v} min`}
      tone="var(--warn)"
      index={2}
    />
  </div>
</div>

<style>
  .pomodoro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
    gap: var(--space-4);
    align-items: start;
  }

  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-4);
    background:
      radial-gradient(
        ellipse at 50% 40%,
        color-mix(in oklab, var(--phase) 10%, transparent),
        transparent 65%
      ),
      var(--surface);
    transition: background var(--dur-3);
  }

  .phases {
    display: flex;
    gap: var(--space-1);
    padding: 3px;
    border-radius: var(--radius-full);
    background: var(--bg-2);
  }

  .phase {
    height: 30px;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--text-dim);
    font-weight: 550;
    cursor: pointer;
    transition:
      background var(--dur-2),
      color var(--dur-2);
  }

  .phase--active {
    background: color-mix(in oklab, var(--c) 20%, transparent);
    color: var(--text);
  }

  .dial {
    transition: transform var(--dur-3) var(--ease-spring);
  }

  .dial--running {
    animation: breathe 4s var(--ease-in-out) infinite;
  }

  @keyframes breathe {
    50% {
      transform: scale(1.015);
    }
  }

  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }

  .clock {
    font-size: 56px;
    font-weight: 750;
    letter-spacing: -0.03em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .sub {
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  .dots {
    display: flex;
    gap: var(--space-2);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--surface-3);
    transition:
      background var(--dur-3),
      transform var(--dur-3) var(--ease-spring);
  }

  .dot--done {
    background: var(--danger);
  }

  .dot--now {
    background: color-mix(in oklab, var(--danger) 45%, var(--surface-3));
    transform: scale(1.25);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .round {
    position: relative;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--text-dim);
    cursor: pointer;
    transition:
      transform var(--dur-1) var(--ease-out),
      background var(--dur-1),
      opacity var(--dur-2);
  }

  .round:hover:not(:disabled) {
    background: var(--surface-3);
    color: var(--text);
  }

  .round:active:not(:disabled) {
    transform: scale(0.9);
  }

  .round:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .round--main {
    width: 76px;
    height: 76px;
    border: 0;
    background: var(--phase);
    color: #fff;
    box-shadow: 0 8px 24px color-mix(in oklab, var(--phase) 40%, transparent);
  }

  .round--main:hover:not(:disabled) {
    background: color-mix(in oklab, var(--phase) 88%, white);
    color: #fff;
  }

  .settings-link {
    font-size: var(--text-sm);
  }

  .stats {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  @media (max-width: 760px) {
    .pomodoro {
      grid-template-columns: 1fr;
    }

    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .clock {
      font-size: 46px;
    }
  }
</style>
