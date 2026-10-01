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
    index?: number
  }

  let { timer, now, color = null, index = 0 }: Props = $props()

  let paused = $derived(timer.pausedRemaining !== null)
  let ringing = $derived(timer.firedAt > 0)
  let remaining = $derived(
    ringing ? 0 : paused ? (timer.pausedRemaining ?? 0) : Math.max(0, timer.endAt - now),
  )
  let progress = $derived(timer.seconds > 0 ? 1 - remaining / (timer.seconds * 1000) : 1)
  let tone = $derived(ringing ? 'var(--danger)' : (color ?? 'var(--accent)'))
</script>

<article
  class="card surface enter"
  class:card--ringing={ringing}
  class:card--paused={paused}
  style="--i: {index}; --tone: {tone}"
  data-testid="running-timer"
>
  <header class="top">
    <strong class="label truncate">{timer.label || t('timers.timer')}</strong>
    <button
      class="close"
      aria-label={t('timers.cancel')}
      title={t('timers.cancel')}
      onclick={() => void timers.cancel(timer.id)}
    >
      <Icon name="x" size={14} />
    </button>
  </header>

  <div class="dial">
    <ProgressRing value={progress} size={132} stroke={8} color={tone}>
      <span class="clock-wrap">
        <span class="clock" data-testid="timer-clock">{ringing ? '0:00' : formatClock(remaining)}</span>
        <span class="state">
          {#if ringing}
            {t('timers.timesUp')}
          {:else if paused}
            {t('timers.paused')}
          {:else}
            <Icon name="bell" size={11} />
            {new Date(timer.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {/if}
        </span>
      </span>
    </ProgressRing>
  </div>

  <div class="controls">
    {#if ringing}
      <button class="btn btn--primary btn--pill" onclick={() => void timers.dismiss(timer.id)}
        >{t('timers.stop')}</button
      >
      <button class="btn btn--pill" onclick={() => void timers.snooze(timer.id, 5)}>+5 min</button>
    {:else}
      <button
        class="round"
        aria-label={t('timers.restart')}
        title={t('timers.restart')}
        onclick={() => void timers.restart(timer.id)}
      >
        <Icon name="restore" size={16} />
      </button>
      <button
        class="round round--main"
        aria-label={t(paused ? 'timers.resume' : 'timers.pause')}
        title={t(paused ? 'timers.resume' : 'timers.pause')}
        onclick={() => void (paused ? timers.resume(timer.id) : timers.pause(timer.id))}
      >
        <Icon name={paused ? 'play' : 'pause'} size={20} />
      </button>
      <button
        class="round round--text"
        aria-label={t('timers.addMinute')}
        onclick={() => void timers.addTime(timer.id, 60)}
      >
        +1
      </button>
    {/if}
  </div>
  {#if timer.repeat}
    <span class="repeat" title={t('timers.repeat')}><Icon name="refresh-cw" size={12} /></span>
  {/if}
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) var(--space-4);
    transition: opacity var(--dur-2);
  }

  .card--paused .dial {
    opacity: 0.7;
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

  .top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    align-self: stretch;
  }

  .label {
    flex: 1;
    font-weight: 600;
  }

  .close {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  .close:hover {
    background: var(--surface-3);
    color: var(--text);
  }

  .dial {
    transition: opacity var(--dur-2);
  }

  .clock-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .clock {
    font-size: var(--text-2xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .state {
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .round {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--text-dim);
    font-weight: 700;
    font-size: var(--text-md);
    cursor: pointer;
    transition:
      transform var(--dur-1) var(--ease-out),
      background var(--dur-1);
  }

  .round:hover {
    background: var(--surface-3);
    color: var(--text);
  }

  .round:active {
    transform: scale(0.9);
  }

  .round--main {
    width: 48px;
    height: 48px;
    border-color: transparent;
    background: var(--tone);
    color: var(--accent-contrast);
    box-shadow: 0 4px 14px color-mix(in oklab, var(--tone) 35%, transparent);
  }

  .round--main:hover {
    background: color-mix(in oklab, var(--tone) 88%, white);
    color: var(--accent-contrast);
  }

  .repeat {
    position: absolute;
    bottom: var(--space-3);
    inset-inline-start: var(--space-3);
    color: var(--text-faint);
  }
</style>
