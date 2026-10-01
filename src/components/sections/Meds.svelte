<script lang="ts">
  import Icon from '../Icon.svelte'
  import EmptyState from '../ui/EmptyState.svelte'
  import PageHeader from '../ui/PageHeader.svelte'
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
    const med = takingAt
    takingAt = null
    await meds.requestTake(med.id, at.getTime())
  }
</script>

<div class="page" data-testid="meds">
  <PageHeader title={t('nav.meds')} subtitle={t('meds.about')}>
    {#snippet actions()}
      <button class="btn btn--primary btn--pill" data-testid="add-med" onclick={() => (editing = 'new')}>
        <Icon name="plus" size={14} />{t('meds.add')}
      </button>
    {/snippet}
  </PageHeader>

  {#if meds.loaded && meds.meds.length === 0}
    <EmptyState icon="pill" title={t('meds.empty')} body={t('meds.emptyBody')}>
      <button class="btn btn--primary" onclick={() => (editing = 'new')}>
        <Icon name="plus" size={14} />{t('meds.add')}
      </button>
    </EmptyState>
  {:else}
    <div class="list">
      {#each meds.meds as med, i (med.id)}
        <div class="enter" style="--i: {i}" animate:flip={{ duration: flipDuration() }}>
          <MedCard {med} onedit={(m) => (editing = m)} ontakeat={openTakeAt} />
        </div>
      {/each}
    </div>

    {#if today.length > 0}
      <section class="block enter" style="--i: 3">
        <h2 class="title-sm">{t('meds.today')}</h2>
        <ul class="log surface">
          {#each today as dose (dose.id)}
            <li class="entry" class:entry--skipped={dose.status === 'skipped'} in:rise>
              <span
                class="dot"
                style="--c: {meds.meds.find((m) => m.id === dose.medId)?.color ?? 'var(--accent)'}"
              ></span>
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

  h2 {
    margin-bottom: var(--space-3);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c);
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
  }
</style>
