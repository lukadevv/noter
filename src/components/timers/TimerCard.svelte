<script lang="ts">
  import Icon from '../Icon.svelte'
  import ProgressRing from '../ui/ProgressRing.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { formatClock } from '$lib/timers/duration'
  import type { RunningTimer } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    timer: RunningTimer
    now: number
    color?: string | null
  }

  let { timer, now, color = null }: Props = $props()

  let paused = $derived(timer.pausedRemaining !== null)
  let ringing = $derived(timer.firedAt > 0)
  let remaining = $derived(
    ringing ? 0 : paused ? (timer.pausedRemaining ?? 0) : Math.max(0, timer.endAt - now),
  )
  let progress = $derived(timer.seconds > 0 ? 1 - remaining / (timer.seconds * 1000) : 1)
</script>

<article class="card" class:card--ringing={ringing} class:card--paused={paused} data-testid="running-timer">
  <ProgressRing
    value={progress}
    size={76}
    stroke={6}
    color={ringing ? 'var(--danger)' : (color ?? 'var(--accent)')}
  >
    <span class="clock" data-testid="timer-clock">{ringing ? '0:00' : formatClock(remaining)}</span>
  </ProgressRing>

  <div class="info">
    <strong class="label truncate">{timer.label || t('timers.timer')}</strong>
    <span class="state faint">
      {#if ringing}
        {t('timers.timesUp')}
      {:else if paused}
        {t('timers.paused')}
      {:else}
        {t('timers.endsAt', {
          time: new Date(timer.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })}
      {/if}
      {#if timer.repeat}<Icon name="refresh-cw" size={12} />{/if}
    </span>
  </div>

  <div class="controls">
    {#if ringing}
      <button class="btn btn--primary" onclick={() => void timers.dismiss(timer.id)}
        >{t('timers.stop')}</button
      >
      <button class="btn" onclick={() => void timers.snooze(timer.id, 5)}>+5 min</button>
    {:else}
      <button
        class="btn btn--icon"
        aria-label={t(paused ? 'timers.resume' : 'timers.pause')}
        title={t(paused ? 'timers.resume' : 'timers.pause')}
        onclick={() => void (paused ? timers.resume(timer.id) : timers.pause(timer.id))}
      >
        <Icon name={paused ? 'play' : 'pause'} size={16} />
      </button>
      <button
        class="btn"
        aria-label={t('timers.addMinute')}
        onclick={() => void timers.addTime(timer.id, 60)}
      >
        +1 min
      </button>
      <button
        class="btn btn--icon"
        aria-label={t('timers.restart')}
        title={t('timers.restart')}
        onclick={() => void timers.restart(timer.id)}
      >
        <Icon name="restore" size={15} />
      </button>
    {/if}
    <button
      class="btn btn--ghost btn--icon"
      aria-label={t('timers.cancel')}
      title={t('timers.cancel')}
      onclick={() => void timers.cancel(timer.id)}
    >
      <Icon name="x" size={15} />
    </button>
  </div>
</article>

<style>
  .card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .card--paused {
    opacity: 0.8;
  }

  .card--ringing {
    border-color: var(--danger);
    animation: ring 1s var(--ease-in-out) infinite;
  }

  @keyframes ring {
    50% {
      box-shadow: 0 0 0 6px var(--danger-soft);
    }
  }

  .clock {
    font-size: var(--text-lg);
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font-size: var(--text-lg);
  }

  .state {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-md);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  @media (max-width: 560px) {
    .card {
      flex-wrap: wrap;
    }

    .controls {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
