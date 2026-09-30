<script lang="ts">
  import Icon from '../Icon.svelte'
  import { notes } from '$lib/stores/notes.svelte'
  import { alerts } from '$lib/stores/alerts.svelte'
  import { derivedTitle, preview } from '$lib/db/repo/notes'
  import { relativeTime } from '$lib/utils/dates'
  import { navigate } from '../../routes/router'
  import { rise } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    onnewnote: () => void
    ontoday: () => void
    onsearch: () => void
  }

  let { onnewnote, ontoday, onsearch }: Props = $props()

  let greeting = $derived.by(() => {
    const hour = new Date().getHours()
    if (hour < 6) return t('home.greeting.night')
    if (hour < 12) return t('home.greeting.morning')
    if (hour < 19) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  })

  let today = $derived(
    new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
  )

  let recent = $derived(
    [...notes.notes]
      .filter((n) => !n.encrypted)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6),
  )

  function open(id: string) {
    navigate({ kind: 'notes', folderId: null, noteId: id })
  }
</script>

<div class="home" data-testid="home">
  <header class="hero" in:rise>
    <p class="date">{today}</p>
    <h1>{greeting}</h1>
  </header>

  <div class="actions" in:rise={{ delay: 40 }}>
    <button class="action" onclick={onnewnote}>
      <Icon name="plus" size={18} />
      <span>{t('list.newNote')}</span>
    </button>
    <button class="action" onclick={ontoday}>
      <Icon name="calendar-days" size={18} />
      <span>{t('actions.openToday')}</span>
    </button>
    <button class="action" onclick={onsearch}>
      <Icon name="search" size={18} />
      <span>{t('nav.search')}</span>
    </button>
  </div>

  {#if alerts.all.length > 0}
    <section class="block" in:rise={{ delay: 80 }}>
      <h2>{t('home.alerts')}</h2>
      <ul class="alerts">
        {#each alerts.all as alert (alert.id)}
          <li class="alert alert--{alert.tone}">
            <Icon name={alert.icon} size={18} />
            <div class="alert-text">
              <strong>{alert.title}</strong>
              {#if alert.body}<span class="faint">{alert.body}</span>{/if}
            </div>
            {#if alert.action}
              <button class="btn btn--primary" onclick={alert.action.run}>{alert.action.label}</button>
            {/if}
            {#if alert.dismiss}
              <button
                class="btn btn--ghost btn--icon"
                aria-label={t('common.dismiss')}
                onclick={alert.dismiss}
              >
                <Icon name="x" size={14} />
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="block" in:rise={{ delay: 120 }}>
    <h2>{t('home.recent')}</h2>
    {#if recent.length === 0}
      <p class="faint">{t('home.noNotes')}</p>
    {:else}
      <div class="recent">
        {#each recent as note (note.id)}
          <button class="card" onclick={() => open(note.id)}>
            <span class="card-title truncate">{derivedTitle(note)}</span>
            <span class="card-snippet">{preview(note.body, 90) || t('list.emptyNote')}</span>
            <span class="card-time faint">{relativeTime(note.updatedAt, Date.now(), t)}</span>
          </button>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 64rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
  }

  .date {
    color: var(--text-faint);
    font-size: var(--text-md);
    text-transform: capitalize;
  }

  h1 {
    font-size: var(--text-3xl);
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  h2 {
    font-size: var(--text-sm);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    margin-bottom: var(--space-3);
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-3);
  }

  .action {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    text-align: start;
    transition:
      transform var(--dur-2) var(--ease-out),
      border-color var(--dur-2),
      background var(--dur-2);
  }

  .action :global(svg) {
    color: var(--accent);
  }

  .action:hover {
    transform: translateY(-2px);
    border-color: var(--border-strong);
    background: var(--surface-2);
  }

  .alerts {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .alert {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-inline-start: 3px solid var(--accent);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .alert--warn {
    border-inline-start-color: var(--warn);
  }

  .alert--danger {
    border-inline-start-color: var(--danger);
  }

  .alert--ok {
    border-inline-start-color: var(--ok);
  }

  .alert-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .recent {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-3);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-height: 110px;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    text-align: start;
    cursor: pointer;
    transition:
      transform var(--dur-2) var(--ease-out),
      border-color var(--dur-2);
  }

  .card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
  }

  .card-title {
    font-weight: 600;
  }

  .card-snippet {
    flex: 1;
    color: var(--text-dim);
    font-size: var(--text-md);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-time {
    font-size: var(--text-sm);
  }

  @media (max-width: 860px) {
    .home {
      padding: var(--space-5) var(--space-4);
    }

    h1 {
      font-size: var(--text-2xl);
    }
  }
</style>
