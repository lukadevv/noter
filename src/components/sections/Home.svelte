<script lang="ts">
  import { onMount } from 'svelte'
  import { liveQuery } from 'dexie'
  import Icon from '../Icon.svelte'
  import ProgressRing from '../ui/ProgressRing.svelte'
  import ActivityHeatmap from '../home/ActivityHeatmap.svelte'
  import WeeklyBars from '../home/WeeklyBars.svelte'
  import TopicBars from '../home/TopicBars.svelte'
  import MiniCalendar from '../home/MiniCalendar.svelte'
  import { db } from '$lib/db/db'
  import type { ActivityDay, Note } from '$lib/db/schema'
  import { notes } from '$lib/stores/notes.svelte'
  import { alerts } from '$lib/stores/alerts.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { meds } from '$lib/meds/store.svelte'
  import { timers } from '$lib/timers/store.svelte'
  import { vaultStatus } from '$lib/secrets/status.svelte'
  import { formatSpan } from '$lib/meds/schedule'
  import { formatClock, formatLength } from '$lib/timers/duration'
  import { activitySince } from '$lib/db/repo/activity'
  import { derivedTitle, preview } from '$lib/db/repo/notes'
  import { streak, sumBetween, taskCounts, weekStart, weeklyTotals } from '$lib/stats/home'
  import { addDays, relativeTime } from '$lib/utils/dates'
  import { todayKey } from '$lib/db/repo/daily'
  import { goTo, openNote, openSettings } from '$lib/nav'
  import { rise } from '$lib/ui/motion.svelte'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    onnewnote: () => void
    ontoday: () => void
    onsearch: () => void
  }

  let { onnewnote, ontoday, onsearch }: Props = $props()

  meds.start()
  timers.start()

  const today = todayKey()
  const thisWeek = weekStart(today)

  // --- Data ------------------------------------------------------------------

  let rows = $state<ActivityDay[]>([])
  let vaultCount = $state(0)
  let vaultExists = $state(false)
  let now = $state(Date.now())

  $effect(() => {
    // Half a year plus a week, the most the heatmap ever shows.
    const subs = [
      liveQuery(() => activitySince(addDays(today, -7 * 27))).subscribe((value) => (rows = value)),
      liveQuery(() => db.secretItems.count()).subscribe((value) => (vaultCount = value)),
      liveQuery(() => db.secretsMeta.count()).subscribe((value) => (vaultExists = value > 0)),
    ]
    return () => subs.forEach((sub) => sub.unsubscribe())
  })

  // Running timers count down here too, so tick while any is running.
  $effect(() => {
    if (timers.running.length === 0) return
    const id = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(id)
  })

  let live = $derived(notes.notes.filter((n) => !n.system))
  let readable = $derived(live.filter((n) => !n.encrypted))

  let stats = $derived.by(() => {
    const words = (r: ActivityDay) => r.words
    const wordsWeek = sumBetween(rows, thisWeek, today, words)
    // The same stretch of last week, so Wednesday is compared with Wednesday.
    const wordsBefore = sumBetween(rows, addDays(thisWeek, -7), addDays(today, -7), words)
    return {
      notes: live.length,
      created: sumBetween(rows, thisWeek, today, (r) => r.created),
      wordsWeek,
      wordsBefore,
      streak: streak(rows, today),
      tasks: taskCounts(live),
    }
  })

  let weekly = $derived(weeklyTotals(rows, today, 12, (r) => r.words))

  let recent = $derived([...readable].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6))
  let pinned = $derived(readable.filter((n) => n.pinned === 1).slice(0, 8))
  let dailyDays = $derived(new Set(live.flatMap((n) => (n.daily ? [n.daily] : []))))

  let tags = $derived(
    [...notes.tagCounts].slice(0, 6).map(([tag, count]) => ({
      key: tag,
      label: `#${tag}`,
      value: count,
      onclick: () => notes.setScope({ kind: 'tag', tag }),
    })),
  )

  let folders = $derived.by(() => {
    // A throwaway tally, not reactive state.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const direct = new Map<string, number>()
    for (const note of live) direct.set(note.folderId, (direct.get(note.folderId) ?? 0) + 1)
    return notes.folders
      .filter((f) => (direct.get(f.id) ?? 0) > 0)
      .map((f) => ({
        key: f.id,
        label: f.name,
        value: direct.get(f.id) ?? 0,
        onclick: () => notes.setScope({ kind: 'folder', id: f.id }),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  })

  let activeMeds = $derived(meds.meds.filter((m) => m.active))

  let widgets = $derived(theme.settings.home.widgets.filter((w) => w.visible).map((w) => w.id))

  // --- Daily note reminder --------------------------------------------------

  let writtenToday = $derived(live.some((n) => n.daily === today && n.body.trim() !== ''))

  // Registered once, not in an effect: registering writes the alert list,
  // which an effect would then depend on and re-run for ever.
  onMount(() =>
    alerts.register('daily', () => {
      const settings = theme.settings
      if (!settings.dailyNotes.homeAlert || settings.home.dailyDismissed === today || writtenToday)
        return []
      return [
        {
          id: 'daily',
          section: 'home',
          tone: 'info',
          icon: 'calendar-days',
          title: t('home.daily.title'),
          body: t('home.daily.body'),
          action: { label: t('home.daily.write'), run: ontoday },
          dismiss: () => theme.update({ home: { ...settings.home, dailyDismissed: today } }),
        },
      ]
    }),
  )

  // --- Helpers ---------------------------------------------------------------

  let greeting = $derived.by(() => {
    const hour = new Date().getHours()
    if (hour < 6) return t('home.greeting.night')
    if (hour < 12) return t('home.greeting.morning')
    if (hour < 19) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  })

  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const compact = new Intl.NumberFormat(undefined, { notation: 'compact' })

  function open(note: Note) {
    openNote(note.id)
  }

  async function openDay(day: string) {
    const note = await notes.openDaily(day, theme.settings.dailyNotes)
    openNote(note.id)
    if (ui.narrow) ui.showPane('note')
  }

  function lockVault() {
    void import('$lib/secrets/store.svelte').then(({ secrets }) => secrets.lock())
  }

  const MED_TONE = {
    first: 'var(--accent)',
    ok: 'var(--ok)',
    soon: 'var(--accent)',
    due: 'var(--warn)',
    overdue: 'var(--danger)',
    paused: 'var(--text-faint)',
  } as const

  function medLine(id: string): string {
    const status = meds.statuses.get(id)
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
  }
</script>

<div class="home" data-testid="home">
  <header class="hero" in:rise>
    <div>
      <p class="date">{dateLine}</p>
      <h1>{greeting}</h1>
    </div>
    <button class="btn btn--ghost" data-testid="customize-home" onclick={() => openSettings('home')}>
      <Icon name="layout-dashboard" size={14} />{t('home.customize')}
    </button>
  </header>

  <div class="actions" in:rise={{ delay: 30 }}>
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

  <div class="widgets">
    {#each widgets as widget, index (widget)}
      {@const delay = Math.min(index, 6) * 40 + 60}
      {#if widget === 'alerts'}
        {#if alerts.all.length > 0}
          <section class="widget widget--wide" in:rise={{ delay }} aria-labelledby="w-alerts">
            <h2 id="w-alerts">{t('home.alerts')}</h2>
            <ul class="alerts">
              {#each alerts.all as alert (alert.id)}
                <li class="alert alert--{alert.tone}">
                  <Icon name={alert.icon} size={18} />
                  <div class="alert-text">
                    <strong>{alert.title}</strong>
                    {#if alert.body}<span class="faint">{alert.body}</span>{/if}
                  </div>
                  {#if alert.action}
                    <button class="btn btn--primary" onclick={alert.action.run}>{alert.action.label}</button
                    >
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
      {:else if widget === 'stats'}
        <section
          class="widget widget--wide tiles"
          in:rise={{ delay }}
          aria-label={t('home.stats.title')}
          data-testid="home-stats"
        >
          <div class="tile">
            <span class="tile-label"><Icon name="notebook" size={14} />{t('home.stats.notes')}</span>
            <span class="tile-value">{compact.format(stats.notes)}</span>
            <span class="tile-note">{t('home.stats.createdThisWeek', { count: stats.created })}</span>
          </div>
          <div class="tile">
            <span class="tile-label"><Icon name="pencil" size={14} />{t('home.stats.words')}</span>
            <span class="tile-value">{compact.format(stats.wordsWeek)}</span>
            {#if stats.wordsBefore > 0 || stats.wordsWeek > 0}
              {@const diff = stats.wordsWeek - stats.wordsBefore}
              <span class="tile-note" class:up={diff > 0}>
                <Icon name={diff >= 0 ? 'arrow-up' : 'arrow-down'} size={12} />
                {t('home.stats.vsLastWeek', { count: Math.abs(diff) })}
              </span>
            {:else}
              <span class="tile-note">{t('home.stats.thisWeek')}</span>
            {/if}
          </div>
          <div class="tile">
            <span class="tile-label"><Icon name="flame" size={14} />{t('home.stats.streak')}</span>
            <span class="tile-value">{stats.streak}</span>
            <span class="tile-note">{t('home.stats.days', { count: stats.streak })}</span>
          </div>
          <div class="tile">
            <span class="tile-label"><Icon name="check-square" size={14} />{t('home.stats.tasks')}</span>
            <span class="tile-value">{stats.tasks.open}</span>
            <span class="tile-note">{t('home.stats.tasksDone', { count: stats.tasks.done })}</span>
          </div>
        </section>
      {:else if widget === 'activity'}
        <section class="widget widget--wide activity" in:rise={{ delay }}>
          <div class="panel">
            <h2>{t('home.activity.title')}</h2>
            <ActivityHeatmap {rows} {today} />
          </div>
          <div class="panel">
            <h2>{t('home.activity.weekly')}</h2>
            <WeeklyBars weeks={weekly} unit="home.activity.words" />
          </div>
        </section>
      {:else if widget === 'calendar'}
        <section class="widget" in:rise={{ delay }}>
          <h2>{t('home.calendar.title')}</h2>
          <MiniCalendar {today} marked={dailyDays} onopen={(day) => void openDay(day)} />
        </section>
      {:else if widget === 'meds'}
        <section class="widget" in:rise={{ delay }} data-testid="home-meds">
          <h2>{t('nav.meds')}</h2>
          {#if activeMeds.length === 0}
            <p class="faint">{t('home.medsEmpty')}</p>
            <button class="btn" onclick={() => goTo('meds')}
              ><Icon name="plus" size={14} />{t('meds.add')}</button
            >
          {:else}
            <ul class="rows">
              {#each activeMeds.slice(0, 4) as med (med.id)}
                {@const status = meds.statuses.get(med.id)}
                <li>
                  <button class="row" onclick={() => goTo('meds')}>
                    <ProgressRing
                      value={status?.progress ?? 0}
                      size={34}
                      stroke={4}
                      color={MED_TONE[status?.state ?? 'first']}
                    >
                      <Icon name="pill" size={13} />
                    </ProgressRing>
                    <span class="row-text">
                      <strong class="truncate">{med.name}</strong>
                      <span class="faint small truncate">{medLine(med.id)}</span>
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {:else if widget === 'timers'}
        <section class="widget" in:rise={{ delay }} data-testid="home-timers">
          <h2>{t('nav.timers')}</h2>
          {#if timers.running.length > 0}
            <ul class="rows">
              {#each timers.running.slice(0, 3) as timer (timer.id)}
                {@const remaining =
                  timer.firedAt > 0
                    ? 0
                    : timer.pausedRemaining !== null
                      ? timer.pausedRemaining
                      : Math.max(0, timer.endAt - now)}
                <li>
                  <button class="row" onclick={() => goTo('timers')}>
                    <Icon name={timer.firedAt > 0 ? 'bell-ring' : 'timer'} size={16} />
                    <span class="row-text">
                      <strong class="truncate">{timer.label || t('timers.timer')}</strong>
                    </span>
                    <span class="clock">{formatClock(remaining)}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
          <div class="presets">
            {#each timers.presets.slice(0, 6) as preset (preset.id)}
              <button
                class="preset"
                style={preset.color ? `--preset: ${preset.color}` : ''}
                title={preset.label}
                onclick={() => void timers.startPreset(preset)}
              >
                {formatLength(preset.seconds)}
              </button>
            {/each}
          </div>
        </section>
      {:else if widget === 'recent'}
        <section class="widget widget--wide" in:rise={{ delay }}>
          <h2>{t('home.recent')}</h2>
          {#if recent.length === 0}
            <p class="faint">{t('home.noNotes')}</p>
          {:else}
            <div class="recent">
              {#each recent as note (note.id)}
                <button class="card" onclick={() => open(note)}>
                  <span class="card-title truncate">{derivedTitle(note)}</span>
                  <span class="card-snippet">{preview(note.body, 90) || t('list.emptyNote')}</span>
                  <span class="card-time faint">{relativeTime(note.updatedAt, Date.now(), t)}</span>
                </button>
              {/each}
            </div>
          {/if}
        </section>
      {:else if widget === 'pinned'}
        {#if pinned.length > 0}
          <section class="widget" in:rise={{ delay }}>
            <h2>{t('home.pinned')}</h2>
            <ul class="rows">
              {#each pinned as note (note.id)}
                <li>
                  <button class="row" onclick={() => open(note)}>
                    <Icon name="pin" size={14} />
                    <span class="row-text"><span class="truncate">{derivedTitle(note)}</span></span>
                  </button>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      {:else if widget === 'topics'}
        {#if tags.length > 0 || folders.length > 0}
          <section class="widget widget--wide activity" in:rise={{ delay }}>
            <div class="panel">
              <h2>{t('home.topics.tags')}</h2>
              {#if tags.length > 0}
                <TopicBars items={tags} describe={(count) => t('home.topics.notes', { count })} />
              {:else}
                <p class="faint small">{t('home.topics.noTags')}</p>
              {/if}
            </div>
            <div class="panel">
              <h2>{t('home.topics.folders')}</h2>
              {#if folders.length > 0}
                <TopicBars items={folders} describe={(count) => t('home.topics.notes', { count })} />
              {:else}
                <p class="faint small">{t('home.topics.noFolders')}</p>
              {/if}
            </div>
          </section>
        {/if}
      {:else if widget === 'vault'}
        <section class="widget" in:rise={{ delay }} data-testid="home-vault">
          <h2>{t('nav.vault')}</h2>
          <div class="vault">
            <span class="vault-icon" class:open={vaultStatus.unlocked}>
              <Icon name={vaultStatus.unlocked ? 'lock-open' : 'lock-keyhole'} size={18} />
            </span>
            <span class="row-text">
              <strong>
                {#if !vaultExists}{t('home.vault.notSet')}{:else if vaultStatus.unlocked}{t(
                    'home.vault.open',
                  )}{:else}{t('home.vault.locked')}{/if}
              </strong>
              {#if vaultExists}<span class="faint small"
                  >{t('home.vault.entries', { count: vaultCount })}</span
                >{/if}
            </span>
            {#if vaultStatus.unlocked}
              <button class="btn" onclick={lockVault}>{t('vault.lock')}</button>
            {:else}
              <button class="btn" onclick={() => goTo('vault')}>
                {vaultExists ? t('vault.unlock') : t('home.vault.setUp')}
              </button>
            {/if}
          </div>
        </section>
      {/if}
    {/each}
  </div>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 68rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
  }

  .hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
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

  .widgets {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: var(--space-4);
    align-items: start;
  }

  .widget {
    min-width: 0;
  }

  .widget--wide {
    grid-column: 1 / -1;
  }

  .panel,
  .widget:not(.widget--wide),
  .tile {
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tile-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  .tile-label :global(svg) {
    color: var(--accent);
  }

  .tile-value {
    font-size: var(--text-3xl);
    font-weight: 650;
    line-height: 1.2;
  }

  .tile-note {
    display: flex;
    align-items: center;
    gap: 2px;
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .tile-note.up {
    color: var(--ok);
  }

  .activity {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: var(--space-4);
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

  .rows {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row {
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

  .row:hover {
    background: var(--surface-2);
  }

  .row > :global(svg) {
    flex-shrink: 0;
    color: var(--accent);
  }

  .row-text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .small {
    font-size: var(--text-sm);
  }

  .clock {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .presets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .preset {
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-inline-start: 3px solid var(--preset, var(--accent));
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--text);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .preset:hover {
    border-color: var(--border-strong);
    border-inline-start-color: var(--preset, var(--accent));
  }

  .vault {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .vault-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius);
    background: var(--surface-3);
    color: var(--text-dim);
  }

  .vault-icon.open {
    background: var(--warn-soft);
    color: var(--warn);
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

    .activity {
      grid-template-columns: 1fr;
    }
  }
</style>
