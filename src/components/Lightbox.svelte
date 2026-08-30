<script lang="ts">
  import Icon from './Icon.svelte'
  import { lightbox } from '$lib/stores/lightbox.svelte'
  import { assetUrl } from '$lib/images/urls'
  import { getAsset } from '$lib/db/repo/assets'
  import { ui } from '$lib/stores/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'

  let url = $state<string | null>(null)
  let zoom = $state(1)
  let pan = $state({ x: 0, y: 0 })
  let dragging = $state(false)
  let dragOrigin = { x: 0, y: 0, panX: 0, panY: 0 }

  // Reset the transform whenever a different image comes up, otherwise the next
  // image opens already zoomed into a corner of the previous one.
  $effect(() => {
    const id = lightbox.currentId
    zoom = 1
    pan = { x: 0, y: 0 }
    url = null
    if (!id) return
    void assetUrl(id, 'full').then((resolved) => {
      if (lightbox.currentId === id) url = resolved
    })
  })

  function onKeydown(event: KeyboardEvent) {
    if (!lightbox.open) return
    if (event.key === 'Escape') lightbox.close()
    else if (event.key === 'ArrowRight') lightbox.next()
    else if (event.key === 'ArrowLeft') lightbox.previous()
    else if (event.key === '0') {
      zoom = 1
      pan = { x: 0, y: 0 }
    }
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    const next = zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15)
    zoom = Math.min(8, Math.max(1, next))
    if (zoom === 1) pan = { x: 0, y: 0 }
  }

  function onPointerDown(event: PointerEvent) {
    if (zoom === 1) return
    dragging = true
    dragOrigin = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return
    pan = {
      x: dragOrigin.panX + (event.clientX - dragOrigin.x),
      y: dragOrigin.panY + (event.clientY - dragOrigin.y),
    }
  }

  async function copyImage() {
    const id = lightbox.currentId
    if (!id) return
    try {
      const asset = await getAsset(id)
      if (!asset) return
      await navigator.clipboard.write([new ClipboardItem({ [asset.blob.type]: asset.blob })])
      ui.toast(t('toast.imageCopied'), 'ok')
    } catch {
      ui.toast(t('toast.copyDenied'), 'warn')
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if lightbox.open}
  <div
    class="backdrop"
    data-testid="lightbox"
    role="dialog"
    aria-modal="true"
    aria-label={t('lightbox.viewer')}
  >
    <div class="bar">
      <span class="counter faint numeric">{lightbox.index + 1} / {lightbox.ids.length}</span>
      <div class="spacer"></div>
      <button class="btn btn--ghost btn--icon" aria-label={t('lightbox.copyImage')} onclick={copyImage}>
        <Icon name="copy" size={16} />
      </button>
      <button
        class="btn btn--ghost btn--icon"
        aria-label={t('lightbox.closeViewer')}
        onclick={() => lightbox.close()}
      >
        <Icon name="x" size={16} />
      </button>
    </div>

    <!-- Clicking the empty space closes; clicking the image itself does not. -->
    <div
      class="stage"
      role="presentation"
      onclick={(e) => {
        if (e.target === e.currentTarget) lightbox.close()
      }}
      onwheel={onWheel}
    >
      {#if lightbox.ids.length > 1}
        <button
          class="nav nav--prev"
          aria-label={t('lightbox.previousImage')}
          onclick={() => lightbox.previous()}
        >
          <Icon name="chevron-right" size={20} />
        </button>
        <button class="nav nav--next" aria-label={t('lightbox.nextImage')} onclick={() => lightbox.next()}>
          <Icon name="chevron-right" size={20} />
        </button>
      {/if}

      {#if url}
        <img
          class="image"
          class:image--grabbing={dragging}
          class:image--zoomed={zoom > 1}
          src={url}
          alt=""
          draggable="false"
          style="transform: translate({pan.x}px, {pan.y}px) scale({zoom})"
          onpointerdown={onPointerDown}
          onpointermove={onPointerMove}
          onpointerup={() => (dragging = false)}
          onpointercancel={() => (dragging = false)}
          ondblclick={() => {
            zoom = zoom > 1 ? 1 : 2.5
            pan = { x: 0, y: 0 }
          }}
        />
      {:else}
        <p class="faint">{t('common.loading')}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    flex-direction: column;
    background: color-mix(in oklab, var(--bg) 88%, black);
    backdrop-filter: blur(3px);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .spacer {
    flex: 1;
  }

  .counter {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    overflow: hidden;
  }

  .image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: var(--radius);
    box-shadow: var(--shadow-2);
    transition: transform 90ms ease-out;
    touch-action: none;
  }

  .image--zoomed {
    cursor: grab;
  }

  .image--grabbing {
    cursor: grabbing;
    transition: none;
  }

  .nav {
    position: absolute;
    top: 50%;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    transform: translateY(-50%);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    background: var(--surface-2);
    color: var(--text);
    cursor: pointer;
    opacity: 0.75;
  }

  .nav:hover {
    opacity: 1;
  }

  /* The arrows follow the reading direction: "previous" is always on the side
     text comes from. */
  .nav--prev {
    inset-inline-start: var(--space-3);
    rotate: 180deg;
  }

  :global([dir='rtl']) .nav--prev {
    rotate: 0deg;
  }

  .nav--next {
    inset-inline-end: var(--space-3);
  }

  :global([dir='rtl']) .nav--next {
    rotate: 180deg;
  }
</style>
