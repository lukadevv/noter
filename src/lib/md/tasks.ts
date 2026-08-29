/**
 * Checklist helpers.
 *
 * Tasks are plain markdown (`- [ ] thing`), so toggling one is a line rewrite on
 * the source rather than a change to a separate data structure. That keeps the
 * editor, the reading view and the exported `.md` in perfect agreement.
 */

/** A list marker, optional indentation, then a checkbox. */
const TASK_LINE = /^(\s*)([-*+]|\d+[.)])\s+\[([ xX])\](\s*)(.*)$/

export interface TaskLine {
  /** Zero-based line index in the note body. */
  line: number
  indent: string
  marker: string
  done: boolean
  text: string
}

export function parseTaskLine(line: string, index: number): TaskLine | null {
  const match = TASK_LINE.exec(line)
  if (!match) return null
  return {
    line: index,
    indent: match[1]!,
    marker: match[2]!,
    done: match[3]!.toLowerCase() === 'x',
    text: match[5]!,
  }
}

export function findTasks(body: string): TaskLine[] {
  const tasks: TaskLine[] = []
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const task = parseTaskLine(lines[i]!, i)
    if (task) tasks.push(task)
  }
  return tasks
}

export interface TaskStats {
  total: number
  done: number
}

export function taskStats(body: string): TaskStats {
  const tasks = findTasks(body)
  return { total: tasks.length, done: tasks.filter((t) => t.done).length }
}

/** Flips the checkbox on one line. Returns the body unchanged if it is not a task. */
export function toggleTaskAtLine(body: string, index: number): string {
  const lines = body.split('\n')
  const line = lines[index]
  if (line === undefined) return body

  const match = TASK_LINE.exec(line)
  if (!match) return body

  const done = match[3]!.toLowerCase() === 'x'
  lines[index] = `${match[1]}${match[2]} [${done ? ' ' : 'x'}]${match[4] || ' '}${match[5]}`
  return lines.join('\n')
}

/** Character offset of the `[` on a task line, for editor decorations. */
export function checkboxOffset(line: string): number | null {
  const match = TASK_LINE.exec(line)
  if (!match) return null
  return match[1]!.length + match[2]!.length + 1
}

/** Removes completed tasks, used by the checklist view's "clear done" action. */
export function removeCompletedTasks(body: string): string {
  return body
    .split('\n')
    .filter((line) => {
      const match = TASK_LINE.exec(line)
      return !match || match[3]!.toLowerCase() !== 'x'
    })
    .join('\n')
}
