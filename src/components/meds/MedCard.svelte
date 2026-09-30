<script lang="ts">
  import Icon from '../Icon.svelte'
  import ProgressRing from '../ui/ProgressRing.svelte'
  import CheckBurst from '../ui/CheckBurst.svelte'
  import { confirm } from '$lib/stores/confirm.svelte'
  import { meds } from '$lib/meds/store.svelte'
  import { dosesLeft, formatSpan, history, adherence, lowStock } from '$lib/meds/schedule'
  import type { Med } from '$lib/db/schema'
  import { menu } from '$lib/stores/menu.svelte'
  import { contextmenu } from '$lib/ui/contextmenu'
  import type { MenuItem } from '$lib/ui-types'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    med: Med
    /** A compact card for the dashboard: no history, no secondary actions. */
    compact?: boolean
    onedit?: (med: Med) => void
    ontakeat?: (med: Med) => void
  }

  let { med, compact = false, onedit, ontakeat }: Props = $props()

  let status = $derived(meds.statuses.get(med.id))
  let days = $derived(history(med, meds.doses, meds.now, 7))
  let rate = $derived(adherence(days))
  let left = $derived(dosesLeft(med))
  /** Replays the check animation after a dose is logged. */
  let logged = $state(0)
  let showCheck = $state(false)
  let checkTimer: ReturnType<typeof setTimeout> | undefined

  async function take(at?: number) {
    if (!(await meds.requestTake(med.id, at))) return
    logged++
    showCheck = true
    clearTimeout(checkTimer)
    checkTimer = setTimeout(() => (showCheck = false), 1400)
  }

  async function remove() {
    const ok = await confirm.ask({
      title: t('meds.deleteTitle', { name: med.name }),
      body: t('meds.deleteBody'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) await meds.remove(med.id)
  }

  $effect(() => () => clearTimeout(checkTimer))

  /** A stock bar is out of three weeks' worth, so "low" (three days) reads as nearly empty. */
  let stockRatio = $derived(
    left === null ? null : Math.min(1, left / Math.max(1, (24 / med.intervalHours) * 21)),
  )

  const TONE = {
    first: 'var(--accent)',
    ok: 'var(--ok)',
    soon: 'var(--accent)',
    due: 'var(--warn)',
    overdue: 'var(--danger)',
    paused: 'var(--text-faint)',
  } as const

  let line = $derived.by(() => {
    if (!status) return ''
    switch (status.state) {
      case 'first':
        return t('meds.state.first')
      case 'paused':
        return t('meds.state.paused')
      case 'due':
        return t('meds.state.due')
      case 'overdue':
        return t('meds.state.overdue', { span: formatSpan(status.remaining) })
      default:
        return t('meds.state.next', {
          span: formatSpan(status.remaining),
          time: new Date(status.nextDue!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
    }
  })

  function items(): MenuItem[] {
    return [
      { id: 'take', label: t('meds.taken'), icon: 'circle-check', run: () => void take() },
      ...(ontakeat
        ? [{ id: 'take-at', label: t('meds.takenAt'), icon: 'clock', run: () => ontakeat(med) }]
        : []),
      { id: 'skip', label: t('meds.skip'), icon: 'arrow-down', run: () => void meds.skip(med.id) },
      ...(status?.last
        ? [
            {
              id: 'undo',
              label: t('meds.undoLast'),
              icon: 'restore',
              run: () => void meds.undo(status!.last!.id),
            },
          ]
        : []),
      ...(onedit
        ? [
            {
              id: 'edit',
              label: t('meds.edit'),
              icon: 'pencil',
              separatorBefore: true,
              run: () => onedit(med),
            },
          ]
        : []),
      {
        id: 'pause',
        label: t(med.active ? 'meds.pause' : 'meds.resume'),
        icon: med.active ? 'pause' : 'play',
        run: () => void meds.setActive(med.id, !med.active),
      },
      {
        id: 'delete',
        label: t('common.delete'),
        icon: 'trash',
        danger: true,
        separatorBefore: true,
        run: () => void remove(),
      },
    ]
  }
</script>

<article
  class="card surface card--{status?.state ?? 'first'}"
  class:card--compact={compact}
  style={med.color ? `--med: ${med.color}` : ''}
  data-testid="med-card"
  use:contextmenu={items}
>
  <div class="dial">
    <ProgressRing
      value={status?.state === 'first' ? 0 : (status?.progress ?? 0)}
      size={compact ? 52 : 72}
      stroke={compact ? 5 : 6}
      color={med.color ?? TONE[status?.state ?? 'first']}
      label={med.name}
    >
      {#if showCheck}
        {#key logged}<CheckBurst size={compact ? 26 : 34} />{/key}
      {:else}
        <span class="pill-icon"><Icon name="pill" size={compact ? 18 : 22} /></span>
      {/if}
    </ProgressRing>
  </div>

  <div class="info">
    <div class="title">
      <strong class="truncate">{med.name}</strong>
      {#if med.dose}<span class="dose faint">{med.dose}</span>{/if}
    </div>
    <span class="status status--{status?.state}" data-testid="med-status">{line}</span>
    {#if !compact}
      <span class="meta faint">
        <Icon name="clock" size={12} />
        {t('meds.everyN', { hours: med.intervalHours })}
        {#if left !== null}
          <span class="stock" class:low={lowStock(med)}>
            <span class="stock-bar"
              ><span class="stock-fill" style="width: {(stockRatio ?? 0) * 100}%"></span></span
            >
            {t('meds.left', { count: left })}
          </span>
        {/if}
      </span>
      <div class="days" aria-label={t('meds.lastWeek')}>
        {#each days as day (day.day)}
          <span
            class="day"
            class:day--full={day.expected > 0 && day.taken >= day.expected}
            class:day--partial={day.taken > 0 && day.taken < day.expected}
            class:day--missed={day.expected > 0 && day.taken === 0}
            title="{new Date(day.day).toLocaleDateString([], {
              weekday: 'short',
              day: 'numeric',
            })}: {day.taken}/{day.expected}"
          ></span>
        {/each}
        {#if rate !== null}<span class="rate faint">{Math.round(rate * 100)}%</span>{/if}
      </div>
    {/if}
  </div>

  <div class="actions">
    <button class="btn btn--primary btn--pill take" data-testid="take-dose" onclick={() => void take()}>
      <Icon name="check" size={15} />{t('meds.taken')}
    </button>
    <button
      class="btn btn--ghost btn--icon"
      aria-label={t('meds.actions')}
      onclick={(e) => menu.open(items(), e.currentTarget, med.name)}
    >
      <Icon name="more" size={15} />
    </button>
  </div>
</article>

<style>
  .card {
    --med: var(--accent);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    transition: border-color var(--dur-2);
  }

  .card::before {
    content: '';
    position: absolute;
    inset: 12px auto 12px 0;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--med);
    opacity: 0.8;
  }

  .pill-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: color-mix(in oklab, var(--med) 16%, transparent);
    color: var(--med);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-1) var(--space-2);
    flex-wrap: wrap;
  }

  .stock {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .stock-bar {
    width: 44px;
    height: 5px;
    border-radius: 3px;
    background: var(--surface-3);
    overflow: hidden;
  }

  .stock-fill {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--ok);
    transition: width var(--dur-3) var(--ease-out);
  }

  .low .stock-fill {
    background: var(--warn);
  }

  .card--due {
    border-color: var(--warn);
  }

  .card--overdue {
    border-color: var(--danger);
  }

  .card--paused {
    opacity: 0.65;
  }

  .card--compact {
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .title strong {
    font-size: var(--text-lg);
  }

  .card--compact .title strong {
    font-size: var(--text-md);
  }

  .dose {
    font-size: var(--text-md);
    white-space: nowrap;
  }

  .status {
    font-size: var(--text-md);
    color: var(--text-dim);
  }

  .status--due {
    color: var(--warn);
    font-weight: 600;
  }

  .status--overdue {
    color: var(--danger);
    font-weight: 600;
  }

  .meta {
    font-size: var(--text-sm);
  }

  .card--due .pill-icon,
  .card--overdue .pill-icon {
    animation: pulse-ring 1.6s var(--ease-out) infinite;
    --pulse: var(--warn);
  }

  .low {
    color: var(--warn);
    font-weight: 600;
  }

  .days {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: var(--space-1);
  }

  .day {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    background: var(--surface-3);
  }

  .day--full {
    background: var(--ok);
  }

  .day--partial {
    background: var(--warn);
  }

  .day--missed {
    background: var(--danger-soft);
    box-shadow: inset 0 0 0 1px var(--danger);
  }

  .rate {
    margin-inline-start: var(--space-2);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .take {
    height: 34px;
  }

  @media (max-width: 560px) {
    .card:not(.card--compact) {
      flex-wrap: wrap;
    }

    .card:not(.card--compact) .actions {
      width: 100%;
    }

    .card:not(.card--compact) .take {
      flex: 1;
    }
  }
</style>
