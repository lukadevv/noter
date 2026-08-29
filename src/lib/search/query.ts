/**
 * Query language for search and smart folders.
 *
 * Deliberately small: bare words match text, `field:value` filters, `AND`/`OR`
 * combine, `-` and `NOT` negate, and parentheses group. Anything more elaborate
 * would be a language nobody remembers; anything less would not express the
 * saved searches people actually want ("unfinished work tagged bug").
 *
 * Supported fields:
 *   tag:bug  folder:projects  view:checklist  lang:rust
 *   is:pinned | is:archived | is:trashed | is:template | is:daily | is:done | is:todo
 *   modified:<7d  created:>2026-01-01  has:image | has:task | has:link
 */

export type Node =
  | { type: 'text'; value: string }
  | { type: 'field'; field: string; op: Comparison; value: string }
  | { type: 'not'; child: Node }
  | { type: 'and'; children: Node[] }
  | { type: 'or'; children: Node[] }

export type Comparison = '=' | '<' | '>'

export interface ParseResult {
  node: Node | null
  /** Human-readable problems; an unparseable term degrades to plain text. */
  warnings: string[]
}

interface Token {
  kind: 'word' | 'phrase' | 'and' | 'or' | 'not' | '(' | ')'
  value: string
}

const FIELDS = new Set(['tag', 'folder', 'view', 'lang', 'is', 'has', 'modified', 'created', 'title'])

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const char = input[i]!

    if (/\s/.test(char)) {
      i++
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ kind: char, value: char })
      i++
      continue
    }

    if (char === '"') {
      const end = input.indexOf('"', i + 1)
      const value = end === -1 ? input.slice(i + 1) : input.slice(i + 1, end)
      tokens.push({ kind: 'phrase', value })
      i = end === -1 ? input.length : end + 1
      continue
    }

    let end = i
    while (end < input.length && !/[\s()]/.test(input[end]!)) end++
    const word = input.slice(i, end)
    i = end

    const upper = word.toUpperCase()
    if (upper === 'AND') tokens.push({ kind: 'and', value: word })
    else if (upper === 'OR') tokens.push({ kind: 'or', value: word })
    else if (upper === 'NOT') tokens.push({ kind: 'not', value: word })
    else tokens.push({ kind: 'word', value: word })
  }

  return tokens
}

function parseTerm(word: string, warnings: string[]): Node {
  const colon = word.indexOf(':')
  if (colon <= 0) return { type: 'text', value: word }

  const field = word.slice(0, colon).toLowerCase()
  if (!FIELDS.has(field)) {
    warnings.push(`Unknown filter "${field}:", searching for it as text.`)
    return { type: 'text', value: word }
  }

  let rest = word.slice(colon + 1)
  let op: Comparison = '='
  if (rest.startsWith('<') || rest.startsWith('>')) {
    op = rest[0] as Comparison
    rest = rest.slice(1)
  }
  if (!rest) {
    warnings.push(`"${field}:" has no value.`)
    return { type: 'text', value: word }
  }

  return { type: 'field', field, op, value: rest }
}

export function parseQuery(input: string): ParseResult {
  const warnings: string[] = []
  const tokens = tokenize(input)
  let position = 0

  function peek(): Token | undefined {
    return tokens[position]
  }

  function parsePrimary(): Node | null {
    const token = peek()
    if (!token) return null

    if (token.kind === 'not') {
      position++
      const child = parsePrimary()
      return child ? { type: 'not', child } : null
    }

    if (token.kind === '(') {
      position++
      const node = parseOr()
      if (peek()?.kind === ')') position++
      else warnings.push('Missing closing parenthesis.')
      return node
    }

    if (token.kind === ')') return null

    position++
    if (token.kind === 'phrase') return { type: 'text', value: token.value }

    // A leading '-' negates the term, the way search engines have always done.
    if (token.value.startsWith('-') && token.value.length > 1) {
      return { type: 'not', child: parseTerm(token.value.slice(1), warnings) }
    }
    return parseTerm(token.value, warnings)
  }

  function parseAnd(): Node | null {
    const children: Node[] = []
    for (;;) {
      const token = peek()
      if (!token || token.kind === ')' || token.kind === 'or') break
      if (token.kind === 'and') {
        position++
        continue
      }
      const node = parsePrimary()
      if (!node) break
      children.push(node)
    }
    if (children.length === 0) return null
    return children.length === 1 ? children[0]! : { type: 'and', children }
  }

  function parseOr(): Node | null {
    const children: Node[] = []
    const first = parseAnd()
    if (first) children.push(first)
    while (peek()?.kind === 'or') {
      position++
      const next = parseAnd()
      if (next) children.push(next)
    }
    if (children.length === 0) return null
    return children.length === 1 ? children[0]! : { type: 'or', children }
  }

  const node = parseOr()
  return { node, warnings }
}

/** Collects the bare words in a query, which drive full-text ranking. */
export function textTerms(node: Node | null): string[] {
  if (!node) return []
  switch (node.type) {
    case 'text':
      return [node.value]
    case 'field':
      return []
    case 'not':
      return []
    case 'and':
    case 'or':
      return node.children.flatMap(textTerms)
  }
}
