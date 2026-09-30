<script lang="ts">
  import Icon from '../Icon.svelte'
  import EmptyState from '../ui/EmptyState.svelte'
  import Dialog from '../ui/Dialog.svelte'
  import MedCard from '../meds/MedCard.svelte'
  import MedDialog from '../meds/MedDialog.svelte'
  import { meds } from '$lib/meds/store.svelte'
  import { startOfDay } from '$lib/meds/schedule'
  import type { Med } from '$lib/db/schema'
  import { flipDuration, rise } from '$lib/ui/motion.svelte'
  import { flip } from 'svelte/animate'
  import { t } from '$lib/i18n/index.svelte'

  meds.start()

  let editing = $state<Med | null | 'new'>(null)
  let takingAt = $state<Med | null>(null)
  let takenTime = $state('')

  let today = $derived(
    meds.doses.filter((d) => d.takenAt >= startOfDay(meds.now)).sort((a, b) => b.takenAt - a.takenAt),
  )

  function nameOf(medId: string): string {
    return meds.meds.find((m) => m.id === medId)?.name ?? '—'
  }

  function openTakeAt(med: Med) {
    const now = new Date()
    takenTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    takingAt = med
  }

  async function confirmTakeAt() {
    if (!takingAt) return
    const [h, m] = takenTime.split(':').map(Number)
    // A throwaway value, not reactive state.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const at = new Date()
    at.setHours(h ?? 0, m ?? 0, 0, 0)
    // A time later than now means yesterday evening, not tonight.
    if (at.getTime() > Date.now()) at.setDate(at.getDate() - 1)
    await meds.take(takingAt.id, at.getTime())
    takingAt = null
  }
</script>

<div class="page" data-testid="meds">
  <header class="top" in:rise>
    <div>
      <h1>{t('nav.meds')}</h1>
      <p class="faint">{t('meds.about')}</p>
    </div>
    <button class="btn btn--primary" data-testid="add-med" onclick={() => (editing = 'new')}>
      <Icon name="plus" size={14} />{t('meds.add')}
    </button>
  </header>

  {#if meds.loaded && meds.meds.length === 0}
    <EmptyState icon="pill" title={t('meds.empty')} body={t('meds.emptyBody')}>
      <button class="btn btn--primary" onclick={() => (editing = 'new')}>
        <Icon name="plus" size={14} />{t('meds.add')}
      </button>
    </EmptyState>
  {:else}
    <div class="list">
      {#each meds.meds as med (med.id)}
        <div animate:flip={{ duration: flipDuration() }} in:rise>
          <MedCard {med} onedit={(m) => (editing = m)} ontakeat={openTakeAt} />
        </div>
      {/each}
    </div>

    {#if today.length > 0}
      <section class="block">
        <h2>{t('meds.today')}</h2>
        <ul class="log">
          {#each today as dose (dose.id)}
            <li class="entry" class:entry--skipped={dose.status === 'skipped'}>
              <span class="time"
                >{new Date(dose.takenAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}</span
              >
              <span class="what truncate">{nameOf(dose.medId)}</span>
              <span class="faint"
                >{dose.status === 'skipped' ? t('meds.skipped') : t('meds.takenPast')}</span
              >
              <button
                class="btn btn--ghost btn--icon"
                aria-label={t('meds.undo')}
                onclick={() => void meds.undo(dose.id)}
              >
                <Icon name="restore" size={14} />
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</div>

{#if editing}
  <MedDialog med={editing === 'new' ? null : editing} onclose={() => (editing = null)} />
{/if}

{#if takingAt}
  <Dialog label={t('meds.takenAt')} icon="clock" size="sm" onclose={() => (takingAt = null)}>
    <form
      class="take-at"
      onsubmit={(e) => {
        e.preventDefault()
        void confirmTakeAt()
      }}
    >
      <p class="faint">{takingAt.name}</p>
      <input class="input" type="time" data-autofocus bind:value={takenTime} />
      <div class="row">
        <button type="button" class="btn" onclick={() => (takingAt = null)}>{t('common.cancel')}</button>
        <button type="submit" class="btn btn--primary">{t('meds.taken')}</button>
      </div>
    </form>
  </Dialog>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 52rem;
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

  h2 {
    margin-bottom: var(--space-3);
    font-size: var(--text-sm);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .log {
    list-style: none;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    overflow: hidden;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
  }

  .entry + .entry {
    border-top: 1px solid var(--border);
  }

  .entry--skipped .what {
    text-decoration: line-through;
    color: var(--text-faint);
  }

  .time {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .what {
    flex: 1;
  }

  .take-at {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  @media (max-width: 860px) {
    .page {
      padding: var(--space-5) var(--space-4);
    }

    h1 {
      font-size: var(--text-2xl);
    }
  }
</style>
