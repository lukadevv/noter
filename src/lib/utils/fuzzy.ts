/**
 * Subsequence matcher for the command palette.
 *
 * The typed characters must appear in order but need not be adjacent, so "nn"
 * finds "New note". Returns null when there is no match at all.
 */
export function fuzzyScore(needle: string, haystack: string): number | null {
  if (!needle) return 0
  const target = haystack.toLowerCase()
  const query = needle.toLowerCase()

  let score = 0
  let index = 0
  let previous = -1

  for (const char of query) {
    const found = target.indexOf(char, index)
    if (found === -1) return null
    // Adjacent matches and word starts are worth more than scattered hits.
    if (found === previous + 1) score += 3
    if (found === 0 || /[\s\-_/:]/.test(target[found - 1] ?? '')) score += 5
    score += 1
    previous = found
    index = found + 1
  }

  // Shorter targets that contain the query are usually the intended one.
  return score - target.length * 0.05
}
