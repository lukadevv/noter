<script lang="ts">
  import Icon from './Icon.svelte'
  import { referencedAssetIds } from '$lib/db/repo/assets'
  import { assetUrl } from '$lib/images/urls'
  import { lightbox } from '$lib/stores/lightbox.svelte'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    body: string
    readOnly?: boolean
    /** Drawn inside a note (a ```gallery block) rather than filling a pane. */
    inline?: boolean
    onadd?: () => void
    /** Removes one image from the gallery (the stored image stays until unused). */
    onremove?: (id: string) => void
  }

  let { body, readOnly = false, inline = false, onadd, onremove }: Props = $props()

  let ids = $derived(referencedAssetIds(body))
  let urls = $state<Record<string, string>>({})

  // Thumbnails, not full images: a note with forty screenshots would otherwise
  // decode forty full-size bitmaps just to draw a grid.
  $effect(() => {
    let cancelled = false
    for (const id of ids) {
      if (urls[id]) continue
      void assetUrl(id, 'thumb').then((url) => {
        if (!cancelled && url) urls = { ...urls, [id]: url }
      })
    }
    return () => {
      cancelled = true
    }
  })
</script>

<div class="gallery" class:gallery--inline={inline}>
  {#if ids.length === 0}
    <div class="empty">
      <Icon name="image" size={22} />
      <p class="faint">{t('gallery.empty')}</p>
      {#if !readOnly && onadd}
        <button class="btn" onclick={onadd}>
          <Icon name="plus" size={15} />
          {t('gallery.add')}
        </button>
        <p class="hint faint">{t('gallery.hint')}</p>
      {/if}
    </div>
  {:else}
    <div class="grid">
      {#each ids as id (id)}
        <button
          class="tile"
          data-testid="gallery-tile"
          onclick={() => lightbox.show(ids, id)}
          aria-label={t('gallery.openImage')}
        >
          {#if urls[id]}
            <img src={urls[id]} alt="" loading="lazy" />
          {:else}
            <span class="skeleton"></span>
          {/if}
          {#if !readOnly && onremove}
            <span
              class="remove"
              role="button"
              tabindex="0"
              aria-label={t('gallery.remove')}
              onclick={(e) => {
                e.stopPropagation()
                onremove(id)
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onremove(id)
                }
              }}
            >
              <Icon name="x" size={12} />
            </span>
          {/if}
        </button>
      {/each}
      {#if !readOnly && onadd}
        <button class="tile tile--add" onclick={onadd} aria-label={t('gallery.add')}>
          <Icon name="plus" size={20} />
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .gallery {
    height: 100%;
    overflow-y: auto;
    padding: 0 var(--space-4) var(--space-6);
  }

  .gallery--inline {
    height: auto;
    padding: 0;
  }

  .gallery--inline .empty {
    padding: var(--space-4);
  }

  .remove {
    position: absolute;
    top: 6px;
    inset-inline-end: 6px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--overlay);
    color: #fff;
    opacity: 0;
    transition: opacity var(--dur-1);
  }

  .tile:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }

  @media (pointer: coarse) {
    .remove {
      opacity: 1;
    }
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-2);
    max-width: 60rem;
    margin: 0 auto;
  }

  .tile {
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
    cursor: zoom-in;
  }

  .tile:hover {
    border-color: var(--accent);
  }

  .tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tile--add {
    display: flex;
    align-items: center;
    justify-content: center;
    border-style: dashed;
    color: var(--text-faint);
    cursor: pointer;
  }

  .tile--add:hover {
    color: var(--accent);
  }

  .skeleton {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--surface-2);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-4);
    color: var(--text-faint);
    text-align: center;
  }

  .hint {
    font-size: 12px;
    max-width: 26rem;
  }
</style>
