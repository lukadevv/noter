// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

// The renderer reaches the DOM through DOMPurify, so this suite needs jsdom.

describe('markdown rendering', () => {
  it('renders basic markdown', async () => {
    const { renderMarkdown } = await import('$lib/md/parse')
    expect(renderMarkdown('# Title')).toContain('<h1>Title</h1>')
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>')
  })

  it('escapes raw HTML in a note body instead of executing it', async () => {
    const { renderMarkdown } = await import('$lib/md/parse')
    const html = renderMarkdown('<img src=x onerror="alert(1)">')
    // The payload survives as visible text, which is the point: it is escaped,
    // so no element and no handler is ever created.
    expect(html).toContain('&lt;img')
    expect(html).not.toMatch(/<img/i)

    const container = document.createElement('div')
    container.innerHTML = html
    expect(container.querySelector('img')).toBeNull()
  })

  it('never produces a javascript: link', async () => {
    const { renderMarkdown } = await import('$lib/md/parse')
    for (const source of ['[click](javascript:alert(1))', '[click](JaVaScRiPt:alert(1))']) {
      const container = document.createElement('div')
      container.innerHTML = renderMarkdown(source)
      for (const anchor of container.querySelectorAll('a')) {
        expect(anchor.getAttribute('href')?.toLowerCase()).not.toContain('javascript:')
      }
    }
  })

  it('opens external links safely', async () => {
    const { renderMarkdown } = await import('$lib/md/parse')
    const html = renderMarkdown('[site](https://example.com)')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
    expect(html).toContain('target="_blank"')
  })

  it('turns task syntax into checkboxes', async () => {
    const { renderMarkdown } = await import('$lib/md/parse')
    const container = document.createElement('div')
    container.innerHTML = renderMarkdown('- [ ] todo\n- [x] done')

    const boxes = container.querySelectorAll<HTMLInputElement>('input.task-checkbox')
    expect(boxes).toHaveLength(2)
    expect(boxes[0]!.checked).toBe(false)
    expect(boxes[1]!.checked).toBe(true)
    expect(container.querySelectorAll('.task-item--done')).toHaveLength(1)
  })

  it('renders an empty task as a checkbox, not literal brackets', async () => {
    const { renderMarkdown } = await import('$lib/md/parse')
    const container = document.createElement('div')
    container.innerHTML = renderMarkdown('- [ ]')

    expect(container.querySelectorAll('input.task-checkbox')).toHaveLength(1)
    expect(container.textContent).not.toContain('[ ]')
  })

  it('leaves ordinary bracket text alone', async () => {
    const { renderMarkdown } = await import('$lib/md/parse')
    const container = document.createElement('div')
    container.innerHTML = renderMarkdown('- [note] not a task')

    expect(container.querySelectorAll('input.task-checkbox')).toHaveLength(0)
  })
})
