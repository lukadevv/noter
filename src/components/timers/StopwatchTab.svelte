<script lang="ts">
  import { flip } from 'svelte/animate'
  import Icon from '../Icon.svelte'
  import { stopwatch } from '$lib/timers/stopwatch.svelte'
  import { elapsed, extremes, formatStopwatch, laps } from '$lib/timers/stopwatch'
  import { flipDuration, rise } from '$lib/ui/motion.svelte'
  import { press } from '$lib/ui/press'
  import { t } from '$lib/i18n/index.svelte'

  stopwatch.start()

  let now = $state(Date.now())

  // Hundredths need every frame, but only while it runs.
  $effect(() => {
    if (!stopwatch.running) return
    let frame = requestAnimationFrame(function tick() {
      now = Date.now()
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  })

  let time = $derived(elapsed(stopwatch.watch, stopwatch.running ? now : 0))
  let list = $derived(laps(stopwatch.watch))
  let marks = $derived(extremes(list))
  let started = $derived(time > 0)
  /** The lap in progress, since the last lap press. */
  let current = $derived(time - (stopwatch.watch.laps.at(-1) ?? 0))
  let text = $derived(formatStopwatch(time))
  let [main, fraction] = $derived(text.split('.') as [string, string])

  function onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, [contenteditable="true"]')) return
    if (event.code === 'Space') {
      event.preventDefault()
      void (stopwatch.running ? stopwatch.pause() : stopwatch.play())
    } else if (event.key.toLowerCase() === 'l') {
      void stopwatch.lap()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="stopwatch">
  <section class="stage surface enter" data-testid="stopwatch">
    <div class="display" class:display--running={stopwatch.running}>
      <span class="main" data-testid="stopwatch-time">{main}</span><span class="fraction">.{fraction}</span>
    </div>
    {#if list.length > 0}
      <p class="current">{t('stopwatch.lap', { n: list.length + 1 })} · {formatStopwatch(current)}</p>
    {:else}
      <p class="current faint">{t('stopwatch.hint')}</p>
    {/if}

    <div class="controls">
      <button
        class="round"
        disabled={!started}
        data-testid="stopwatch-secondary"
        onclick={() => void (stopwatch.running ? stopwatch.lap() : stopwatch.reset())}
      >
        <Icon name={stopwatch.running ? 'flag' : 'restore'} size={18} />
        <span>{stopwatch.running ? t('stopwatch.lapAction') : t('stopwatch.reset')}</span>
      </button>
      <button
        class="round round--main"
        class:round--stop={stopwatch.running}
        data-testid="stopwatch-toggle"
        use:press
        onclick={() => void (stopwatch.running ? stopwatch.pause() : stopwatch.play())}
      >
        <Icon name={stopwatch.running ? 'pause' : 'play'} size={26} />
        <span class="sr-only">{stopwatch.running ? t('timers.pause') : t('timers.start')}</span>
      </button>
    </div>
  </section>

  {#if list.length > 0}
    <section
      class="laps surface enter"
      style="--i: 1"
      data-testid="stopwatch-laps"
      aria-label={t('stopwatch.laps')}
    >
      <header class="laps-head">
        <span>{t('stopwatch.laps')}</span>
        <span>{t('stopwatch.split')}</span>
        <span>{t('stopwatch.total')}</span>
      </header>
      <ol>
        {#each list as lap (lap.number)}
          <li
            class:best={marks?.best === lap.number}
            class:worst={marks?.worst === lap.number}
            animate:flip={{ duration: flipDuration() }}
            in:rise={{ y: -6 }}
          >
            <span class="n">
              {t('stopwatch.lap', { n: lap.number })}
              {#if marks?.best === lap.number}<span class="tag tag--best">{t('stopwatch.best')}</span>{/if}
              {#if marks?.worst === lap.number}<span class="tag tag--worst">{t('stopwatch.worst')}</span
                >{/if}
            </span>
            <span class="num">{formatStopwatch(lap.split)}</span>
            <span class="num faint">{formatStopwatch(lap.total)}</span>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</div>

<style>
  .stopwatch {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-4) var(--space-5);
  }

  .display {
    display: flex;
    align-items: baseline;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    transition: color var(--dur-3);
    color: var(--text-dim);
  }

  .display--running {
    color: var(--text);
  }

  .main {
    font-size: clamp(48px, 11vw, 88px);
    font-weight: 750;
    line-height: 1;
  }

  .fraction {
    font-size: clamp(26px, 5vw, 40px);
    font-weight: 600;
    color: var(--text-faint);
  }

  .current {
    font-variant-numeric: tabular-nums;
    color: var(--text-dim);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    margin-top: var(--space-3);
  }

  .round {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 64px;
    height: 64px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: var(--text-xs);
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
    width: 80px;
    height: 80px;
    border: 0;
    background: var(--ok);
    color: #06140e;
    box-shadow: 0 8px 24px color-mix(in oklab, var(--ok) 35%, transparent);
  }

  .round--main:hover:not(:disabled) {
    background: color-mix(in oklab, var(--ok) 88%, white);
    color: #06140e;
  }

  .round--stop {
    background: var(--warn);
    box-shadow: 0 8px 24px color-mix(in oklab, var(--warn) 35%, transparent);
  }

  .round--stop:hover:not(:disabled) {
    background: color-mix(in oklab, var(--warn) 88%, white);
  }

  .laps {
    padding: var(--space-2) var(--space-4) var(--space-3);
  }

  .laps-head,
  li {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) 1fr 1fr;
    align-items: center;
    gap: var(--space-3);
  }

  .laps-head {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .laps-head span:not(:first-child),
  .num {
    text-align: end;
  }

  ol {
    list-style: none;
    max-height: 22rem;
    overflow-y: auto;
  }

  li {
    padding: var(--space-2) 0;
    border-bottom: 1px solid color-mix(in oklab, var(--border) 50%, transparent);
  }

  .n {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  .best .num:first-of-type {
    color: var(--ok);
  }

  .worst .num:first-of-type {
    color: var(--danger);
  }

  .tag {
    padding: 0 6px;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  .tag--best {
    background: var(--ok-soft);
    color: var(--ok);
  }

  .tag--worst {
    background: var(--danger-soft);
    color: var(--danger);
  }
</style>
