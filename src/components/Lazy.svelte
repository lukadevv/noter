<script lang="ts">
  import type { Component } from 'svelte'

  /* eslint-disable @typescript-eslint/no-explicit-any */
  type AnyComponent = Component<any, any, any>

  interface Props {
    /** Loader for a component that should not be in the initial bundle. */
    load: () => Promise<{ default: AnyComponent }>
    /** Props forwarded to the loaded component. */
    props?: Record<string, unknown>
  }

  let { load, props = {} }: Props = $props()

  let Loaded = $state<AnyComponent | null>(null)

  // Heavy dialogs (backup codecs, the share encoder) are only fetched the first
  // time they are actually opened.
  $effect(() => {
    void load().then((module) => {
      Loaded = module.default
    })
  })
</script>

{#if Loaded}
  {@const Component = Loaded}
  <Component {...props} />
{/if}
