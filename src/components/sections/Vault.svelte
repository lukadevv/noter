<script lang="ts">
  import Icon from '../Icon.svelte'
  import EmptyState from '../ui/EmptyState.svelte'
  import VaultGate from '../vault/VaultGate.svelte'
  import SecretEditor from '../vault/SecretEditor.svelte'
  import {
    secrets,
    KIND_FIELDS,
    KIND_ICONS,
    type OpenSecret,
    type SecretKind,
  } from '$lib/secrets/store.svelte'
  import { menu } from '$lib/stores/menu.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { contextmenu } from '$lib/ui/contextmenu'
  import type { MenuItem } from '$lib/ui-types'
  import { t } from '$lib/i18n/index.svelte'

  secrets.start()

  let query = $state('')
  let filter = $state<SecretKind | 'all' | 'favorites'>('all')
  let selectedId = $state<string | null>(null)
  let editing = $state<OpenSecret | null | 'new'>(null)
  let revealed = $state<Record<string, boolean>>({})

  let visible = $derived.by(() => {
    const needle = query.trim().toLowerCase()
    return secrets.items
      .filter((item) => {
        if (filter === 'favorites' && !item.favorite) return false
        if (filter !== 'all' && filter !== 'favorites' && item.kind !== filter) return false
        if (!needle) return true
        // Search covers titles and the fields you would recognise an entry by,
        // never the secret values themselves.
        return (
          item.title.toLowerCase().includes(needle) ||
          item.fields.some((f) => !f.secret && f.value.toLowerCase().includes(needle))
        )
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.order - b.order)
  })

  let selected = $derived(secrets.items.find((i) => i.id === selectedId) ?? null)

  // On a narrow screen the list and the entry take turns; on a wide one the
  // first entry is shown so the right half is never empty.
  $effect(() => {
    if (!ui.narrow && !selected && visible.length > 0) selectedId = visible[0]!.id
  })

  function select(id: string) {
    selectedId = id
    revealed = {}
    secrets.touch()
  }

  const labelOf = (key: string, label: string, custom: boolean) =>
    custom ? label : t(`vault.fields.${key}`)

  function subtitle(item: OpenSecret): string {
    const first = item.fields.find((f) => !f.secret && f.value && f.key !== 'notes')
    return first?.value ?? t(`vault.kinds.${item.kind}`)
  }

  function mask(value: string): string {
    return '•'.repeat(Math.min(Math.max(value.length, 8), 16))
  }

  /** Only real web addresses are opened; anything else stays text. */
  function safeUrl(value: string): string | null {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
    try {
      const url = new URL(candidate)
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
    } catch {
      return null
    }
  }

  function items(item: OpenSecret): MenuItem[] {
    const copyable = item.fields.filter(
      (f) => f.value && (f.key === 'username' || f.key === 'password' || f.key === 'number'),
    )
    return [
      ...copyable.map((f) => ({
        id: `copy-${f.key}`,
        label: t('vault.copyField', { field: labelOf(f.key, f.label, f.custom) }),
        icon: 'copy',
        run: () => void secrets.copy(f.value, f.secret),
      })),
      {
        id: 'favorite',
        label: t(item.favorite ? 'vault.unfavorite' : 'vault.favorite'),
        icon: 'star',
        separatorBefore: copyable.length > 0,
        run: () => void secrets.toggleFavorite(item),
      },
      { id: 'edit', label: t('vault.edit'), icon: 'pencil', run: () => (editing = item) },
      {
        id: 'delete',
        label: t('common.delete'),
        icon: 'trash',
        danger: true,
        separatorBefore: true,
        run: () => {
          if (selectedId === item.id) selectedId = null
          void secrets.remove(item.id)
        },
      },
    ]
  }

  const FILTERS: (SecretKind | 'all' | 'favorites')[] = [
    'all',
    'favorites',
    ...(Object.keys(KIND_FIELDS) as SecretKind[]),
  ]
</script>

<svelte:window onpointerdown={() => secrets.touch()} onkeydown={() => secrets.touch()} />

<div class="page" data-testid="vault">
  {#if !secrets.metaLoaded}
    <div></div>
  {:else if !secrets.unlocked}
    <VaultGate />
  {:else}
    <header class="top enter">
      <div>
        <h1>{t('nav.vault')}</h1>
        <p class="faint">{t('vault.count', { count: secrets.count })}</p>
      </div>
      <div class="actions">
        <button class="btn" data-testid="lock-vault" onclick={() => secrets.lock()}>
          <Icon name="lock-keyhole" size={14} />{t('vault.lock')}
        </button>
        <button class="btn btn--primary" data-testid="add-secret" onclick={() => (editing = 'new')}>
          <Icon name="plus" size={14} />{t('vault.newItem')}
        </button>
      </div>
    </header>

    {#if secrets.items.length === 0}
      <EmptyState icon="shield-check" title={t('vault.empty')} body={t('vault.emptyBody')}>
        <button class="btn btn--primary" onclick={() => (editing = 'new')}>
          <Icon name="plus" size={14} />{t('vault.newItem')}
        </button>
      </EmptyState>
    {:else}
      <div class="split" class:split--detail={ui.narrow && selected}>
        <div class="list-pane">
          <div class="search">
            <Icon name="search" size={14} />
            <input
              class="bare"
              type="search"
              placeholder={t('vault.search')}
              aria-label={t('vault.search')}
              bind:value={query}
            />
          </div>
          <div class="filters" role="tablist" aria-label={t('vault.kind')}>
            {#each FILTERS as option (option)}
              <button
                role="tab"
                class="chip"
                aria-selected={filter === option}
                onclick={() => (filter = option)}
              >
                {t(
                  option === 'all'
                    ? 'vault.all'
                    : option === 'favorites'
                      ? 'vault.favorites'
                      : `vault.kinds.${option}`,
                )}
              </button>
            {/each}
          </div>

          <ul class="items" aria-label={t('nav.vault')}>
            {#each visible as item (item.id)}
              <li>
                <button
                  class="item"
                  class:item--active={item.id === selectedId}
                  data-testid="secret-item"
                  onclick={() => select(item.id)}
                  use:contextmenu={() => items(item)}
                >
                  <span class="kind-icon"><Icon name={KIND_ICONS[item.kind]} size={16} /></span>
                  <span class="text">
                    <span class="title truncate">{item.title}</span>
                    <span class="sub truncate">{subtitle(item)}</span>
                  </span>
                  {#if item.favorite}<Icon name="star" size={13} class="fav" />{/if}
                </button>
              </li>
            {:else}
              <li class="faint none">{t('vault.noMatches')}</li>
            {/each}
          </ul>
        </div>

        <div class="detail-pane">
          {#if selected}
            {#key selected.id}
              <article class="detail enter" data-testid="secret-detail">
                <header class="detail-head">
                  {#if ui.narrow}
                    <button
                      class="btn btn--ghost btn--icon"
                      aria-label={t('common.back')}
                      onclick={() => (selectedId = null)}
                    >
                      <Icon name="chevron-left" size={16} />
                    </button>
                  {/if}
                  <span class="kind-icon kind-icon--lg"
                    ><Icon name={KIND_ICONS[selected.kind]} size={20} /></span
                  >
                  <div class="head-text">
                    <h2 class="truncate">{selected.title}</h2>
                    <span class="faint small">{t(`vault.kinds.${selected.kind}`)}</span>
                  </div>
                  <button
                    class="btn btn--ghost btn--icon"
                    class:starred={selected.favorite}
                    aria-pressed={selected.favorite}
                    aria-label={t(selected.favorite ? 'vault.unfavorite' : 'vault.favorite')}
                    onclick={() => void secrets.toggleFavorite(selected!)}
                  >
                    <Icon name="star" size={16} />
                  </button>
                  <button
                    class="btn btn--ghost btn--icon"
                    aria-label={t('vault.more')}
                    onclick={(e) => menu.open(items(selected!), e.currentTarget, selected!.title)}
                  >
                    <Icon name="more" size={16} />
                  </button>
                </header>

                <dl class="fields">
                  {#each selected.fields.filter((f) => f.value) as field (field.key)}
                    {@const label = labelOf(field.key, field.label, field.custom)}
                    {@const shown = !field.secret || revealed[field.key]}
                    {@const multiline = KIND_FIELDS[selected.kind].find(
                      (f) => f.key === field.key,
                    )?.multiline}
                    <div class="row">
                      <dt>{label}</dt>
                      <dd>
                        <span
                          class="value"
                          class:value--multi={multiline}
                          class:mono={field.secret}
                          data-testid="value-{field.key}">{shown ? field.value : mask(field.value)}</span
                        >
                        <span class="tools">
                          {#if field.secret}
                            <button
                              class="btn btn--ghost btn--icon"
                              aria-label={t(revealed[field.key] ? 'vault.hide' : 'vault.show')}
                              onclick={() =>
                                (revealed = { ...revealed, [field.key]: !revealed[field.key] })}
                            >
                              <Icon name={revealed[field.key] ? 'eye-off' : 'eye'} size={15} />
                            </button>
                          {/if}
                          {#if field.key === 'url' && safeUrl(field.value)}
                            <a
                              class="btn btn--ghost btn--icon"
                              href={safeUrl(field.value)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={t('vault.openUrl')}
                            >
                              <Icon name="globe" size={15} />
                            </a>
                          {/if}
                          <button
                            class="btn btn--ghost btn--icon"
                            aria-label={t('vault.copyField', { field: label })}
                            data-testid="copy-{field.key}"
                            onclick={() => void secrets.copy(field.value, field.secret)}
                          >
                            <Icon name="copy" size={15} />
                          </button>
                        </span>
                      </dd>
                    </div>
                  {/each}
                </dl>

                <footer class="detail-foot">
                  <span class="faint small"
                    >{t('vault.updated', { date: new Date(selected.updatedAt).toLocaleString() })}</span
                  >
                  <button class="btn" onclick={() => (editing = selected)}>
                    <Icon name="pencil" size={14} />{t('vault.edit')}
                  </button>
                </footer>
              </article>
            {/key}
          {:else}
            <p class="faint pick">{t('vault.pick')}</p>
          {/if}
        </div>
      </div>
    {/if}

    <p class="note faint"><Icon name="shield" size={13} />{t('vault.privacy')}</p>
  {/if}
</div>

{#if editing && secrets.unlocked}
  <SecretEditor
    item={editing === 'new' ? null : editing}
    onclose={() => (editing = null)}
    onsaved={(id) => select(id)}
  />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 64rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
  }

  .top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  h1 {
    font-size: var(--text-3xl);
    font-weight: 700;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .split {
    display: grid;
    grid-template-columns: minmax(15rem, 20rem) 1fr;
    gap: var(--space-4);
    align-items: start;
  }

  .list-pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 34px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text-faint);
  }

  .bare {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    color: var(--text);
    font: inherit;
    outline: none;
  }

  .filters {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }

  .chip {
    padding: 2px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    background: none;
    color: var(--text-dim);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .chip[aria-selected='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--text);
  }

  .items {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius);
    background: none;
    color: var(--text);
    text-align: start;
    cursor: pointer;
  }

  .item:hover {
    background: var(--surface-2);
  }

  .item--active {
    background: var(--accent-soft);
  }

  .item :global(.fav) {
    color: var(--warn);
    flex-shrink: 0;
  }

  .kind-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: var(--radius);
    background: var(--surface-3);
    color: var(--accent);
  }

  .kind-icon--lg {
    width: 42px;
    height: 42px;
  }

  .text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .title {
    font-weight: 600;
  }

  .sub {
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .none {
    padding: var(--space-3);
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .detail-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .head-text {
    flex: 1;
    min-width: 0;
  }

  h2 {
    font-size: var(--text-xl);
    font-weight: 650;
  }

  .starred {
    color: var(--warn);
  }

  .fields {
    display: flex;
    flex-direction: column;
    margin: 0;
  }

  .row {
    padding: var(--space-2) 0;
  }

  .row + .row {
    border-top: 1px solid var(--border);
  }

  dt {
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  dd {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin: 0;
  }

  .value {
    flex: 1;
    min-width: 0;
    padding-top: 4px;
    overflow-wrap: anywhere;
    user-select: text;
  }

  .value--multi {
    white-space: pre-wrap;
  }

  .mono {
    font-family: var(--font-mono);
  }

  .tools {
    display: flex;
    flex-shrink: 0;
  }

  .detail-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .small {
    font-size: var(--text-sm);
  }

  .pick {
    padding: var(--space-6);
    text-align: center;
  }

  .note {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  @media (max-width: 860px) {
    .page {
      padding: var(--space-4) var(--space-4);
    }

    .split {
      grid-template-columns: 1fr;
    }

    .split .detail-pane {
      display: none;
    }

    .split--detail .detail-pane {
      display: block;
    }

    .split--detail .list-pane {
      display: none;
    }
  }
</style>
