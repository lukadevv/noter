<script lang="ts">
  import { untrack } from 'svelte'
  import Dialog from '../ui/Dialog.svelte'
  import Segmented from '../ui/Segmented.svelte'
  import Stepper from '../ui/Stepper.svelte'
  import Icon from '../Icon.svelte'
  import { habits } from '$lib/habits/store.svelte'
  import type { Habit, HabitSchedule } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    habit: Habit | null
    onclose: () => void
  }

  let { habit, onclose }: Props = $props()

  const HABIT_ICONS = [
    'droplet',
    'dumbbell',
    'book-open',
    'footprints',
    'moon',
    'sun',
    'apple',
    'salad',
    'brain',
    'heart',
    'bike',
    'coffee',
    'leaf',
    'music',
    'pencil',
    'smile',
    'bed',
    'zap',
    'target',
    'trophy',
  ]
  const COLORS = ['#5cbf92', '#4fb3d9', '#8b8ce8', '#c27ad8', '#e06a5a', '#d9a441', '#e58c5a', '#7fa650']
  /** Monday first, as a week reads on a calendar here; values are Date.getDay(). */
  const WEEK = [1, 2, 3, 4, 5, 6, 0]
  const weekdayName = (d: number) => new Date(2026, 8, 27 + d).toLocaleDateString([], { weekday: 'narrow' }) // 27 Sep 2026 is a Sunday

  const initial = untrack(() => habit)
  let name = $state(initial?.name ?? '')
  let icon = $state(initial?.icon ?? 'droplet')
  let color = $state(initial?.color ?? COLORS[0]!)
  let kind = $state<HabitSchedule['kind']>(initial?.schedule.kind ?? 'daily')
  let days = $state<number[]>(
    initial?.schedule.kind === 'weekdays' ? [...initial.schedule.days] : [1, 2, 3, 4, 5],
  )
  let times = $state(initial?.schedule.kind === 'perWeek' ? initial.schedule.times : 3)
  let target = $state(initial?.target ?? 1)
  let remind = $state(initial?.reminderTime != null)
  let reminderTime = $state(initial?.reminderTime ?? '09:00')

  let valid = $derived(name.trim() !== '' && (kind !== 'weekdays' || days.length > 0))

  function toggleDay(day: number) {
    days = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
  }

  async function save() {
    if (!valid) return
    const schedule: HabitSchedule =
      kind === 'daily' ? { kind } : kind === 'weekdays' ? { kind, days: [...days].sort() } : { kind, times }
    await habits.save({
      id: initial?.id,
      name: name.trim(),
      icon,
      color,
      schedule,
      target,
      reminderTime: remind ? reminderTime : null,
    })
    onclose()
  }
</script>

<Dialog label={t(initial ? 'habits.edit' : 'habits.new')} icon="target" {onclose} testid="habit-dialog">
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault()
      void save()
    }}
  >
    <div class="name-row">
      <span class="preview" style="--c: {color}"><Icon name={icon} size={22} /></span>
      <label class="field grow">
        <span>{t('habits.name')}</span>
        <input
          class="input"
          data-autofocus
          data-testid="habit-name"
          bind:value={name}
          placeholder={t('habits.namePlaceholder')}
          maxlength="40"
        />
      </label>
    </div>

    <fieldset class="field">
      <legend>{t('habits.icon')}</legend>
      <div class="icons">
        {#each HABIT_ICONS as option (option)}
          <button
            type="button"
            class="icon-btn"
            class:icon-btn--active={icon === option}
            style="--c: {color}"
            aria-label={option}
            aria-pressed={icon === option}
            onclick={() => (icon = option)}
          >
            <Icon name={option} size={17} />
          </button>
        {/each}
      </div>
      <div class="swatches">
        {#each COLORS as swatch (swatch)}
          <button
            type="button"
            class="swatch"
            class:swatch--active={color === swatch}
            style="--c: {swatch}"
            aria-label={swatch}
            aria-pressed={color === swatch}
            onclick={() => (color = swatch)}
          ></button>
        {/each}
      </div>
    </fieldset>

    <div class="field">
      <span>{t('habits.when')}</span>
      <Segmented
        label={t('habits.when')}
        bind:value={kind}
        options={[
          { value: 'daily', label: t('habits.schedule.daily') },
          { value: 'weekdays', label: t('habits.schedule.weekdays') },
          { value: 'perWeek', label: t('habits.schedule.perWeek') },
        ]}
      />
      {#if kind === 'weekdays'}
        <div class="days">
          {#each WEEK as day (day)}
            <button
              type="button"
              class="day"
              class:day--on={days.includes(day)}
              aria-pressed={days.includes(day)}
              onclick={() => toggleDay(day)}>{weekdayName(day)}</button
            >
          {/each}
        </div>
      {:else if kind === 'perWeek'}
        <div class="inline">
          <Stepper label={t('habits.timesPerWeek')} min={1} max={7} bind:value={times} unit="×" />
          <span class="faint">{t('habits.timesPerWeek')}</span>
        </div>
      {/if}
    </div>

    <div class="field">
      <span>{t('habits.target')}</span>
      <div class="inline">
        <Stepper label={t('habits.target')} min={1} max={50} bind:value={target} unit="×" />
        <span class="faint">{t('habits.targetHint')}</span>
      </div>
    </div>

    <div class="field">
      <label class="check">
        <input type="checkbox" bind:checked={remind} />
        <span>{t('habits.remind')}</span>
      </label>
      {#if remind}
        <input class="input time" type="time" bind:value={reminderTime} aria-label={t('habits.remind')} />
      {/if}
    </div>

    <div class="actions">
      <button type="button" class="btn" onclick={onclose}>{t('common.cancel')}</button>
      <button type="submit" class="btn btn--primary" disabled={!valid} data-testid="habit-save"
        >{t('common.save')}</button
      >
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .field > span,
  legend {
    padding: 0;
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  legend {
    margin-bottom: var(--space-2);
  }

  .grow {
    flex: 1;
  }

  .name-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }

  .preview {
    display: grid;
    place-items: center;
    flex: none;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: color-mix(in oklab, var(--c) 18%, transparent);
    color: var(--c);
    transition:
      background var(--dur-2),
      color var(--dur-2);
  }

  .icons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
    gap: var(--space-1);
  }

  .icon-btn {
    display: grid;
    place-items: center;
    height: 36px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: var(--bg-2);
    color: var(--text-dim);
    cursor: pointer;
    transition:
      transform var(--dur-1),
      background var(--dur-1);
  }

  .icon-btn:hover {
    color: var(--text);
  }

  .icon-btn:active {
    transform: scale(0.9);
  }

  .icon-btn--active {
    border-color: var(--c);
    background: color-mix(in oklab, var(--c) 16%, transparent);
    color: var(--c);
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .swatch {
    width: 26px;
    height: 26px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--c);
    cursor: pointer;
    transition: transform var(--dur-2) var(--ease-spring);
  }

  .swatch--active {
    border-color: var(--text);
    transform: scale(1.15);
  }

  .days {
    display: flex;
    gap: var(--space-1);
  }

  .day {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: none;
    color: var(--text-dim);
    font-weight: 600;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      background var(--dur-2),
      transform var(--dur-1);
  }

  .day:active {
    transform: scale(0.9);
  }

  .day--on {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .inline {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
  }

  .check input {
    accent-color: var(--accent);
  }

  .time {
    width: 9rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
