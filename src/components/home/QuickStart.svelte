<script lang="ts">
  import Icon from '../Icon.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { formatClock, formatLength } from '$lib/timers/duration'
  import { PHASE_COLOR } from '$lib/timers/pomodoro'
  import { navigate } from '../../routes/router'
  import { press } from '$lib/ui/press'
  import { dayKey } from '$lib/utils/dates'
  import { t } from '$lib/i18n/index.svelte'

  /** One tap to focus or to start a saved timer, plus how much focus today holds. */
  interface Props {
    now: number
  }

  let { now }: Props = $props()

  let pomodoro = $derived(timers.pomodoro)
  let remaining = $derived(
    !pomodoro
      ? 0
      : pomodoro.firedAt > 0
        ? 0
        : pomodoro.pausedRemaining !== null
          ? pomodoro.pausedRemaining
          : Math.max(0, pomodoro.endAt - now),
  )
  let today = $derived(timers.focusByDay.get(dayKey()) ?? 0)
  let week = $derived(timers.focusSeries(7))
  let max = $derived(Math.max(1, ...week))

  async function focus() {
    if (!pomodoro) await timers.startPomodoro()
    navigate({ kind: 'timers', tab: 'pomodoro' })
  }
</script>

<button
  class="focus"
  style="--c: {PHASE_COLOR[pomodoro?.phase ?? 'focus']}"
  data-testid="home-focus"
  use:press
  onclick={() => void focus()}
>
  <span class="focus-icon"><Icon name={pomodoro ? 'target' : 'play'} size={18} /></span>
  <span class="focus-text">
    {#if pomodoro}
      <strong>{t(`pomodoro.phase.${pomodoro.phase ?? 'focus'}`)} · {formatClock(remaining)}</strong>
      <span>{pomodoro.pausedRemaining !== null ? t('timers.paused') : t('home.focus.running')}</span>
    {:else}
      <strong>{t('home.focus.start')}</strong>
      <span>{t('home.focus.minutes', { count: today })}</span>
    {/if}
  </span>
  {#if week.some((v) => v > 0)}<span class="spark" aria-hidden="true">
      {#each week as v, i (i)}
        <span class="bar" style="height: {Math.max(8, (v / max) * 100)}%" class:bar--today={i === 6}></span>
      {/each}
    </span>{/if}
</button>

{#if timers.presets.length > 0}
  <div class="presets">
    {#each timers.presets.slice(0, 6) as preset (preset.id)}
      <button
        class="preset"
        style={preset.color ? `--p: ${preset.color}` : ''}
        title={preset.label}
        data-testid="home-preset"
        use:press
        onclick={() => void timers.startPreset(preset)}
      >
        <span class="len">{formatLength(preset.seconds)}</span>
        <span class="lbl truncate">{preset.label}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .focus {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3);
    overflow: hidden;
    border: 1px solid color-mix(in oklab, var(--c) 35%, var(--border));
    border-radius: var(--radius-lg);
    background: linear-gradient(135deg, color-mix(in oklab, var(--c) 16%, var(--surface)), var(--surface));
    color: var(--text);
    text-align: start;
    cursor: pointer;
    transition:
      transform var(--dur-1) var(--ease-out),
      border-color var(--dur-2);
  }

  .focus:hover {
    border-color: var(--c);
  }

  .focus:active {
    transform: scale(0.98);
  }

  .focus-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--c);
    color: #fff;
    box-shadow: 0 4px 14px color-mix(in oklab, var(--c) 40%, transparent);
  }

  .focus-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .focus-text span {
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .spark {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 28px;
  }

  .bar {
    width: 5px;
    border-radius: 2px;
    background: color-mix(in oklab, var(--c) 40%, var(--surface-3));
  }

  .bar--today {
    background: var(--c);
  }

  .presets {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .preset {
    --p: var(--accent);
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: var(--space-2) var(--space-3);
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
    color: var(--text);
    cursor: pointer;
    transition:
      transform var(--dur-1) var(--ease-out),
      border-color var(--dur-2);
  }

  .preset::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 2px;
    background: var(--p);
    opacity: 0.8;
  }

  .preset:hover {
    border-color: var(--p);
  }

  .preset:active {
    transform: scale(0.95);
  }

  .len {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .lbl {
    max-width: 100%;
    color: var(--text-faint);
    font-size: var(--text-xs);
  }
</style>
