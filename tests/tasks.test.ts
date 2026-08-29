import { describe, expect, it } from 'vitest'
import {
  checkboxOffset,
  findTasks,
  parseTaskLine,
  removeCompletedTasks,
  taskStats,
  toggleTaskAtLine,
} from '$lib/md/tasks'

describe('task parsing', () => {
  it('recognises the common markdown forms', () => {
    expect(parseTaskLine('- [ ] a', 0)?.done).toBe(false)
    expect(parseTaskLine('* [x] b', 0)?.done).toBe(true)
    expect(parseTaskLine('+ [X] c', 0)?.done).toBe(true)
    expect(parseTaskLine('1. [ ] d', 0)?.done).toBe(false)
    expect(parseTaskLine('   - [ ] nested', 0)?.indent).toBe('   ')
  })

  it('ignores lines that only look like tasks', () => {
    expect(parseTaskLine('[ ] no marker', 0)).toBeNull()
    expect(parseTaskLine('- [z] bad state', 0)).toBeNull()
    expect(parseTaskLine('- plain item', 0)).toBeNull()
  })

  it('counts progress', () => {
    expect(taskStats('- [ ] a\n- [x] b\ntext\n- [x] c')).toEqual({ total: 3, done: 2 })
    expect(taskStats('no tasks here')).toEqual({ total: 0, done: 0 })
  })

  it('reports the source line of each task', () => {
    const tasks = findTasks('intro\n- [ ] first\n\n- [x] second')
    expect(tasks.map((t) => t.line)).toEqual([1, 3])
  })
})

describe('toggleTaskAtLine', () => {
  it('flips a checkbox both ways', () => {
    expect(toggleTaskAtLine('- [ ] a', 0)).toBe('- [x] a')
    expect(toggleTaskAtLine('- [x] a', 0)).toBe('- [ ] a')
  })

  it('preserves indentation, marker and text', () => {
    expect(toggleTaskAtLine('   * [ ] deep **item**', 0)).toBe('   * [x] deep **item**')
    expect(toggleTaskAtLine('2) [ ] numbered', 0)).toBe('2) [x] numbered')
  })

  it('only touches the requested line', () => {
    const body = '- [ ] a\n- [ ] b\n- [ ] c'
    expect(toggleTaskAtLine(body, 1)).toBe('- [ ] a\n- [x] b\n- [ ] c')
  })

  it('leaves the body alone for out-of-range or non-task lines', () => {
    expect(toggleTaskAtLine('- [ ] a', 5)).toBe('- [ ] a')
    expect(toggleTaskAtLine('plain text', 0)).toBe('plain text')
  })

  it('handles an empty task with no trailing space', () => {
    expect(toggleTaskAtLine('- [ ]', 0)).toBe('- [x] ')
  })
})

describe('checkboxOffset', () => {
  it('points at the opening bracket', () => {
    expect('- [ ] a'.slice(checkboxOffset('- [ ] a')!)).toMatch(/^\[ \]/)
    expect('   * [x] a'.slice(checkboxOffset('   * [x] a')!)).toMatch(/^\[x\]/)
  })

  it('returns null for non-tasks', () => {
    expect(checkboxOffset('- plain')).toBeNull()
  })
})

describe('removeCompletedTasks', () => {
  it('drops done tasks and keeps everything else', () => {
    const body = '# Title\n- [ ] keep\n- [x] drop\nprose\n- [X] drop too'
    expect(removeCompletedTasks(body)).toBe('# Title\n- [ ] keep\nprose')
  })
})
