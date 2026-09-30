<script lang="ts">
  interface Props {
    checked: boolean
    label: string
    /** Shown under the label. */
    hint?: string
    disabled?: boolean
    testid?: string
    onchange?: (checked: boolean) => void
  }

  let { checked = $bindable(), label, hint, disabled = false, testid, onchange }: Props = $props()
</script>

<label class="switch" class:switch--disabled={disabled}>
  <span class="text">
    <span class="label">{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </span>
  <input
    type="checkbox"
    role="switch"
    bind:checked
    {disabled}
    data-testid={testid}
    onchange={(e) => onchange?.(e.currentTarget.checked)}
  />
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
</label>

<style>
  .switch {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    cursor: pointer;
    min-height: 32px;
  }

  .switch--disabled {
    opacity: 0.55;
    cursor: default;
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .hint {
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }

  .track {
    flex: none;
    width: 36px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--surface-3);
    border: 1px solid var(--border-strong);
    padding: 2px;
    transition: background var(--dur-2) var(--ease-out);
  }

  .thumb {
    display: block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--text-dim);
    transition:
      transform var(--dur-2) var(--ease-out),
      background var(--dur-2);
  }

  input:checked + .track {
    background: var(--accent);
    border-color: var(--accent);
  }

  input:checked + .track .thumb {
    transform: translateX(16px);
    background: var(--accent-contrast);
  }

  :global([dir='rtl']) input:checked + .track .thumb {
    transform: translateX(-16px);
  }

  input:focus-visible + .track {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
