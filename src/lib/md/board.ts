/**
 * Board view over plain markdown.
 *
 * A board is not a separate document type: `## Heading` becomes a column and the
 * list items beneath it become cards. That means a board can be edited as text,
 * exported as text, and searched as text, and a note can move between the board
 * and document views without any conversion.
 */

export interface Card {
  id: string
  text: string
  done: boolean
  /** Zero-based line index in the source, so edits are precise rewrites. */
  line: number
}

export interface Column {
  title: string
  /** Line index of the `##` heading, or -1 for cards before any heading. */
  line: number
  cards: Card[]
}

const HEADING = /^(#{1,6})\s+(.*)$/
const CARD = /^(\s*)([-*+])\s+(\[([ xX])\]\s+)?(.*)$/

export function parseBoard(body: string): Column[] {
  const lines = body.split('\n')
  const columns: Column[] = []
  let current: Column | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    const heading = HEADING.exec(line)
    if (heading) {
      current = { title: heading[2]!.trim(), line: i, cards: [] }
      columns.push(current)
      continue
    }

    const card = CARD.exec(line)
    // Only top-level items are cards; indented ones are card detail.
    if (card && card[1]!.length === 0) {
      if (!current) {
        current = { title: 'Inbox', line: -1, cards: [] }
        columns.unshift(current)
      }
      current.cards.push({
        id: `${i}`,
        text: card[5]!.trim(),
        done: card[4]?.toLowerCase() === 'x',
        line: i,
      })
    }
  }

  return columns
}

/** Line index where a new card should be inserted at the end of a column. */
function insertionLine(lines: string[], columns: Column[], columnIndex: number): number {
  const column = columns[columnIndex]
  if (!column) return lines.length

  const last = column.cards[column.cards.length - 1]
  if (last) return last.line + 1

  // Empty column: right after its heading, or at the top for the implicit inbox.
  return column.line + 1
}

export function addCard(body: string, columnIndex: number, text: string): string {
  const lines = body.split('\n')
  const columns = parseBoard(body)
  const at = insertionLine(lines, columns, columnIndex)
  lines.splice(at, 0, `- ${text}`)
  return lines.join('\n')
}

/**
 * Moves a card to another column, at a given position among its cards.
 *
 * The card's own line (and any indented detail lines beneath it) travels as a
 * block, so sub-items are not orphaned.
 */
export function moveCard(
  body: string,
  fromLine: number,
  toColumnIndex: number,
  toCardIndex: number,
): string {
  const lines = body.split('\n')
  if (fromLine < 0 || fromLine >= lines.length) return body

  // Collect the card and its indented continuation lines.
  let end = fromLine + 1
  while (end < lines.length && /^\s+\S/.test(lines[end]!)) end++
  const block = lines.slice(fromLine, end)

  const remaining = [...lines.slice(0, fromLine), ...lines.slice(end)]
  const columns = parseBoard(remaining.join('\n'))
  const target = columns[toColumnIndex]
  if (!target) return body

  let at: number
  if (target.cards.length === 0) {
    at = target.line + 1
  } else if (toCardIndex >= target.cards.length) {
    const last = target.cards[target.cards.length - 1]!
    at = last.line + 1
    while (at < remaining.length && /^\s+\S/.test(remaining[at]!)) at++
  } else {
    at = target.cards[toCardIndex]!.line
  }

  remaining.splice(at, 0, ...block)
  return remaining.join('\n')
}

export function addColumn(body: string, title: string): string {
  const trimmed = body.replace(/\s+$/, '')
  return `${trimmed}${trimmed ? '\n\n' : ''}## ${title}\n`
}

export function renameColumn(body: string, line: number, title: string): string {
  const lines = body.split('\n')
  const heading = HEADING.exec(lines[line] ?? '')
  if (!heading) return body
  lines[line] = `${heading[1]} ${title}`
  return lines.join('\n')
}

export function updateCardText(body: string, line: number, text: string): string {
  const lines = body.split('\n')
  const card = CARD.exec(lines[line] ?? '')
  if (!card) return body
  lines[line] = `${card[1]}${card[2]} ${card[3] ?? ''}${text}`
  return lines.join('\n')
}

export function removeCard(body: string, line: number): string {
  const lines = body.split('\n')
  if (line < 0 || line >= lines.length) return body
  let end = line + 1
  while (end < lines.length && /^\s+\S/.test(lines[end]!)) end++
  lines.splice(line, end - line)
  return lines.join('\n')
}
