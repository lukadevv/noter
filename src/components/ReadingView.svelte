<script lang="ts">
  import { lightbox } from '$lib/stores/lightbox.svelte'
  import { assetUrl } from '$lib/images/urls'
  import { toggleTaskAtLine } from '$lib/md/tasks'
  import { referencedAssetIds } from '$lib/db/repo/assets'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    body: string
    readOnly?: boolean
    /** Called when a checkbox is ticked, with the rewritten markdown. */
    onchange?: (body: string) => void
    /** Called when a `[[wiki link]]` is followed. */
    onlink?: (target: string) => void
    /**
     * Set when the images this note references are known not to be available —
     * a shared link carries text only. Their placeholders then read as expected
     * rather than as an error.
     */
    imagesUnavailable?: boolean
  }

  let { body, readOnly = false, onchange, onlink, imagesUnavailable = false }: Props = $props()

  let render = $state<((source: string) => string) | null>(null)
  let container = $state<HTMLElement | null>(null)

  // markdown-it and DOMPurify together are a sizeable chunk, and a session spent
  // writing never needs them, so the renderer is fetched the first time someone
  // switches to reading view.
  $effect(() => {
    if (render) return
    void import('$lib/md/parse').then((module) => {
      render = module.renderMarkdown
    })
  })

  let html = $derived(render ? render(body) : '')

  // Stored images render without a `src`; the blob URLs are filled in here,
  // after the markup lands in the DOM.
  $effect(() => {
    void html
    const root = container
    if (!root) return

    let cancelled = false
    for (const image of root.querySelectorAll<HTMLImageElement>('img[data-asset]')) {
      const id = image.dataset.asset
      if (!id || image.src) continue
      void assetUrl(id, 'full').then((url) => {
        if (cancelled) return
        if (url) image.src = url
        else image.replaceWith(missingImagePlaceholder())
      })
    }

    return () => {
      cancelled = true
    }
  })

  function missingImagePlaceholder(): HTMLElement {
    const span = document.createElement('span')
    span.className = imagesUnavailable ? 'missing-image missing-image--expected' : 'missing-image'
    span.textContent = t(imagesUnavailable ? 'gallery.notShared' : 'gallery.missing')
    return span
  }

  function onClick(event: MouseEvent) {
    const target = event.target as HTMLElement

    if (target instanceof HTMLInputElement && target.classList.contains('task-checkbox')) {
      event.preventDefault()
      const line = Number(target.dataset.line)
      if (readOnly || !onchange || Number.isNaN(line)) return
      onchange(toggleTaskAtLine(body, line))
      return
    }

    if (target instanceof HTMLImageElement && target.dataset.asset) {
      lightbox.show(referencedAssetIds(body), target.dataset.asset)
      return
    }

    const link = target.closest<HTMLElement>('a.wikilink')
    if (link?.dataset.link) {
      event.preventDefault()
      onlink?.(link.dataset.link)
    }
  }
</script>

{#if render}
  <!-- Sanitised inside renderMarkdown: markdown-it runs with html:false and the
       result passes through DOMPurify before it reaches the DOM. -->
  <article
    class="prose"
    class:prose--readonly={readOnly}
    bind:this={container}
    role="presentation"
    onclick={onClick}
  >
    <!-- Safe by construction: markdown-it runs with html:false and the result
         passes through DOMPurify inside renderMarkdown. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html html}
  </article>
{:else}
  <p class="loading faint">{t('note.rendering')}</p>
{/if}

<style>
  .prose {
    height: 100%;
    max-width: 46rem;
    margin: 0 auto;
    padding: 0 var(--space-4) var(--space-6);
    overflow-y: auto;
    font-size: var(--editor-font-size);
  }

  .prose--readonly :global(.task-checkbox) {
    cursor: default;
  }

  .loading {
    padding: var(--space-4);
    text-align: center;
    font-size: 12px;
  }
</style>
