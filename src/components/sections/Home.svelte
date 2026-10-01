<script lang="ts">
  import { onMount } from 'svelte'
  import { liveQuery } from 'dexie'
  import Icon from '../Icon.svelte'
  import Card from '../ui/Card.svelte'
  import StatTile from '../ui/StatTile.svelte'
  import ActivityHeatmap from '../home/ActivityHeatmap.svelte'
  import TodayAgenda from '../home/TodayAgenda.svelte'
  import QuickStart from '../home/QuickStart.svelte'
  import HabitsWidget from '../home/HabitsWidget.svelte'
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
  import { habits } from '$lib/habits/store.svelte'
  import { vaultStatus } from '$lib/secrets/status.svelte'
  import { isScheduled } from '$lib/habits/schedule'
  import { packRows } from '$lib/home/layout'
  import type { HomeWidget } from '$lib/db/repo/settings'
  import { activitySince } from '$lib/db/repo/activity'
  import { derivedTitle, preview } from '$lib/db/repo/notes'
  import { streak, sumBetween, taskCounts, weekStart, weeklyTotals } from '$lib/stats/home'
  import { addDays, relativeTime } from '$lib/utils/dates'
  import { todayKey } from '$lib/db/repo/daily'
  import { goTo, openNote, openSettings } from '$lib/nav'
  import { navigate } from '../../routes/router'
  import { press } from '$lib/ui/press'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    onnewnote: () => void
    ontoday: () => void
    onsearch: () => void
  }

  let { onnewnote, ontoday, onsearch }: Props = $props()

  meds.start()
  timers.start()
  habits.start()

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
    if (!timers.running.some((timer) => timer.pausedRemaining === null && timer.firedAt === 0)) return
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
  let weeklyCreated = $derived(weeklyTotals(rows, today, 12, (r) => r.created).map((w) => w.value))
  let weeklyEdits = $derived(weeklyTotals(rows, today, 12, (r) => r.edits).map((w) => w.value))

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

  /** Preferred width of each widget, out of 12 columns. */
  const SPAN: Record<HomeWidget, number> = {
    alerts: 12,
    today: 8,
    calendar: 4,
    stats: 12,
    focus: 4,
    recent: 8,
    pinned: 4,
    habits: 8,
    activity: 12,
    topics: 8,
    vault: 4,
  }

  let todayShown = $derived(theme.settings.home.widgets.some((w) => w.id === 'today' && w.visible))

  /** Doses, habits and ringing timers already sit in "Today", with their own buttons. */
  let shownAlerts = $derived(
    todayShown ? alerts.all.filter((a) => !['meds', 'habits', 'timers'].includes(a.section)) : alerts.all,
  )

  /** Widgets with nothing to show are left out, so the layout closes up around them. */
  function hasContent(id: HomeWidget): boolean {
    switch (id) {
      case 'alerts':
        return shownAlerts.length > 0
      case 'pinned':
        return pinned.length > 0
      case 'topics':
        return tags.length > 0 || folders.length > 0
      case 'habits':
        return habits.active.length > 0
      default:
        return true
    }
  }

  let widgets = $derived(
    theme.settings.home.widgets.filter((w) => w.visible && hasContent(w.id)).map((w) => w.id),
  )
  let spans = $derived(packRows(widgets, (id) => SPAN[id]))

  /** "2 doses due · 3 habits to go · 1 timer running" under the greeting. */
  let summary = $derived.by(() => {
    const parts: string[] = []
    const dosesDue = meds.active.filter((m) => {
      const state = meds.statuses.get(m.id)?.state
      return state === 'due' || state === 'overdue'
    }).length
    if (dosesDue) parts.push(t('home.summary.doses', { count: dosesDue }))
    const habitsLeft = habits.active.filter(
      (h) => isScheduled(h, habits.today) && !habits.isDoneOn(h),
    ).length
    if (habitsLeft) parts.push(t('home.summary.habits', { count: habitsLeft }))
    if (timers.running.length) parts.push(t('home.summary.timers', { count: timers.running.length }))
    return parts.length ? parts.join(' · ') : t('home.summary.clear')
  })

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

  async function startFocus() {
    if (!timers.pomodoro) await timers.startPomodoro()
    navigate({ kind: 'timers', tab: 'pomodoro' })
  }
</script>

<div class="home" data-testid="home">
  <header class="hero enter">
    <div class="hero-text">
      <p class="eyebrow date">{dateLine}</p>
      <h1>{greeting}</h1>
      <p class="summary" data-testid="home-summary">{summary}</p>
    </div>
    <button
      class="btn btn--ghost"
      data-testid="customize-home"
      data-tour="customize-home"
      onclick={() => openSettings('home')}
    >
      <Icon name="layout-dashboard" size={14} />{t('home.customize')}
    </button>
  </header>

  <div class="actions enter" style="--i: 1" data-tour="home-actions">
    <button class="action action--primary" use:press onclick={onnewnote}>
      <Icon name="plus" size={16} />
      <span>{t('list.newNote')}</span>
    </button>
    <button class="action" use:press onclick={ontoday}>
      <Icon name="calendar-days" size={16} />
      <span>{t('actions.openToday')}</span>
    </button>
    <button class="action" use:press onclick={() => void startFocus()}>
      <Icon name="target" size={16} />
      <span>{t('home.focus.start')}</span>
    </button>
    <button class="action" use:press onclick={onsearch}>
      <Icon name="search" size={16} />
      <span>{t('nav.search')}</span>
    </button>
  </div>

  <div class="grid">
    {#each widgets as widget, index (widget)}
      {@const i = Math.min(index, 8) + 2}
      <div class="cell" style="--span: {spans.get(widget) ?? 12}">
        {#if widget === 'alerts'}
          <Card title={t('home.alerts')} icon="bell" tone="var(--warn)" index={i} testid="home-alerts">
            <ul class="alerts">
              {#each shownAlerts as alert (alert.id)}
                <li class="alert alert--{alert.tone}">
                  <Icon name={alert.icon} size={16} />
                  <div class="alert-text">
                    <strong>{alert.title}</strong>
                    {#if alert.body}<span class="faint">{alert.body}</span>{/if}
                  </div>
                  {#if alert.action}
                    <button class="btn btn--primary btn--pill" onclick={alert.action.run}
                      >{alert.action.label}</button
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
          </Card>
        {:else if widget === 'today'}
          <Card title={t('home.today.title')} icon="sun" tone="var(--warn)" index={i} testid="home-today">
            <TodayAgenda {now} />
          </Card>
        {:else if widget === 'stats'}
          <div class="tiles" aria-label={t('home.stats.title')} data-testid="home-stats">
            <StatTile
              label={t('home.stats.notes')}
              icon="notebook"
              value={stats.notes}
              format={(v) => compact.format(Math.round(v))}
              note={t('home.stats.createdThisWeek', { count: stats.created })}
              series={weeklyCreated}
              describe={(v) => t('home.topics.notes', { count: v })}
              index={i}
              onclick={() => goTo('notes')}
            />
            {#if stats.wordsBefore > 0 || stats.wordsWeek > 0}
              {@const diff = stats.wordsWeek - stats.wordsBefore}
              <StatTile
                label={t('home.stats.words')}
                icon="pencil"
                value={stats.wordsWeek}
                format={(v) => compact.format(Math.round(v))}
                note={t('home.stats.vsLastWeek', { count: Math.abs(diff) })}
                trend={diff > 0 ? 'up' : diff < 0 ? 'down' : null}
                series={weekly.map((w) => w.value)}
                describe={(v) => t('home.activity.words', { count: v })}
                tone="var(--ok)"
                index={i + 1}
              />
            {:else}
              <StatTile
                label={t('home.stats.words')}
                icon="pencil"
                value={0}
                note={t('home.stats.thisWeek')}
                tone="var(--ok)"
                index={i + 1}
              />
            {/if}
            <StatTile
              label={t('home.stats.streak')}
              icon="flame"
              value={stats.streak}
              note={t('home.stats.days', { count: stats.streak })}
              series={weeklyEdits}
              describe={(v) => t('home.activity.edits', { count: v })}
              tone="var(--warn)"
              index={i + 2}
            />
            <StatTile
              label={t('home.stats.tasks')}
              icon="check-square"
              value={stats.tasks.open}
              note={t('home.stats.tasksDone', { count: stats.tasks.done })}
              tone="var(--danger)"
              index={i + 3}
            />
          </div>
        {:else if widget === 'activity'}
          <Card title={t('home.activity.title')} icon="activity" index={i}>
            <div class="activity">
              <ActivityHeatmap {rows} {today} />
              <div class="weekly">
                <h3 class="eyebrow">{t('home.activity.weekly')}</h3>
                <WeeklyBars weeks={weekly} unit="home.activity.words" />
              </div>
            </div>
          </Card>
        {:else if widget === 'calendar'}
          <Card title={t('home.calendar.title')} icon="calendar-days" tone="var(--ok)" index={i}>
            <MiniCalendar {today} marked={dailyDays} onopen={(day) => void openDay(day)} />
          </Card>
        {:else if widget === 'focus'}
          <Card
            title={t('home.focus.title')}
            icon="timer"
            tone="var(--danger)"
            index={i}
            testid="home-timers"
          >
            {#snippet action()}
              <button class="link" onclick={() => goTo('timers')}>{t('home.seeAll')}</button>
            {/snippet}
            <QuickStart {now} />
          </Card>
        {:else if widget === 'habits'}
          <Card title={t('nav.habits')} icon="target" tone="var(--ok)" index={i} testid="home-habits">
            {#snippet action()}
              <button class="link" onclick={() => goTo('habits')}>{t('home.seeAll')}</button>
            {/snippet}
            <HabitsWidget />
          </Card>
        {:else if widget === 'recent'}
          <Card title={t('home.recent')} icon="history" index={i}>
            {#snippet action()}
              <button class="link" onclick={() => goTo('notes')}>{t('home.seeAll')}</button>
            {/snippet}
            {#if recent.length === 0}
              <div class="nothing">
                <p class="faint">{t('home.noNotes')}</p>
                <button class="btn btn--primary btn--pill" onclick={onnewnote}>
                  <Icon name="plus" size={14} />{t('list.newNote')}
                </button>
              </div>
            {:else}
              <div class="recent">
                {#each recent as note, n (note.id)}
                  {@const folder = notes.folders.find((f) => f.id === note.folderId)}
                  <button
                    class="note-card"
                    style="--i: {n}; --fc: {folder?.color ?? 'var(--border-strong)'}"
                    onclick={() => open(note)}
                  >
                    <span class="note-title truncate">{derivedTitle(note)}</span>
                    <span class="note-snippet">{preview(note.body, 90) || t('list.emptyNote')}</span>
                    <span class="note-meta">
                      {#if folder}<span class="folder truncate">{folder.name}</span>{/if}
                      <span class="faint">{relativeTime(note.updatedAt, Date.now(), t)}</span>
                    </span>
                  </button>
                {/each}
              </div>
            {/if}
          </Card>
        {:else if widget === 'pinned'}
          <Card title={t('home.pinned')} icon="pin" index={i}>
            <ul class="rows">
              {#each pinned as note (note.id)}
                <li>
                  <button class="row" onclick={() => open(note)}>
                    <Icon name="file-text" size={14} />
                    <span class="row-text"><span class="truncate">{derivedTitle(note)}</span></span>
                  </button>
                </li>
              {/each}
            </ul>
          </Card>
        {:else if widget === 'topics'}
          <Card title={t('home.topics.title')} icon="tag" index={i}>
            <div class="topics">
              <div>
                <h3 class="eyebrow">{t('home.topics.tags')}</h3>
                {#if tags.length > 0}
                  <TopicBars items={tags} describe={(count) => t('home.topics.notes', { count })} />
                {:else}
                  <p class="faint small">{t('home.topics.noTags')}</p>
                {/if}
              </div>
              <div>
                <h3 class="eyebrow">{t('home.topics.folders')}</h3>
                {#if folders.length > 0}
                  <TopicBars items={folders} describe={(count) => t('home.topics.notes', { count })} />
                {:else}
                  <p class="faint small">{t('home.topics.noFolders')}</p>
                {/if}
              </div>
            </div>
          </Card>
        {:else if widget === 'vault'}
          <Card title={t('nav.vault')} icon="shield" tone="var(--accent)" index={i} testid="home-vault">
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
                <button class="btn btn--pill" onclick={lockVault}>{t('vault.lock')}</button>
              {:else}
                <button class="btn btn--pill" onclick={() => goTo('vault')}>
                  {vaultExists ? t('vault.unlock') : t('home.vault.setUp')}
                </button>
              {/if}
            </div>
          </Card>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 72rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5) var(--space-6);
  }

  .hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .date {
    text-transform: capitalize;
  }

  h1 {
    font-size: 36px;
    font-weight: 740;
    letter-spacing: -0.025em;
    line-height: 1.1;
  }

  .summary {
    color: var(--text-dim);
    font-size: var(--text-lg);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .action {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 38px;
    padding: 0 var(--space-4);
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--text);
    font-weight: 550;
    cursor: pointer;
    transition:
      transform var(--dur-1) var(--ease-out),
      border-color var(--dur-2),
      background var(--dur-2);
  }

  .action :global(svg) {
    color: var(--text-dim);
  }

  .action:hover {
    border-color: var(--border-strong);
    background: var(--surface-2);
  }

  .action:active {
    transform: scale(0.96);
  }

  .action--primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .action--primary :global(svg) {
    color: inherit;
  }

  .action--primary:hover {
    border-color: var(--accent-hover);
    background: var(--accent-hover);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: var(--space-4);
    align-items: stretch;
  }

  .cell {
    grid-column: span var(--span);
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .cell > :global(*) {
    flex: 1;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .link {
    padding: 2px var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .link:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .activity {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: var(--space-5);
    align-items: start;
  }

  .weekly h3,
  .topics h3 {
    margin-bottom: var(--space-2);
  }

  .topics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
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
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    background: var(--accent-soft);
  }

  .alert > :global(svg) {
    flex: none;
    color: var(--accent);
  }

  .alert--warn {
    background: var(--warn-soft);
  }

  .alert--warn > :global(svg) {
    color: var(--warn);
  }

  .alert--danger {
    background: var(--danger-soft);
  }

  .alert--danger > :global(svg) {
    color: var(--danger);
  }

  .alert--ok {
    background: var(--ok-soft);
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
    color: var(--text-faint);
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

  .vault {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .vault-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--surface-3);
    color: var(--text-dim);
  }

  .vault-icon.open {
    background: var(--warn-soft);
    color: var(--warn);
  }

  .nothing {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .recent {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: var(--space-3);
  }

  .note-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-height: 118px;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-top: 3px solid var(--fc);
    border-radius: var(--radius);
    background: var(--bg-2);
    color: var(--text);
    text-align: start;
    cursor: pointer;
    animation: enter-rise 420ms var(--ease-out) both;
    animation-delay: calc(var(--i) * 40ms + 150ms);
    transition:
      transform var(--dur-2) var(--ease-out),
      border-color var(--dur-2),
      box-shadow var(--dur-2);
  }

  .note-card:hover {
    transform: translateY(-2px);
    border-color: var(--border-strong);
    border-top-color: var(--fc);
    box-shadow: var(--shadow-2);
  }

  .note-card:active {
    transform: scale(0.98);
  }

  .note-title {
    font-weight: 620;
  }

  .note-snippet {
    flex: 1;
    color: var(--text-dim);
    font-size: var(--text-md);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .note-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  .folder {
    color: var(--text-dim);
  }

  @media (max-width: 1000px) {
    .tiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 860px) {
    .home {
      padding: var(--space-5) var(--space-4);
    }

    h1 {
      font-size: var(--text-2xl);
    }

    .cell {
      grid-column: 1 / -1;
    }

    .activity,
    .topics {
      grid-template-columns: 1fr;
    }

    /* The text gets the full width; the buttons move under it. */
    .alert {
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .alert-text {
      flex-basis: calc(100% - 64px);
    }

    .alert > :global(.btn--primary) {
      margin-inline-start: 28px;
    }
  }
</style>
