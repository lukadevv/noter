/**
 * Hash routing. A hash router (rather than the History API) keeps the build a
 * pile of static files that works from any subdirectory and from `file://`-style
 * hosts, with no server rewrite rules.
 */

export type Route =
  | { kind: 'notes'; folderId: string | null; noteId: string | null }
  | { kind: 'trash'; noteId: string | null }
  | { kind: 'archive'; noteId: string | null }
  | { kind: 'tag'; tag: string; noteId: string | null }
  | { kind: 'smart'; id: string; noteId: string | null }
  | { kind: 'search'; query: string; noteId: string | null }
  | { kind: 'settings'; section: string | null }
  | { kind: 'share'; payload: string }

export const HOME: Route = { kind: 'notes', folderId: null, noteId: null }

/** Reads the note id out of a `/trash` or `/archive` tail, with or without `n/`. */
function noteIdFrom(rest: string[]): string | null {
  if (rest[0] === 'n') return rest[1] ?? null
  return rest[0] ?? null
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\//, '')
  if (!path) return HOME

  const segments = path.split('/').filter(Boolean).map(decodeURIComponent)
  const [head, ...rest] = segments

  switch (head) {
    case 'f': {
      const folderId = rest[0] ?? null
      const noteId = rest[1] === 'n' ? (rest[2] ?? null) : null
      return { kind: 'notes', folderId, noteId }
    }
    case 'n':
      return { kind: 'notes', folderId: null, noteId: rest[0] ?? null }
    case 'trash':
      return { kind: 'trash', noteId: noteIdFrom(rest) }
    case 'archive':
      return { kind: 'archive', noteId: noteIdFrom(rest) }
    case 't':
      return { kind: 'tag', tag: rest[0] ?? '', noteId: noteIdFrom(rest.slice(1)) }
    case 'sf':
      return { kind: 'smart', id: rest[0] ?? '', noteId: noteIdFrom(rest.slice(1)) }
    case 'q':
      return { kind: 'search', query: rest[0] ?? '', noteId: noteIdFrom(rest.slice(1)) }
    case 'settings':
      return { kind: 'settings', section: rest[0] ?? null }
    case 's':
      return { kind: 'share', payload: rest.join('/') }
    default:
      return HOME
  }
}

export function formatRoute(route: Route): string {
  const enc = encodeURIComponent
  switch (route.kind) {
    case 'notes': {
      const parts: string[] = []
      if (route.folderId) parts.push('f', enc(route.folderId))
      if (route.noteId) parts.push('n', enc(route.noteId))
      return parts.length ? `#/${parts.join('/')}` : '#/'
    }
    case 'trash':
      return route.noteId ? `#/trash/n/${enc(route.noteId)}` : '#/trash'
    case 'archive':
      return route.noteId ? `#/archive/n/${enc(route.noteId)}` : '#/archive'
    case 'tag':
      return `#/t/${enc(route.tag)}${route.noteId ? `/n/${enc(route.noteId)}` : ''}`
    case 'smart':
      return `#/sf/${enc(route.id)}${route.noteId ? `/n/${enc(route.noteId)}` : ''}`
    case 'search':
      return `#/q/${enc(route.query)}${route.noteId ? `/n/${enc(route.noteId)}` : ''}`
    case 'settings':
      return route.section ? `#/settings/${enc(route.section)}` : '#/settings'
    case 'share':
      return `#/s/${route.payload}`
  }
}

export function currentRoute(): Route {
  return parseHash(location.hash)
}

/** Replaces the hash without pushing a history entry (used for selection sync). */
export function replaceRoute(route: Route): void {
  const next = formatRoute(route)
  if (location.hash === next) return
  history.replaceState(null, '', next)
}

export function navigate(route: Route): void {
  const next = formatRoute(route)
  if (location.hash === next) return
  location.hash = next
}

export function onRouteChange(handler: (route: Route) => void): () => void {
  const listener = () => handler(currentRoute())
  addEventListener('hashchange', listener)
  return () => removeEventListener('hashchange', listener)
}
