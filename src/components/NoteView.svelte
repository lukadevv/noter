<script lang="ts">
  import Icon from './Icon.svelte'
  import Editor from './Editor.svelte'
  import ReadingView from './ReadingView.svelte'
  import ChecklistView from './ChecklistView.svelte'
  import GalleryView from './GalleryView.svelte'
  import BoardView from './BoardView.svelte'
  import CodeView from './CodeView.svelte'
  import Menu from './Menu.svelte'
  import Backlinks from './Backlinks.svelte'
  import Lazy from './Lazy.svelte'
  import type { MenuItem } from '$lib/ui-types'
  import { notes } from '$lib/stores/notes.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { derivedTitle } from '$lib/db/repo/notes'
  import { relativeTime } from '$lib/utils/dates'
  import { taskStats } from '$lib/md/tasks'
  import { insertImages, insertUrl, pickImages } from '$lib/images/insert'
  import { addDays } from '$lib/utils/dates'
  import { keyring } from '$lib/crypto/keyring.svelte'
  import UnlockPrompt from './UnlockPrompt.svelte'
  import type { ViewMode } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  let note = $derived(notes.activeNote)
  let mode = $state<'edit' | 'read'>('edit')
  let menu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null)
  let dropActive = $state(false)
  let historyOpen = $state(false)
  let shareOpen = $state(false)
  /** Title as it was when the field gained focus, so renames can repoint links. */
  let titleBeforeEdit = ''

  /**
   * Plaintext of the open note. For an ordinary note this is just its body; for
   * one in a locked folder it is the decrypted text, which only exists in memory
   * while the folder is unlocked.
   */
  let content = $state<{ title: string; body: string } | null>(null)

  $effect(() => {
    const current = note
    const unlocked = keyring.unlocked
    if (!current) {
      content = null
      return
    }
    if (current.encrypted !== 1) {
      content = { title: current.title, body: current.body }
      return
    }
    void unlocked
    let cancelled = false
    void notes.reveal(current).then((revealed) => {
      if (!cancelled) content = revealed
    })
    return () => {
      cancelled = true
    }
  })

  let locked = $derived(note?.encrypted === 1 && content === null)
  let text = $derived(content?.body ?? '')
  let readOnly = $derived(note !== null && (note.deletedAt > 0 || locked))
  let tasks = $derived(taskStats(text))

  const VIEWS: { id: ViewMode; icon: string }[] = [
    { id: 'doc', icon: 'file-text' },
    { id: 'checklist', icon: 'check-square' },
    { id: 'board', icon: 'layout-grid' },
    { id: 'gallery', icon: 'image' },
    { id: 'code', icon: 'code' },
  ]

  /** Only the document view has a separate reading mode; the rest render directly. */
  let showsReadToggle = $derived(note?.view === 'doc')

  function write(id: string, body: string) {
    notes.editBody(id, body, content?.title ?? note?.title ?? '')
  }

  function append(id: string, snippets: string[]) {
    if (snippets.length === 0 || !note) return
    const trimmed = text.replace(/\s+$/, '')
    write(id, `${trimmed}${trimmed ? '\n\n' : ''}${snippets.join('\n')}`)
  }

  async function onDrop(event: DragEvent) {
    dropActive = false
    if (!note || readOnly) return
    const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    event.preventDefault()
    append(note.id, await insertImages(files, 'file'))
  }

  function openMenu(event: MouseEvent) {
    if (!note) return
    const current = note
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()

    const viewItems: MenuItem[] = VIEWS.map((view, index) => ({
      label: `${t(`note.views.${view.id}`)}${current.view === view.id ? ' ✓' : ''}`,
      icon: view.icon,
      separatorBefore: index === 0,
      run: () => void notes.update(current.id, { view: view.id }),
    }))

    menu = {
      x: rect.right - 200,
      y: rect.bottom + 4,
      items: current.deletedAt
        ? [
            { label: t('common.restore'), icon: 'restore', run: () => void notes.restore(current.id) },
            {
              label: t('note.menu.deleteForever'),
              icon: 'trash',
              danger: true,
              separatorBefore: true,
              run: () => void notes.deleteForever(current.id),
            },
          ]
        : [
            {
              label: t(current.pinned ? 'note.menu.unpin' : 'note.menu.pin'),
              icon: 'pin',
              run: () => void notes.togglePin(current.id),
            },
            {
              label: t(current.archivedAt ? 'note.menu.unarchive' : 'note.menu.archive'),
              icon: 'archive',
              run: () => void notes.setArchived(current.id, current.archivedAt === 0),
            },
            ...viewItems,
            {
              label: t('note.menu.addImages'),
              icon: 'image',
              separatorBefore: true,
              run: async () => append(current.id, await pickImages()),
            },
            { label: t('note.menu.history'), icon: 'restore', run: () => (historyOpen = true) },
            {
              label: t('note.menu.share'),
              icon: 'link',
              run: () => {
                if (locked) ui.toast(t('toast.unlockToShare'), 'warn')
                else shareOpen = true
              },
            },
            {
              label: t('note.menu.trash'),
              icon: 'trash',
              danger: true,
              separatorBefore: true,
              run: () => {
                void notes.trash(current.id)
                ui.toast(t('toast.movedToTrash'), 'info', {
                  label: t('toast.undo'),
                  run: () => void notes.restore(current.id),
                })
              },
            },
          ],
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
  class="note"
  class:note--drop={dropActive}
  ondragover={(e) => {
    if (!note || readOnly) return
    if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return
    e.preventDefault()
    dropActive = true
  }}
  ondragleave={(e) => {
    if (e.currentTarget === e.target) dropActive = false
  }}
  ondrop={onDrop}
>
  {#if note}
    {@const current = note}
    <header class="head">
      {#if ui.narrow}
        <button
          class="btn btn--ghost btn--icon"
          aria-label={t('note.backToList')}
          onclick={() => ui.back()}
        >
          <Icon name="chevron-right" size={16} class="flip" />
        </button>
      {/if}

      <input
        class="title"
        data-testid="note-title"
        value={locked ? '' : (content?.title ?? current.title)}
        placeholder={locked
          ? t('list.lockedNote')
          : derivedTitle({ title: content?.title ?? '', body: text })}
        disabled={readOnly}
        onfocus={() => (titleBeforeEdit = derivedTitle(current))}
        oninput={(e) => void notes.update(current.id, { title: e.currentTarget.value })}
        onkeydown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        onblur={async (e) => {
          // Committing on blur rather than on `change`: `change` only fires when
          // the browser saw the field as user-edited, which misses programmatic
          // edits and autofill. `retitle` is a no-op when the title is unchanged.
          //
          // The value is read up front: `currentTarget` is nulled once the event
          // finishes dispatching, so touching it after an await throws.
          const value = e.currentTarget.value
          const previous = titleBeforeEdit
          titleBeforeEdit = value

          const updated = await notes.retitle(current.id, previous, value)
          if (updated > 0) ui.toast(t('toast.linksUpdated', { count: updated }), 'ok')
        }}
      />

      <div class="actions">
        {#if tasks.total > 0}
          <span class="stamp faint numeric">{tasks.done}/{tasks.total}</span>
        {/if}
        <span class="stamp faint">{relativeTime(current.updatedAt, Date.now(), t)}</span>

        {#if showsReadToggle}
          <button
            class="btn btn--ghost btn--icon"
            aria-label={t(mode === 'edit' ? 'note.readingView' : 'note.editingView')}
            title={t(mode === 'edit' ? 'note.readingView' : 'note.editingView')}
            onclick={() => (mode = mode === 'edit' ? 'read' : 'edit')}
          >
            <Icon name={mode === 'edit' ? 'file-text' : 'pencil'} size={16} />
          </button>
        {/if}

        <button
          class="btn btn--ghost btn--icon"
          class:pinned={current.pinned === 1}
          aria-label={t(current.pinned ? 'note.unpin' : 'note.pin')}
          onclick={() => void notes.togglePin(current.id)}
        >
          <Icon name="pin" size={16} />
        </button>
        <button
          class="btn btn--ghost btn--icon"
          aria-label={t('note.noteActions')}
          data-testid="note-menu"
          onclick={openMenu}
        >
          <Icon name="more" size={16} />
        </button>
      </div>
    </header>

    {#if current.daily}
      <nav class="daily" aria-label="Daily note navigation">
        <button
          class="btn btn--ghost btn--icon"
          aria-label={t('note.previousDay')}
          onclick={() => void notes.openDaily(addDays(current.daily!, -1), theme.settings.dailyNotes)}
        >
          <Icon name="chevron-right" size={15} class="flip" />
        </button>
        <span class="day">{current.daily}</span>
        <button
          class="btn btn--ghost btn--icon"
          aria-label={t('note.nextDay')}
          onclick={() => void notes.openDaily(addDays(current.daily!, 1), theme.settings.dailyNotes)}
        >
          <Icon name="chevron-right" size={15} />
        </button>
      </nav>
    {/if}

    <nav class="views" aria-label={t('note.view')}>
      {#each VIEWS as view (view.id)}
        <button
          class="view"
          data-testid="view-tab-{view.id}"
          class:view--active={current.view === view.id}
          disabled={readOnly}
          title={t(`note.views.${view.id}`)}
          onclick={() => void notes.update(current.id, { view: view.id })}
        >
          <Icon name={view.icon} size={14} />
          <span class="view-label">{t(`note.views.${view.id}`)}</span>
        </button>
      {/each}
    </nav>

    {#if current.deletedAt > 0}
      <div class="banner">
        <Icon name="trash" size={14} />
        <span>{t('note.inTrash')}</span>
        <button class="btn btn--ghost" onclick={() => void notes.restore(current.id)}>
          {t('common.restore')}
        </button>
      </div>
    {/if}

    <div class="body">
      {#if locked}
        <UnlockPrompt folderId={current.folderId} />
      {:else if current.view === 'checklist'}
        <ChecklistView body={text} {readOnly} onchange={(b) => write(current.id, b)} />
      {:else if current.view === 'board'}
        <BoardView body={text} {readOnly} onchange={(b) => write(current.id, b)} />
      {:else if current.view === 'gallery'}
        <GalleryView body={text} {readOnly} onadd={async () => append(current.id, await pickImages())} />
      {:else if current.view === 'code'}
        <CodeView
          body={text}
          lang={current.lang}
          {readOnly}
          onchange={(b) => write(current.id, b)}
          onlang={(lang) => void notes.update(current.id, { lang })}
        />
      {:else if mode === 'read' || readOnly}
        <ReadingView
          body={text}
          {readOnly}
          onchange={(b) => write(current.id, b)}
          onlink={(target) => void notes.openLink(target)}
        />
      {:else}
        {#key current.id}
          <Editor
            noteId={current.id}
            body={text}
            lineNumbers={theme.settings.showLineNumbers}
            onchange={(body) => notes.editBody(current.id, body, content?.title ?? current.title)}
            onflush={() => notes.flushPending()}
            onimages={(files) => insertImages(files)}
            onurl={(url) => insertUrl(url)}
            titles={() => notes.notes.map((n) => derivedTitle(n))}
            tags={() => [...notes.tagCounts.keys()]}
          />
        {/key}
      {/if}
    </div>

    {#if !locked}
      <Backlinks noteId={current.id} />
    {/if}

    {#if dropActive}
      <div class="dropzone">
        <Icon name="image" size={20} />
        <span>{t('note.dropImages')}</span>
      </div>
    {/if}
  {:else}
    <div class="placeholder">
      <Icon name="notebook" size={26} />
      <p class="faint">{t('note.selectOrCreate')}</p>
      <button class="btn btn--primary" data-testid="new-note-empty" onclick={() => void notes.newNote()}>
        <Icon name="plus" size={15} />
        {t('list.newNote')}
      </button>
    </div>
  {/if}
</section>

{#if menu}
  <Menu items={menu.items} x={menu.x} y={menu.y} onclose={() => (menu = null)} />
{/if}

{#if historyOpen && note}
  <Lazy
    load={() => import('./HistoryDialog.svelte')}
    props={{
      noteId: note.id,
      currentTitle: content?.title ?? note.title,
      currentBody: text,
      onclose: () => (historyOpen = false),
    }}
  />
{/if}

{#if shareOpen && note && !locked}
  <Lazy
    load={() => import('./ShareDialog.svelte')}
    props={{
      note: { ...note, title: content?.title ?? note.title },
      body: text,
      onclose: () => (shareOpen = false),
    }}
  />
{/if}

<style>
  .note {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--bg);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: calc(44px * var(--density));
    padding: 0 var(--space-2) 0 var(--space-3);
  }

  .head :global(.flip) {
    transform: rotate(180deg);
  }

  .title {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: transparent;
    font-size: 15px;
    font-weight: 600;
  }

  .title:hover:not(:disabled) {
    border-color: var(--border);
  }

  .title:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg-2);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }

  .stamp {
    margin-inline-end: var(--space-2);
    font-size: 11px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .pinned {
    color: var(--accent);
  }

  /* View switcher: labels collapse away on narrow screens, icons remain. */
  .views {
    display: flex;
    gap: 2px;
    padding: 0 var(--space-3) var(--space-2);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .views::-webkit-scrollbar {
    display: none;
  }

  .view {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: none;
    height: 26px;
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius);
    background: none;
    color: var(--text-faint);
    font-size: 12px;
    cursor: pointer;
  }

  .view:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--text);
  }

  .view--active {
    background: var(--accent-soft);
    color: var(--text);
  }

  .view:disabled {
    cursor: default;
    opacity: 0.5;
  }

  @media (max-width: 640px) {
    .view-label {
      display: none;
    }

    .view {
      padding: 0 var(--space-3);
    }
  }

  .daily {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding-bottom: var(--space-2);
    color: var(--text-dim);
  }

  .day {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 12px;
    border-bottom: 1px solid var(--border);
  }

  .banner span {
    flex: 1;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding-top: var(--space-3);
  }

  .note--drop {
    outline: 2px dashed var(--accent);
    outline-offset: -6px;
  }

  .dropzone {
    position: absolute;
    inset: auto 0 var(--space-5) 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    pointer-events: none;
    color: var(--accent);
    font-size: 13px;
  }

  .placeholder {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    color: var(--text-faint);
  }
</style>
