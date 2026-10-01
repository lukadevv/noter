<script lang="ts">
  import Icon from './Icon.svelte'
  import Editor from './Editor.svelte'
  import ReadingView from './ReadingView.svelte'
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
  import { t } from '$lib/i18n/index.svelte'
  import { menu } from '$lib/stores/menu.svelte'
  import { dialogs } from '$lib/stores/dialogs.svelte'
  import { noteMenuItems } from '$lib/menus/note'
  import { contextmenu } from '$lib/ui/contextmenu'
  import { formatShortcut } from '$lib/ui/keys'
  import { pop } from '$lib/ui/motion.svelte'

  let note = $derived(notes.activeNote)
  let dropActive = $state(false)
  /** Title as it was when the field gained focus, so renames can repoint links. */
  let titleBeforeEdit = ''

  /**
   * Plaintext of the open note. For an ordinary note this is just its body,
   * derived synchronously so it can never lag behind the note it belongs to -
   * the editor must never see one note's id paired with another note's text.
   * For a note in a locked folder it is the decrypted text, which only exists
   * in memory while the folder is unlocked, tagged with the note it came from.
   */
  let revealed = $state<{ id: string; title: string; body: string } | null>(null)

  $effect(() => {
    const current = note
    const unlocked = keyring.unlocked
    if (!current || current.encrypted !== 1) return
    void unlocked
    let cancelled = false
    void notes.reveal(current).then((plain) => {
      if (!cancelled) revealed = plain ? { id: current.id, ...plain } : null
    })
    return () => {
      cancelled = true
    }
  })

  let content = $derived.by<{ title: string; body: string } | null>(() => {
    if (!note) return null
    if (note.encrypted !== 1) return { title: note.title, body: note.body }
    return revealed?.id === note.id ? revealed : null
  })

  let locked = $derived(note?.encrypted === 1 && content === null)
  let text = $derived(content?.body ?? '')
  let readOnly = $derived(note !== null && (note.deletedAt > 0 || locked))
  let tasks = $derived(taskStats(text))

  /** Locked for editing by the user (not to be confused with an encrypted folder's lock). */
  let editLocked = $derived(note?.editLock === 1)
  /** Bumped each time a locked note refuses input, to replay the lock's nudge. */
  let nudge = $state(0)
  let hint = $state(false)
  let hintTimer: ReturnType<typeof setTimeout> | undefined

  function refused() {
    nudge++
    hint = true
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => (hint = false), 2400)
  }

  function toggleEditLock() {
    if (!note || readOnly) return
    const next = !editLocked
    void notes.setEditLock(note.id, next)
    hint = false
    ui.toast(t(next ? 'note.lockedToast' : 'note.unlockedToast'), 'info')
  }

  function onKeydown(event: KeyboardEvent) {
    if (!note || ui.section !== 'notes') return
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault()
      toggleEditLock()
    }
  }

  function write(id: string, body: string) {
    notes.editBody(id, body, content?.title ?? note?.title ?? '')
  }

  function append(id: string, snippets: string[]) {
    if (snippets.length === 0 || !note) return
    const trimmed = text.replace(/\s+$/, '')
    write(id, `${trimmed}${trimmed ? '\n\n' : ''}${snippets.join('\n')}`)
    // A discrete action, not typing: save it now rather than after the debounce.
    void notes.flushPending()
  }

  async function onDrop(event: DragEvent) {
    dropActive = false
    if (!note || readOnly || editLocked) return
    const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    event.preventDefault()
    append(note.id, await insertImages(files, 'file'))
  }

  /** The note menu, plus what only the open note can do (it holds the plaintext). */
  function menuItems(): MenuItem[] {
    if (!note) return []
    const current = note
    if (current.deletedAt) return noteMenuItems(current)
    return noteMenuItems(current, {
      extra: [
        {
          id: 'images',
          separatorBefore: true,
          label: t('note.menu.addImages'),
          icon: 'image',
          run: async () => append(current.id, await pickImages()),
        },
      ],
    }).map((item) =>
      item.id === 'share' && locked
        ? { ...item, run: () => ui.toast(t('toast.unlockToShare'), 'warn') }
        : item,
    )
  }

  function openMenu(event: MouseEvent) {
    menu.open(menuItems(), event.currentTarget as HTMLElement, t('note.noteActions'))
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
    <header class="head" use:contextmenu={menuItems}>
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
        readonly={editLocked}
        onfocus={() => (titleBeforeEdit = derivedTitle(current))}
        oninput={(e) => {
          // Titles go through the same debounced, sealed write as the body: a
          // direct write per keystroke would store an encrypted note's title in
          // plaintext until the next body save.
          const title = e.currentTarget.value
          // An encrypted note's store copy lags until the sealed write lands;
          // keep the revealed copy current so the next body save keeps this title.
          if (revealed?.id === current.id) revealed = { ...revealed, title }
          notes.editBody(current.id, text, title)
        }}
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

        {#if !readOnly}
          <span class="lock-wrap">
            {#if hint && editLocked}
              <span class="lock-hint" role="status" transition:pop>{t('note.lockedHint')}</span>
            {/if}
            {#key nudge}
              <button
                class="btn btn--ghost btn--icon lock"
                class:lock--on={editLocked}
                class:lock--nudge={nudge > 0}
                data-testid="edit-lock"
                aria-pressed={editLocked}
                aria-label={t(editLocked ? 'note.unlockEditing' : 'note.lockEditing')}
                title="{t(editLocked ? 'note.unlockEditing' : 'note.lockEditing')} ({formatShortcut(
                  'Mod+Shift+L',
                )})"
                onclick={toggleEditLock}
              >
                <Icon name={editLocked ? 'lock-keyhole' : 'lock-open'} size={16} />
              </button>
            {/key}
          </span>
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
      {:else if readOnly}
        <ReadingView
          body={text}
          {readOnly}
          onchange={(b) => write(current.id, b)}
          onlink={(target) => void notes.openLink(target)}
        />
      {:else}
        <!-- One editor for every note: it swaps per-note states instead of
             remounting, so cursor, scroll and undo survive switching notes. -->
        <Editor
          noteId={current.id}
          body={text}
          locked={editLocked}
          lineNumbers={theme.settings.showLineNumbers}
          insertBar={theme.settings.showInsertBar}
          onchange={(body) => notes.editBody(current.id, body, content?.title ?? current.title)}
          onflush={() => notes.flushPending()}
          onblocked={refused}
          onlink={(target) => void notes.openLink(target)}
          onimages={(files) => insertImages(files)}
          onurl={(url) => insertUrl(url)}
          titles={() => notes.notes.filter((n) => !n.encrypted).map((n) => derivedTitle(n))}
          tags={() => [...notes.tagCounts.keys()]}
          onpickimages={() => pickImages()}
        />
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

{#if note && dialogs.is('history', note.id)}
  <Lazy
    load={() => import('./HistoryDialog.svelte')}
    props={{
      noteId: note.id,
      currentTitle: content?.title ?? note.title,
      currentBody: text,
      onclose: () => dialogs.close(),
    }}
  />
{/if}

{#if note && !locked && dialogs.is('share', note.id)}
  <Lazy
    load={() => import('./ShareDialog.svelte')}
    props={{
      note: { ...note, title: content?.title ?? note.title },
      body: text,
      onclose: () => dialogs.close(),
    }}
  />
{/if}

<svelte:window onkeydown={onKeydown} />

<style>
  .lock-wrap {
    position: relative;
    display: inline-flex;
  }

  .lock--on {
    color: var(--warn);
  }

  .lock--nudge {
    animation: nudge 360ms var(--ease-out);
  }

  @keyframes nudge {
    20% {
      transform: translateX(-3px) rotate(-8deg);
    }
    40% {
      transform: translateX(3px) rotate(6deg);
    }
    60% {
      transform: translateX(-2px) rotate(-4deg);
    }
    80% {
      transform: translateX(1px);
    }
  }

  .lock-hint {
    position: absolute;
    top: calc(100% + 6px);
    inset-inline-end: 0;
    z-index: var(--z-sticky);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-3);
    box-shadow: var(--shadow-2);
    color: var(--text);
    font-size: var(--text-sm);
    white-space: nowrap;
  }

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
