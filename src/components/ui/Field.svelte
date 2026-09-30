<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    label: string
    hint?: string
    /** Id of the control, so clicking the label focuses it. */
    for?: string
    /** Stack the control under the label instead of beside it. */
    stacked?: boolean
    children: Snippet
  }

  let { label, hint, for: htmlFor, stacked = false, children }: Props = $props()
</script>

<div class="field" class:field--stacked={stacked}>
  <div class="text">
    <label class="label" for={htmlFor}>{label}</label>
    {#if hint}<p class="hint">{hint}</p>{/if}
  </div>
  <div class="control">
    {@render children()}
  </div>
</div>

<style>
  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: 36px;
  }

  .field--stacked {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .text {
    min-width: 0;
    flex: 1;
  }

  .hint {
    color: var(--text-faint);
    font-size: var(--text-sm);
    margin-top: 2px;
  }

  .control {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 60%;
  }

  .field--stacked .control {
    max-width: none;
  }

  @media (max-width: 560px) {
    .field {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-2);
    }

    .control {
      max-width: none;
    }
  }
</style>
