/**
 * The smallest single replacement that turns `before` into `after`: the common
 * prefix and suffix are left alone. Enough to keep a cursor outside the edited
 * region where it was, without a full diff algorithm.
 */
export function minimalChange(before: string, after: string): { from: number; to: number; insert: string } {
  let start = 0
  const max = Math.min(before.length, after.length)
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start++

  let endBefore = before.length
  let endAfter = after.length
  while (
    endBefore > start &&
    endAfter > start &&
    before.charCodeAt(endBefore - 1) === after.charCodeAt(endAfter - 1)
  ) {
    endBefore--
    endAfter--
  }
  return { from: start, to: endBefore, insert: after.slice(start, endAfter) }
}
