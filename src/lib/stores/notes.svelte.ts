/*
 * The Maps below are derived values, rebuilt whole on every recomputation and
 * never mutated in place, so a reactive SvelteMap would add overhead without
 * changing behaviour.
 */
/* eslint-disable svelte/prefer-svelte-reactivity */
import { liveQuery, type Subscription } from 'dexie'
import { ROOT, type Folder, type Note, type SmartFolder } from '$lib/db/schema'
import { buildTree, flattenTree, type FolderNode } from '$lib/db/repo/folders'
import { sortForList } from '$lib/db/repo/notes'
import * as notesRepo from '$lib/db/repo/notes'
import * as foldersRepo from '$lib/db/repo/folders'
import { debounce } from '$lib/utils/debounce'
import * as smartRepo from '$lib/db/repo/smartFolders'
import * as dailyRepo from '$lib/db/repo/daily'
import { buildBacklinks, extractTags, linkKey, renameWikiLinks, type BacklinkEntry } from '$lib/md/links'
import { searchIndex } from '$lib/search/index'
import {
  FolderLockedError,
  keyring,
  recryptForFolder,
  revealInFolder,
  revealNote,
  sealNote,
} from '$lib/crypto/keyring.svelte'
import { buildContext, matches } from '$lib/search/evaluate'
import { parseQuery, textTerms } from '$lib/search/query'
import { ui } from '$lib/stores/ui.svelte'

export type ListScope =
  | { kind: 'folder'; id: string | null }
  | { kind: 'trash' }
  | { kind: 'archive' }
  | { kind: 'tag'; tag: string }
  | { kind: 'smart'; id: string }
  | { kind: 'search'; query: string }

/**
 * Holds the whole live note set in memory.
 *
 * The trade-off is deliberate: a personal notebook is thousands of records, not
 * millions, and keeping them resident makes list rendering, counts, search
 * indexing and backlinks synchronous. If a store ever outgrows this, only this
 * class and the repos change — components read through the derived getters.
 */
class NotesStore {
  folders = $state<Folder[]>([])
  smartFolders = $state<SmartFolder[]>([])
  notes = $state<Note[]>([])
  trashed = $state<Note[]>([])
  archived = $state<Note[]>([])
  loading = $state(true)

  scope = $state<ListScope>({ kind: 'folder', id: null })
  selectedNoteId = $state<string | null>(null)
  /** Ids checked for a bulk action. Empty means "no multi-selection active". */
  marked = $state<string[]>([])

  #subs: Subscription[] = []

  tree: FolderNode[] = $derived(buildTree(this.folders))
  visibleFolders: FolderNode[] = $derived(flattenTree(this.tree))

  /** Note count per folder, including nested folders. */
  counts: Map<string, number> = $derived.by(() => {
    const direct = new Map<string, number>()
    for (const note of this.notes) {
      direct.set(note.folderId, (direct.get(note.folderId) ?? 0) + 1)
    }
    const total = new Map<string, number>()
    const walk = (node: FolderNode): number => {
      let sum = direct.get(node.id) ?? 0
      for (const child of node.children) sum += walk(child)
      total.set(node.id, sum)
      return sum
    }
    for (const root of this.tree) walk(root)
    return total
  })

  /** Tag to note count, across live notes. */
  tagCounts: Map<string, number> = $derived.by(() => {
    const counts = new Map<string, number>()
    for (const note of this.notes) {
      for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return new Map([...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
  })

  /** "Which notes link here", keyed by target note id. */
  backlinks: Map<string, BacklinkEntry[]> = $derived.by(() =>
    buildBacklinks(this.notes, (note) => notesRepo.derivedTitle(note)),
  )

  /** Note titles to ids, for resolving `[[wiki links]]`. */
  titleIndex: Map<string, string> = $derived.by(() => {
    const index = new Map<string, string>()
    for (const note of this.notes) index.set(linkKey(notesRepo.derivedTitle(note)), note.id)
    return index
  })

  templates: Note[] = $derived(this.notes.filter((n) => n.template === 1))

  /** The notes shown in the middle pane for the current scope. */
  listNotes: Note[] = $derived.by(() => {
    const scope = this.scope
    if (scope.kind === 'trash') return this.trashed
    if (scope.kind === 'archive') return this.archived
    if (scope.kind === 'tag') return sortForList(this.notes.filter((n) => n.tags.includes(scope.tag)))
    if (scope.kind === 'smart') {
      const smart = this.smartFolders.find((f) => f.id === scope.id)
      return smart ? this.runQuery(smart.query) : []
    }
    if (scope.kind === 'search') return this.runQuery(scope.query)
    if (scope.id === null) return sortForList(this.notes)
    return sortForList(this.notes.filter((n) => n.folderId === scope.id))
  })

  /**
   * Runs a query string over the note set.
   *
   * Filters are applied by the evaluator, then the surviving notes are ordered
   * by full-text relevance where the query had free words — so `tag:bug parser`
   * both filters and ranks.
   */
  runQuery(query: string): Note[] {
    const { node } = parseQuery(query)
    if (!node) return sortForList(this.notes)

    const context = buildContext(this.folders)
    // A trashed-note query has to look in the trash, not in the live set.
    const wantsTrash = query.includes('is:trashed')
    const wantsArchive = query.includes('is:archived')
    const pool = [
      ...this.notes,
      ...(wantsTrash ? this.trashed : []),
      ...(wantsArchive ? this.archived : []),
    ]

    const filtered = pool.filter((note) => matches(note, node, context))
    const terms = textTerms(node)
    if (terms.length === 0) return sortForList(filtered)

    const scores = searchIndex.scores(terms)
    return [...filtered].sort(
      (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || b.updatedAt - a.updatedAt,
    )
  }

  activeNote: Note | null = $derived(
    this.selectedNoteId === null
      ? null
      : ([...this.notes, ...this.trashed, ...this.archived].find((n) => n.id === this.selectedNoteId) ??
          null),
  )

  activeFolder: Folder | null = $derived.by(() => {
    const scope = this.scope
    if (scope.kind !== 'folder' || !scope.id) return null
    return this.folders.find((f) => f.id === scope.id) ?? null
  })

  /** Opens the live queries. Returns a teardown function. */
  start(): () => void {
    this.#subs.push(
      liveQuery(() => foldersRepo.allFolders()).subscribe((folders) => {
        this.folders = folders
      }),
      liveQuery(() => smartRepo.allSmartFolders()).subscribe((smart) => {
        this.smartFolders = smart
      }),
      liveQuery(() => notesRepo.listAll()).subscribe((notes) => {
        const first = this.loading
        this.notes = notes
        this.loading = false
        // The first load builds the index in idle slices; later changes are
        // reconciled incrementally, which is far cheaper than a rebuild.
        if (first) searchIndex.rebuild(notes)
        else if (searchIndex.ready) searchIndex.sync(notes)
      }),
      liveQuery(() => notesRepo.listTrashed()).subscribe((notes) => {
        this.trashed = notes
      }),
      liveQuery(() => notesRepo.listArchived()).subscribe((notes) => {
        this.archived = notes
      }),
    )
    return () => {
      for (const sub of this.#subs) sub.unsubscribe()
      this.#subs = []
    }
  }

  /**
   * Opening a note or a list always brings the notes section on screen, from
   * whichever section the command came: the palette, Home, a shortcut.
   */
  select(noteId: string | null): void {
    this.selectedNoteId = noteId
    if (noteId !== null) ui.section = 'notes'
  }

  setScope(scope: ListScope): void {
    ui.section = 'notes'
    this.scope = scope
    // A selection made in one folder means nothing in the next one.
    this.marked = []
  }

  isMarked(id: string): boolean {
    return this.marked.includes(id)
  }

  /**
   * Adds or removes a note from the multi-selection.
   *
   * When a selection starts, the note that is already open is folded in first.
   * Every file manager behaves this way: clicking one row and then ctrl-clicking
   * two more selects three, not two, and the highlighted row would otherwise be
   * silently left out of the bulk action.
   */
  toggleMark(id: string): void {
    if (this.marked.length === 0 && this.selectedNoteId && this.selectedNoteId !== id) {
      const anchor = this.selectedNoteId
      const inScope = this.listNotes.some((n) => n.id === anchor)
      this.marked = inScope ? [anchor, id] : [id]
      return
    }
    this.marked = this.isMarked(id) ? this.marked.filter((x) => x !== id) : [...this.marked, id]
  }

  /** Extends the selection from the last marked note to `id`, in list order. */
  markRangeTo(id: string): void {
    const ids = this.listNotes.map((n) => n.id)
    const anchor = this.marked.at(-1) ?? this.selectedNoteId
    const from = anchor ? ids.indexOf(anchor) : -1
    const to = ids.indexOf(id)
    if (from === -1 || to === -1) {
      this.toggleMark(id)
      return
    }
    const [start, end] = from <= to ? [from, to] : [to, from]
    const range = ids.slice(start, end + 1)
    this.marked = [...new Set([...this.marked, ...range])]
  }

  markAll(): void {
    this.marked = this.listNotes.map((n) => n.id)
  }

  clearMarks(): void {
    this.marked = []
  }

  /** Runs a mutation over every marked note, then clears the selection. */
  async applyToMarked(mutate: (id: string) => Promise<void>): Promise<number> {
    const ids = [...this.marked]
    for (const id of ids) await mutate(id)
    this.marked = []
    return ids.length
  }

  /**
   * Creates a note, sealing it first when its folder is encrypted.
   *
   * Every creation path goes through here: a note written in plaintext into a
   * locked folder would sit next to ciphertext looking protected while it isn't.
   * A locked folder refuses new notes with `FolderLockedError`.
   */
  async create(input: notesRepo.NewNoteInput = {}): Promise<Note> {
    const folderId = input.folderId ?? ROOT
    const folder = folderId ? this.folders.find((f) => f.id === folderId) : undefined
    if (folder?.encrypted !== 1) return notesRepo.createNote(input)

    const sealed = await sealNote(folderId, input.title ?? '', input.body ?? '')
    if (!sealed) throw new FolderLockedError(folderId)
    return notesRepo.createNote({ ...input, ...sealed, tags: [], encrypted: 1 })
  }

  async newNote(): Promise<Note> {
    const folderId = this.scope.kind === 'folder' ? (this.scope.id ?? ROOT) : ROOT
    const note = await this.create({ folderId })
    this.select(note.id)
    return note
  }

  /**
   * Moves a note to another folder, re-encrypting it for its destination.
   * Throws `FolderLockedError` when either folder's key is needed but missing.
   */
  async move(id: string, folderId: string, before: string | null = null, after: string | null = null) {
    await this.flushPending()
    const note = await notesRepo.getNote(id)
    if (!note) return
    const patch = (await recryptForFolder(note, folderId)) ?? {}
    await notesRepo.moveNote(id, folderId, before, after, patch)
  }

  /**
   * Body edits are written on a trailing debounce so a burst of keystrokes is a
   * single IndexedDB transaction. `flushPending` runs it early on blur, tab
   * switch and unload, which is what actually guarantees nothing is lost.
   */
  #pendingBody = new Map<
    string,
    { title: string; body: string; tags: string[]; folderId: string; encrypted: boolean }
  >()

  /** Resolves when the most recently started write batch has committed. */
  #inFlight: Promise<void> = Promise.resolve()

  #writeBodies = debounce(() => {
    const pending = [...this.#pendingBody.entries()]
    this.#pendingBody.clear()
    if (pending.length === 0) return

    this.#inFlight = (async () => {
      for (const [id, patch] of pending) {
        if (patch.encrypted) {
          // Sealing happens at write time, not per keystroke: the folder key is
          // already derived, so this is a cheap AES pass on the final text.
          const sealed = await sealNote(patch.folderId, patch.title, patch.body)
          if (!sealed) {
            // The folder locked inside the debounce window. Keep the edit queued
            // rather than dropping it; it is written once the folder is unlocked.
            this.#pendingBody.set(id, patch)
            continue
          }
          await notesRepo.updateNote(id, { ...sealed, tags: [] })
        } else {
          await notesRepo.updateNote(id, {
            title: patch.title,
            body: patch.body,
            tags: patch.tags,
          })
        }
      }
    })()
  }, 400)

  editBody(id: string, body: string, title: string): void {
    const note = this.notes.find((n) => n.id === id)
    const encrypted = note?.encrypted === 1
    // `tags` is a denormalised copy of the `#tags` in the text, kept only so
    // IndexedDB can index them. The markdown stays the source of truth. A
    // locked note contributes no tags at all, so nothing leaks through them.
    const tags = encrypted ? [] : extractTags(body)

    this.#pendingBody.set(id, {
      title,
      body,
      tags,
      folderId: note?.folderId ?? ROOT,
      encrypted,
    })

    // Reflect the edit locally right away so lists and previews stay in step
    // with the editor instead of lagging behind the debounce. Encrypted notes
    // keep their ciphertext in the store; only the open editor sees plaintext.
    if (!encrypted) {
      this.notes = this.notes.map((n) =>
        n.id === id ? { ...n, body, title, tags, updatedAt: Date.now() } : n,
      )
    }
    this.#writeBodies()
    if (encrypted && note) keyring.touch(note.folderId)
  }

  /** Plaintext of a note, or null when its folder is locked. */
  async reveal(note: Note): Promise<{ title: string; body: string } | null> {
    return revealNote(note)
  }

  /**
   * Writes any pending edit immediately.
   *
   * Returns a promise that settles once the write has committed, so anything
   * that reads the database straight afterwards — an export, a snapshot — sees
   * the current text rather than the state from before the last keystroke.
   */
  flushPending(): Promise<void> {
    this.#writeBodies.flush()
    return this.#inFlight
  }

  async update(id: string, patch: Partial<Note>): Promise<void> {
    await notesRepo.updateNote(id, patch)
  }

  async trash(id: string): Promise<void> {
    await notesRepo.trashNote(id)
    if (this.selectedNoteId === id) this.selectedNoteId = null
  }

  async restore(id: string): Promise<void> {
    await notesRepo.restoreNote(id)
  }

  async deleteForever(id: string): Promise<void> {
    await notesRepo.deleteNoteForever(id)
    if (this.selectedNoteId === id) this.selectedNoteId = null
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    await notesRepo.updateNote(id, { archivedAt: archived ? Date.now() : 0 })
    if (archived && this.selectedNoteId === id) this.selectedNoteId = null
  }

  async togglePin(id: string): Promise<void> {
    const note = this.notes.find((n) => n.id === id)
    if (!note) return
    await notesRepo.updateNote(id, { pinned: note.pinned ? 0 : 1 })
  }

  // --- Wiki links ---------------------------------------------------------

  findByTitle(title: string): Note | null {
    const id = this.titleIndex.get(linkKey(title))
    return id ? (this.notes.find((n) => n.id === id) ?? null) : null
  }

  /**
   * Follows a `[[link]]`, creating the note if it does not exist yet. Creating
   * on click is what makes wiki-links usable for outlining: you write the link
   * first and fill the note in later.
   */
  async openLink(title: string): Promise<Note> {
    const existing = this.findByTitle(title)
    if (existing) {
      this.select(existing.id)
      return existing
    }
    const folderId = this.scope.kind === 'folder' ? (this.scope.id ?? ROOT) : ROOT
    const note = await this.create({ title, folderId })
    this.select(note.id)
    return note
  }

  /**
   * Repoints every `[[link]]` after a note was renamed.
   *
   * The previous title is passed in rather than read from the store: by the time
   * this runs the note already carries its new title, so the old one is gone.
   */
  async retitle(id: string, from: string, title: string): Promise<number> {
    if (linkKey(from) === linkKey(title) || !from.trim()) return 0

    let updated = 0
    for (const other of this.notes) {
      if (other.id === id) continue
      const rewritten = renameWikiLinks(other.body, from, title)
      if (rewritten !== other.body) {
        await notesRepo.updateNote(other.id, { body: rewritten, tags: extractTags(rewritten) })
        updated++
      }
    }
    return updated
  }

  // --- Templates ----------------------------------------------------------

  async toggleTemplate(id: string): Promise<void> {
    const note = this.notes.find((n) => n.id === id)
    if (!note) return
    await notesRepo.updateNote(id, { template: note.template ? 0 : 1 })
  }

  /** Creates a note from a template, expanding its `{{date}}`-style variables. */
  async newFromTemplate(templateId: string): Promise<Note | null> {
    const template = this.notes.find((n) => n.id === templateId)
    if (!template) return null
    const plain = await this.#templateText(template)
    if (!plain) throw new FolderLockedError(template.folderId)

    const nowDate = new Date()
    const body = plain.body
      .replace(/\{\{date\}\}/g, nowDate.toLocaleDateString())
      .replace(/\{\{time\}\}/g, nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      .replace(/\{\{title\}\}/g, plain.title)
      .replace(/\{\{cursor\}\}/g, '')

    const folderId = this.scope.kind === 'folder' ? (this.scope.id ?? template.folderId) : template.folderId
    const note = await this.create({
      title: plain.title,
      body,
      folderId,
      view: template.view,
      tags: extractTags(body),
    })
    this.select(note.id)
    return note
  }

  /** A template's plaintext; null when it lives in a locked folder. */
  async #templateText(template: Note): Promise<{ title: string; body: string } | null> {
    if (!template.encrypted) return { title: template.title, body: template.body }
    const [title, body] = await Promise.all([
      revealInFolder(template.folderId, template.title),
      revealInFolder(template.folderId, template.body),
    ])
    return title === null || body === null ? null : { title, body }
  }

  // --- Daily notes and scratchpad -----------------------------------------

  /** Opens (creating if needed) the daily note for a day key. */
  async openDaily(key: string, settings: Parameters<typeof dailyRepo.openDailyNote>[1]): Promise<Note> {
    const source = settings.templateId ? this.notes.find((n) => n.id === settings.templateId) : undefined
    const template = source ? ((await this.#templateText(source))?.body ?? '') : ''
    const note = await dailyRepo.openDailyNote(key, settings, template, (input) => this.create(input))
    this.select(note.id)
    return note
  }

  /** Discards a daily note that was opened but never written in. */
  async discardEmptyDaily(id: string | null): Promise<void> {
    if (!id) return
    await this.flushPending()
    await dailyRepo.discardEmptyDailyNote(id)
  }

  async openScratchpad(): Promise<Note> {
    return dailyRepo.getScratchpad()
  }

  // --- Smart folders ------------------------------------------------------

  async newSmartFolder(name: string, query: string): Promise<SmartFolder> {
    return smartRepo.createSmartFolder({ name, query })
  }

  async deleteSmartFolder(id: string): Promise<void> {
    await smartRepo.deleteSmartFolder(id)
    if (this.scope.kind === 'smart' && this.scope.id === id) {
      this.setScope({ kind: 'folder', id: null })
    }
  }

  async newFolder(parentId: string = ROOT): Promise<Folder> {
    return foldersRepo.createFolder({ name: 'New folder', parentId })
  }

  async renameFolder(id: string, name: string): Promise<void> {
    await foldersRepo.updateFolder(id, { name: name.trim() || 'Untitled folder' })
  }

  async toggleCollapsed(id: string): Promise<void> {
    const folder = this.folders.find((f) => f.id === id)
    if (!folder) return
    await foldersRepo.updateFolder(id, { collapsed: !folder.collapsed })
  }

  async deleteFolder(id: string): Promise<void> {
    await foldersRepo.deleteFolder(id)
    if (this.scope.kind === 'folder' && this.scope.id === id) {
      this.scope = { kind: 'folder', id: null }
    }
  }
}

export const notes = new NotesStore()
