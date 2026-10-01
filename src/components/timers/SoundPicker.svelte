<script lang="ts">
  import Icon from '../Icon.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { alarm, BUILTIN_SOUNDS } from '$lib/audio/beeps'
  import { theme } from '$lib/stores/theme.svelte'
  import type { SoundRecipe } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  /**
   * Every alarm sound as a card you can hear before choosing: ▶ plays it once
   * (the bars dance while it sounds), a tap on the card picks it.
   */
  interface Props {
    value: string
    label: string
    onchange?: (id: string) => void
  }

  let { value = $bindable(), label, onchange }: Props = $props()

  let options = $derived([
    ...BUILTIN_SOUNDS.map((s) => ({ id: s.id, name: t(s.label), recipe: s.recipe })),
    ...timers.sounds.map((s) => ({ id: s.id, name: s.name, recipe: s.recipe })),
  ])

  let playing = $state<string | null>(null)
  let stopTimer: ReturnType<typeof setTimeout> | undefined

  function play(id: string, recipe: SoundRecipe) {
    clearTimeout(stopTimer)
    playing = id
    const ms = alarm.preview(recipe, theme.settings.timers.volume)
    stopTimer = setTimeout(() => (playing = null), ms)
  }

  function choose(id: string, recipe: SoundRecipe) {
    value = id
    onchange?.(id)
    play(id, recipe)
  }

  /** The melody as bar heights: its shape at a glance. */
  function bars(recipe: SoundRecipe): number[] {
    const pitched = recipe.notes.filter((n) => n > 0)
    const lo = Math.min(...pitched)
    const hi = Math.max(...pitched)
    return recipe.notes
      .slice(0, 8)
      .map((n) => (n <= 0 ? 0.12 : hi === lo ? 0.6 : 0.3 + (0.7 * (n - lo)) / (hi - lo)))
  }

  $effect(() => () => clearTimeout(stopTimer))
</script>

<div class="picker" role="radiogroup" aria-label={label} data-testid="sound-picker">
  {#each options as option (option.id)}
    {@const selected = option.id === value}
    <div class="option" class:option--selected={selected} class:option--playing={playing === option.id}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        class="pick"
        data-sound={option.id}
        onclick={() => choose(option.id, option.recipe)}
      >
        <span class="bars" aria-hidden="true">
          {#each bars(option.recipe) as h, i (i)}
            <span class="bar" style="--h: {h}; --d: {i * 70}ms"></span>
          {/each}
        </span>
        <span class="name">{option.name}</span>
        {#if selected}<span class="check"><Icon name="check" size={12} /></span>{/if}
      </button>
      <button
        type="button"
        class="play"
        aria-label={t('timers.previewNamed', { name: option.name })}
        title={t('timers.preview')}
        onclick={() => play(option.id, option.recipe)}
      >
        <Icon name={playing === option.id ? 'volume-2' : 'play'} size={13} />
      </button>
    </div>
  {/each}
</div>

<style>
  .picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: var(--space-2);
  }

  .option {
    position: relative;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
    transition:
      border-color var(--dur-2),
      background var(--dur-2),
      transform var(--dur-1);
  }

  .option:hover {
    border-color: var(--border-strong);
  }

  .option:active {
    transform: scale(0.98);
  }

  .option--selected {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .pick {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    padding-inline-end: 40px;
    border: 0;
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }

  /* Two lines before cutting: sound names run long in German or Portuguese. */
  .name {
    display: -webkit-box;
    max-width: 100%;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    line-height: 1.25;
    font-size: var(--text-md);
    font-weight: 550;
  }

  .bars {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 18px;
  }

  .bar {
    width: 4px;
    height: calc(var(--h) * 100%);
    border-radius: 2px;
    background: var(--text-faint);
    transform-origin: bottom;
    transition: background var(--dur-2);
  }

  .option--selected .bar {
    background: var(--accent);
  }

  .option--playing .bar {
    background: var(--accent);
    animation: dance 420ms var(--ease-in-out) var(--d) infinite alternate;
  }

  @keyframes dance {
    to {
      transform: scaleY(0.35);
    }
  }

  .check {
    position: absolute;
    top: 6px;
    inset-inline-end: 40px;
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-contrast);
    animation: enter-pop 300ms var(--ease-out);
  }

  .play {
    position: absolute;
    top: 50%;
    inset-inline-end: 8px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    transform: translateY(-50%);
    border: 0;
    border-radius: 50%;
    background: var(--surface-3);
    color: var(--text);
    cursor: pointer;
    transition:
      background var(--dur-1),
      transform var(--dur-1);
  }

  .play:hover {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .play:active {
    transform: translateY(-50%) scale(0.88);
  }
</style>
