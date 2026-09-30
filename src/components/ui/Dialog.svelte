<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from '../Icon.svelte'
  import { portal, trapFocus } from '$lib/ui/portal'
  import { fadeIn, pop } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    /** Accessible name, also shown as the heading unless `head` is given. */
    label: string
    onclose: () => void
    size?: 'sm' | 'md' | 'lg'
    icon?: string
    testid?: string
    /** Drop the body padding, for content that lays out its own. */
    flush?: boolean
    /** Replaces the default heading row. */
    head?: Snippet
    foot?: Snippet
    children: Snippet
  }

  let { label, onclose, size = 'md', icon, testid, flush = false, head, foot, children }: Props = $props()

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    // Handled here so a parent dialog or the app shell does not also react.
    event.stopPropagation()
    onclose()
  }
</script>

<div use:portal>
  <div class="ui-backdrop" role="presentation" transition:fadeIn onpointerdown={onclose}></div>
  <div
    class="ui-dialog ui-dialog--{size}"
    role="dialog"
    aria-modal="true"
    aria-label={label}
    data-testid={testid}
    tabindex="-1"
    use:trapFocus
    onkeydown={onKeydown}
    transition:pop
  >
    {#if head}
      {@render head()}
    {:else}
      <header class="ui-dialog__head">
        {#if icon}<Icon name={icon} size={16} />{/if}
        <span class="ui-dialog__title truncate">{label}</span>
        <button class="btn btn--ghost btn--icon" aria-label={t('common.close')} onclick={onclose}>
          <Icon name="x" size={15} />
        </button>
      </header>
    {/if}
    <div class="ui-dialog__body" class:ui-dialog__body--flush={flush}>
      {@render children()}
    </div>
    {#if foot}
      <footer class="ui-dialog__foot">
        {@render foot()}
      </footer>
    {/if}
  </div>
</div>
