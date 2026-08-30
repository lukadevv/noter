<script lang="ts">
  import Icon from './Icon.svelte'
  import { loadCatalog } from '$lib/icons/dynamic'
  import { FOLDER_ICON_NAMES } from '$lib/icons/registry'
  import type { IconRef } from '$lib/db/schema'
  import { untrack } from 'svelte'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    value: IconRef
    onpick: (icon: IconRef) => void
    onclose: () => void
  }

  let { value, onpick, onclose }: Props = $props()

  // Opening tab follows the current icon; the user can switch freely after that.
  let tab = $state<'icons' | 'emoji'>(untrack(() => value).startsWith('emoji:') ? 'emoji' : 'icons')
  let query = $state('')
  let names = $state<string[]>([...FOLDER_ICON_NAMES])
  let loading = $state(true)

  /** A small, hand-picked emoji set: enough to be expressive, short enough to scan. */
  const EMOJI = [
    '📁',
    '📂',
    '🗂️',
    '📋',
    '📌',
    '📎',
    '🔖',
    '📝',
    '✏️',
    '🖊️',
    '📓',
    '📔',
    '📕',
    '📗',
    '📘',
    '📙',
    '💡',
    '🔥',
    '⭐',
    '✨',
    '🎯',
    '🚀',
    '🧠',
    '⚙️',
    '🔧',
    '🛠️',
    '🧪',
    '🔬',
    '📊',
    '📈',
    '💰',
    '🧾',
    '🏠',
    '🏢',
    '🌱',
    '🌍',
    '☕',
    '🍕',
    '🎵',
    '🎬',
    '🎮',
    '📷',
    '✈️',
    '🚗',
    '❤️',
    '✅',
    '⏰',
    '🔒',
  ]

  // The full catalogue is a separate chunk; it downloads the first time this
  // picker is opened and is cached for the rest of the session.
  $effect(() => {
    void loadCatalog().then((catalog) => {
      names = [...catalog.keys()].sort()
      loading = false
    })
  })

  let filtered = $derived.by(() => {
    const term = query.trim().toLowerCase()
    const list = term ? names.filter((name) => name.includes(term)) : names
    return list.slice(0, 400)
  })
</script>

<div class="backdrop" role="presentation" onpointerdown={onclose}></div>

<div class="picker" role="dialog" aria-modal="true" aria-label={t('icons.choose')}>
  <header class="head">
    <div class="tabs">
      <button class="tab" class:tab--active={tab === 'icons'} onclick={() => (tab = 'icons')}
        >{t('icons.icons')}</button
      >
      <button class="tab" class:tab--active={tab === 'emoji'} onclick={() => (tab = 'emoji')}
        >{t('icons.emoji')}</button
      >
    </div>
    <button class="btn btn--ghost btn--icon" aria-label={t('common.close')} onclick={onclose}>
      <Icon name="x" size={15} />
    </button>
  </header>

  {#if tab === 'icons'}
    <div class="field">
      <Icon name="search" size={14} />
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:value={query}
        placeholder={t('icons.searchCount', { count: names.length })}
        aria-label={t('icons.search')}
        autofocus
      />
    </div>

    <div class="grid">
      {#each filtered as name (name)}
        <button
          class="cell"
          class:cell--active={value === `lucide:${name}`}
          title={name}
          aria-label={name}
          onclick={() => onpick(`lucide:${name}`)}
        >
          <Icon name={`lucide:${name}`} size={18} />
        </button>
      {/each}

      {#if loading}
        <p class="status faint">{t('icons.loading')}</p>
      {:else if filtered.length === 0}
        <p class="status faint">{t('icons.noMatches', { term: query })}</p>
      {/if}
    </div>
  {:else}
    <div class="grid">
      {#each EMOJI as emoji (emoji)}
        <button
          class="cell"
          class:cell--active={value === `emoji:${emoji}`}
          aria-label={emoji}
          onclick={() => onpick(`emoji:${emoji}`)}
        >
          <span class="glyph">{emoji}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 57;
    background: var(--overlay);
  }

  .picker {
    position: fixed;
    z-index: 58;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    width: min(94vw, 26rem);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-2);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2);
    border-bottom: 1px solid var(--border);
  }

  .tabs {
    display: flex;
    gap: 2px;
  }

  .tab {
    padding: var(--space-1) var(--space-3);
    border: none;
    border-radius: var(--radius);
    background: none;
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
  }

  .tab--active {
    background: var(--accent-soft);
    color: var(--text);
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border);
    color: var(--text-faint);
  }

  .field input {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    color: var(--text);
  }

  .field input:focus {
    outline: none;
  }

  .grid {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
    gap: 2px;
    padding: var(--space-2);
  }

  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: none;
    color: var(--text-dim);
    cursor: pointer;
  }

  .cell:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .cell--active {
    border-color: var(--accent);
    color: var(--accent);
  }

  .glyph {
    font-size: 18px;
  }

  .status {
    grid-column: 1 / -1;
    padding: var(--space-5);
    text-align: center;
    font-size: 13px;
  }
</style>
