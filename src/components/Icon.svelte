<script lang="ts">
  import { resolveIcon } from '$lib/icons/registry'
  import { cachedIcon, catalogLoaded, iconToSvg, loadCatalog } from '$lib/icons/dynamic'
  import type { IconRef } from '$lib/db/schema'

  interface Props {
    /** Either an IconRef ('lucide:folder' | 'emoji:📁') or a bare Lucide name. */
    name: IconRef | string
    size?: number
    strokeWidth?: number
    class?: string
  }

  let { name, size = 16, strokeWidth = 1.75, class: className = '' }: Props = $props()

  /** Bumped when the catalogue finishes loading, to re-run the lookup. */
  let catalogVersion = $state(0)

  let parsed = $derived.by(() => {
    if (name.startsWith('emoji:')) return { kind: 'emoji' as const, value: name.slice(6) }
    const bare = name.startsWith('lucide:') ? name.slice(7) : name
    return { kind: 'lucide' as const, value: bare }
  })

  let Component = $derived(parsed.kind === 'lucide' ? resolveIcon(parsed.value) : null)

  // Icons outside the built-in set (a folder icon picked from the full
  // catalogue) are rendered from the lazily loaded icon data instead.
  let svg = $derived.by(() => {
    void catalogVersion
    if (parsed.kind !== 'lucide' || Component) return null
    const node = cachedIcon(parsed.value)
    return node ? iconToSvg(node, size, strokeWidth) : null
  })

  $effect(() => {
    if (parsed.kind === 'lucide' && !Component && !catalogLoaded()) {
      void loadCatalog().then(() => catalogVersion++)
    }
  })
</script>

{#if parsed.kind === 'emoji'}
  <span class="emoji {className}" style="font-size: {size}px; line-height: 1" aria-hidden="true"
    >{parsed.value}</span
  >
{:else if Component}
  <Component {size} {strokeWidth} class={className} />
{:else if svg}
  <!-- Built by iconToSvg from Lucide's own data; no user input reaches it. -->
  <span class="wrap {className}" aria-hidden="true">{@html svg}</span>
{:else}
  <span class="fallback {className}" style="width: {size}px; height: {size}px" aria-hidden="true"></span>
{/if}

<style>
  .emoji {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1em;
    height: 1em;
  }

  .wrap {
    display: inline-flex;
  }

  .fallback {
    display: inline-block;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-sm);
    opacity: 0.4;
  }
</style>
