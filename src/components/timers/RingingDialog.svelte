<script lang="ts">
  import Icon from '../Icon.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { alarm } from '$lib/audio/beeps'
  import { portal } from '$lib/ui/portal'
  import { fadeIn, pop } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  /**
   * The "time's up" card, on top of whatever section is open. A ringing timer
   * must be impossible to miss and quick to silence; it stays until dismissed,
   * even after the sound has stopped on its own.
   */
  let first = $derived(timers.ringing[0] ?? null)
</script>

{#if first}
  <div use:portal>
    <div class="backdrop" transition:fadeIn></div>
    <div
      class="alarm"
      role="alertdialog"
      aria-live="assertive"
      aria-label={t('timers.timesUp')}
      transition:pop
      data-testid="ringing"
    >
      <div class="icon"><Icon name="alarm-clock" size={34} /></div>
      <h2>{t('timers.timesUp')}</h2>
      <p class="label">{first.label || t('timers.timer')}</p>
      {#if timers.ringing.length > 1}
        <p class="faint">{t('timers.moreRinging', { count: timers.ringing.length - 1 })}</p>
      {/if}
      <div class="actions">
        <button class="btn btn--primary big" data-autofocus onclick={() => void timers.dismiss(first.id)}>
          {first.repeat ? t('timers.stopAndRepeat') : t('timers.stop')}
        </button>
        <div class="snooze">
          <button class="btn" onclick={() => void timers.snooze(first.id, 1)}>+1 min</button>
          <button class="btn" onclick={() => void timers.snooze(first.id, 5)}>+5 min</button>
          <button class="btn btn--ghost" onclick={() => alarm.stop(first.id)}>
            <Icon name="volume-x" size={14} />{t('timers.silence')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-toast);
    background: var(--overlay);
  }

  .alarm {
    position: fixed;
    inset: 0;
    z-index: var(--z-toast);
    margin: auto;
    width: min(92vw, 24rem);
    height: fit-content;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-5);
    border: 1px solid var(--danger);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-3);
    text-align: center;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--danger-soft);
    color: var(--danger);
    animation: shake 0.9s var(--ease-in-out) infinite;
  }

  @keyframes shake {
    0%,
    100% {
      transform: rotate(0);
    }
    20% {
      transform: rotate(-12deg);
    }
    40% {
      transform: rotate(10deg);
    }
    60% {
      transform: rotate(-6deg);
    }
    80% {
      transform: rotate(4deg);
    }
  }

  h2 {
    font-size: var(--text-2xl);
  }

  .label {
    font-size: var(--text-lg);
    color: var(--text-dim);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
    margin-top: var(--space-3);
  }

  .big {
    height: 44px;
    font-size: var(--text-lg);
  }

  .snooze {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
    flex-wrap: wrap;
  }
</style>
