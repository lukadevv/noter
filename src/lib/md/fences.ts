/**
 * Fenced code blocks, found the way CommonMark finds them.
 *
 * A fence opens with three or more backticks or tildes (indented at most three
 * spaces), and closes with a run of the same character at least as long. An
 * unclosed fence runs to the end of the document. Regexes like /```[\s\S]*?```/
 * get this wrong as soon as a fence is four backticks long or contains a
 * shorter run, which is exactly what nested examples do.
 *
 * Board and gallery blocks are fences too (` ```board `, ` ```gallery `), so
 * everything that skips "code" has to ask which kind of fence it is looking at.
 */

export interface Fence {
  /** Offset of the opening fence line. */
  from: number
  /** Offset just past the closing fence line's text (or the document end). */
  to: number
  /** First word of the info string, lower-cased: `js`, `board`, `gallery`, or ''. */
  info: string
  /** The text between the fences, without the fence lines themselves. */
  inner: string
  /** Offset where `inner` starts. */
  innerFrom: number
  /** Offset where `inner` ends. */
  innerTo: number
  /** The fence marker, e.g. "```" or "~~~~". */
  marker: string
  closed: boolean
}

const OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/

/** Fence kinds that hold content for the reader rather than source code. */
export const CONTENT_FENCES = new Set(['board', 'gallery'])

export function findFences(text: string): Fence[] {
  const fences: Fence[] = []
  let offset = 0
  let open: { from: number; marker: string; info: string; innerFrom: number } | null = null

  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineEnd = offset + line.length

    if (open === null) {
      const match = OPEN.exec(line)
      // A backtick fence's info string may not itself contain backticks.
      if (match && !(match[2]![0] === '`' && match[3]!.includes('`'))) {
        const info = (match[3]!.trim().split(/\s+/)[0] ?? '').toLowerCase()
        open = { from: offset, marker: match[2]!, info, innerFrom: Math.min(lineEnd + 1, text.length) }
      }
    } else {
      const trimmed = line.replace(/^ {0,3}/, '').trimEnd()
      const char = open.marker[0]!
      if (trimmed.length >= open.marker.length && /^(`+|~+)$/.test(trimmed) && trimmed[0] === char) {
        const innerTo = Math.max(open.innerFrom, offset - 1)
        fences.push({
          from: open.from,
          to: lineEnd,
          info: open.info,
          inner: text.slice(open.innerFrom, innerTo),
          innerFrom: open.innerFrom,
          innerTo,
          marker: open.marker,
          closed: true,
        })
        open = null
      }
    }
    offset = lineEnd + 1
  }

  if (open) {
    fences.push({
      from: open.from,
      to: text.length,
      info: open.info,
      inner: text.slice(open.innerFrom),
      innerFrom: open.innerFrom,
      innerTo: text.length,
      marker: open.marker,
      closed: false,
    })
  }
  return fences
}

/**
 * Blanks out code fences (keeping every offset intact) so scanners never see
 * the tags and links inside them. Board and gallery fences are content, not
 * code: only their fence lines are blanked, their items stay scannable.
 */
export function maskCode(text: string): string {
  let out = ''
  let last = 0
  for (const fence of findFences(text)) {
    out += text.slice(last, fence.from)
    if (CONTENT_FENCES.has(fence.info)) {
      out += blank(text.slice(fence.from, fence.innerFrom))
      out += text.slice(fence.innerFrom, fence.innerTo)
      out += blank(text.slice(fence.innerTo, fence.to))
    } else {
      out += blank(text.slice(fence.from, fence.to))
    }
    last = fence.to
  }
  out += text.slice(last)
  return out
}

/** Replaces every character except newlines with a space. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ')
}

/**
 * Wraps text in a fence that cannot be closed early by anything inside it:
 * the marker is one backtick longer than the longest backtick run in the text.
 */
export function wrapFence(info: string, inner: string): string {
  const longest = Math.max(0, ...[...inner.matchAll(/`+/g)].map((m) => m[0].length))
  const marker = '`'.repeat(Math.max(3, longest + 1))
  const body = inner.endsWith('\n') ? inner.slice(0, -1) : inner
  return `${marker}${info}\n${body}\n${marker}`
}

/** True for a line that only opens or closes a fence. */
export function isFenceLine(line: string): boolean {
  return OPEN.test(line)
}
