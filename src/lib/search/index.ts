import MiniSearch, { type SearchResult } from 'minisearch'
import type { Note } from '$lib/db/schema'
import { derivedTitle } from '$lib/db/repo/notes'

/**
 * Full-text index over the note set.
 *
 * This runs on the main thread rather than in a worker. The store already holds
 * every note in memory, so a worker would mean structured-cloning the entire
 * corpus across the boundary on every edit — more total work than indexing it
 * here. The initial build is instead sliced across idle callbacks so it never
 * blocks the first paint or a keystroke.
 */
const FIELDS = ['title', 'body', 'tags'] as const

export interface IndexedNote {
  id: string
  title: string
  body: string
  tags: string
}

function toDocument(note: Note): IndexedNote {
  return {
    id: note.id,
    title: derivedTitle(note),
    // Encrypted bodies are ciphertext; indexing them would leak nothing useful
    // and would pollute results with base64 noise.
    body: note.encrypted ? '' : note.body,
    tags: note.tags.join(' '),
  }
}

const CHUNK_SIZE = 200

function scheduleIdle(callback: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => callback(), { timeout: 250 })
  else setTimeout(callback, 0)
}

export class SearchIndex {
  #engine = new MiniSearch<IndexedNote>({
    fields: [...FIELDS],
    storeFields: ['title'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.15,
      boost: { title: 3, tags: 2 },
      combineWith: 'AND',
    },
  })

  #known = new Set<string>()
  /** Bumped on every rebuild so a stale chunked build aborts itself. */
  #generation = 0
  ready = false

  /** Replaces the index contents, spreading the work across idle slices. */
  rebuild(notes: Note[], onDone?: () => void): void {
    const generation = ++this.#generation
    this.#engine.removeAll()
    this.#known.clear()
    this.ready = false

    let offset = 0
    const step = () => {
      if (generation !== this.#generation) return
      const slice = notes.slice(offset, offset + CHUNK_SIZE)
      if (slice.length > 0) {
        this.#engine.addAll(slice.map(toDocument))
        for (const note of slice) this.#known.add(note.id)
        offset += slice.length
        scheduleIdle(step)
        return
      }
      this.ready = true
      onDone?.()
    }

    step()
  }

  upsert(note: Note): void {
    const document = toDocument(note)
    if (this.#known.has(note.id)) this.#engine.replace(document)
    else {
      this.#engine.add(document)
      this.#known.add(note.id)
    }
  }

  remove(id: string): void {
    if (!this.#known.has(id)) return
    this.#engine.discard(id)
    this.#known.delete(id)
  }

  /** Reconciles the index against the current note set after a bulk change. */
  sync(notes: Note[]): void {
    const seen = new Set<string>()
    for (const note of notes) {
      seen.add(note.id)
      this.upsert(note)
    }
    for (const id of [...this.#known]) {
      if (!seen.has(id)) this.remove(id)
    }
  }

  search(terms: string[], limit = 50): SearchResult[] {
    if (terms.length === 0) return []
    return this.#engine.search(terms.join(' ')).slice(0, limit)
  }

  /** Relevance score per note id, for ranking an already-filtered set. */
  scores(terms: string[]): Map<string, number> {
    return new Map(this.search(terms, 500).map((result) => [result.id as string, result.score]))
  }

  get size(): number {
    return this.#known.size
  }
}

export const searchIndex = new SearchIndex()
