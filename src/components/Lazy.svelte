<script lang="ts">
  import type { Component, Snippet } from 'svelte'

  /* eslint-disable @typescript-eslint/no-explicit-any */
  type AnyComponent = Component<any, any, any>

  interface Props {
    /** Loader for a component that should not be in the initial bundle. */
    load: () => Promise<{ default: AnyComponent }>
    /** Props forwarded to the loaded component. */
    props?: Record<string, unknown>
    /** Shown while the chunk is loading, e.g. a skeleton. */
    fallback?: Snippet
    /** Shown when the chunk failed to load (offline on a stale deploy). */
    failed?: Snippet<[() => void]>
  }

  let { load, props = {}, fallback, failed }: Props = $props()

  let Loaded = $state<AnyComponent | null>(null)
  let error = $state(false)
  let attempt = $state(0)

  // Heavy dialogs and whole sections are only fetched the first time they are
  // actually opened.
  $effect(() => {
    void attempt
    error = false
    load().then(
      (module) => {
        Loaded = module.default
      },
      () => {
        error = true
      },
    )
  })
</script>

{#if Loaded}
  {@const Component = Loaded}
  <Component {...props} />
{:else if error}
  {@render failed?.(() => attempt++)}
{:else}
  {@render fallback?.()}
{/if}
