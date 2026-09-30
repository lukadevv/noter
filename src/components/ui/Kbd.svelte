<script lang="ts">
  import { formatShortcut } from '$lib/ui/keys'

  interface Props {
    /** A shortcut in "Mod+Shift+K" form; Mod is ⌘ on Apple platforms, Ctrl elsewhere. */
    keys: string
  }

  let { keys }: Props = $props()
</script>

<kbd class="kbd">{formatShortcut(keys)}</kbd>

<style>
  .kbd {
    display: inline-flex;
    align-items: center;
    padding: 0 5px;
    min-width: 18px;
    height: 18px;
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: var(--radius-sm);
    font: 500 var(--text-xs) / 1 var(--font-ui);
    color: var(--text-dim);
    white-space: nowrap;
  }
</style>
