<script lang="ts">
  import Icon from '../Icon.svelte'

  interface Props {
    value: number
    min?: number
    max?: number
    step?: number
    label: string
    /** Shown after the number, e.g. "min". */
    unit?: string
    testid?: string
    onchange?: (value: number) => void
  }

  let { value = $bindable(), min = 0, max = 999, step = 1, label, unit, testid, onchange }: Props = $props()

  function set(next: number) {
    value = Math.min(max, Math.max(min, Number.isFinite(next) ? next : min))
    onchange?.(value)
  }
</script>

<div class="stepper" role="group" aria-label={label} data-testid={testid}>
  <button
    type="button"
    class="step"
    aria-label="−"
    disabled={value <= min}
    onclick={() => set(value - step)}
  >
    <Icon name="minus" size={14} />
  </button>
  <label class="value">
    <span class="sr-only">{label}</span>
    <input
      type="number"
      inputmode="numeric"
      {min}
      {max}
      {step}
      {value}
      onchange={(e) => set(Number(e.currentTarget.value))}
    />
    {#if unit}<span class="unit">{unit}</span>{/if}
  </label>
  <button
    type="button"
    class="step"
    aria-label="+"
    disabled={value >= max}
    onclick={() => set(value + step)}
  >
    <Icon name="plus" size={14} />
  </button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    background: var(--bg-2);
  }

  .step {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--text-dim);
    cursor: pointer;
    transition:
      background var(--dur-1),
      transform var(--dur-1);
  }

  .step:hover:not(:disabled) {
    background: var(--surface-3);
    color: var(--text);
  }

  .step:active:not(:disabled) {
    transform: scale(0.88);
  }

  .step:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .value {
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  input {
    width: 3.2ch;
    border: 0;
    background: none;
    text-align: center;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input:focus {
    outline: none;
  }

  .unit {
    padding-inline-end: var(--space-1);
    color: var(--text-faint);
    font-size: var(--text-sm);
  }
</style>
