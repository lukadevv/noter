import { ViewPlugin, keymap, type EditorView, type ViewUpdate } from '@codemirror/view'
import { menu } from '$lib/stores/menu.svelte'
import { BLOCKS } from '$lib/md/blocks'
import { t } from '$lib/i18n/index.svelte'
import type { MenuItem } from '$lib/ui-types'
import {
  blockAt,
  blocksOf,
  deleteBlock,
  duplicateBlock,
  moveBlock,
  moveBlockBefore,
  turnBlockInto,
  type Block,
} from './model'

const GRIP =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/>' +
  '<circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>'

function run(view: EditorView, spec: ReturnType<typeof moveBlock>) {
  if (!spec || view.state.readOnly) return
  view.dispatch(spec)
  view.focus()
}

/** The block menu: turn into, duplicate, move, delete. */
export function blockMenuItems(view: EditorView, block: Block): MenuItem[] {
  const state = view.state
  const convertible = block.kind !== 'fence' && block.kind !== 'other'
  return [
    ...(convertible
      ? [
          {
            id: 'turn-into',
            label: t('blocks.turnInto'),
            icon: 'refresh-cw',
            submenu: BLOCKS.filter((b) => b.convertible).map((b) => ({
              id: b.kind,
              label: t(b.label),
              icon: b.icon,
              checked: block.kind === b.kind,
              run: () => run(view, turnBlockInto(view.state, block, b.kind)),
            })),
          },
        ]
      : []),
    {
      id: 'duplicate',
      label: t('blocks.duplicate'),
      icon: 'copy',
      run: () => run(view, duplicateBlock(view.state, block)),
    },
    {
      id: 'up',
      label: t('blocks.moveUp'),
      icon: 'arrow-up',
      shortcut: 'Mod+Shift+↑',
      separatorBefore: true,
      disabled: blocksOf(state)[0]?.from === block.from,
      run: () => run(view, moveBlock(view.state, block, -1)),
    },
    {
      id: 'down',
      label: t('blocks.moveDown'),
      icon: 'arrow-down',
      shortcut: 'Mod+Shift+↓',
      disabled: blocksOf(state).at(-1)?.from === block.from,
      run: () => run(view, moveBlock(view.state, block, 1)),
    },
    {
      id: 'delete',
      label: t('blocks.delete'),
      icon: 'trash',
      danger: true,
      separatorBefore: true,
      run: () => run(view, deleteBlock(view.state, block)),
    },
  ]
}

/**
 * The grip that appears beside the block under the pointer (or, on touch, the
 * block with the cursor). Click it for the block menu; drag it to move the
 * block. It lives outside the editable content, so it never becomes text.
 */
export const blockHandle = ViewPlugin.fromClass(
  class {
    handle: HTMLButtonElement
    indicator: HTMLDivElement
    block: Block | null = null
    drag: { start: number; moved: boolean; target: Block | null; atEnd: boolean } | null = null
    coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

    constructor(readonly view: EditorView) {
      this.handle = document.createElement('button')
      this.handle.className = 'cm-block-handle'
      this.handle.type = 'button'
      this.handle.tabIndex = -1
      this.handle.innerHTML = GRIP
      this.handle.setAttribute('aria-label', t('blocks.menu'))
      this.handle.addEventListener('pointerdown', this.onPointerDown)
      this.handle.addEventListener('pointermove', this.onPointerMove)
      this.handle.addEventListener('pointerup', this.onPointerUp)
      this.handle.addEventListener('pointercancel', this.cancelDrag)
      this.indicator = document.createElement('div')
      this.indicator.className = 'cm-drop-indicator'
      view.dom.append(this.handle, this.indicator)
      view.dom.addEventListener('mousemove', this.onMouseMove)
      view.dom.addEventListener('mouseleave', this.onMouseLeave)
      view.scrollDOM.addEventListener('scroll', this.hide, { passive: true })
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.geometryChanged) this.hide()
      if (this.coarse && (update.selectionSet || update.focusChanged)) {
        if (update.view.hasFocus) this.show(blockAt(update.state, update.state.selection.main.head))
        else this.hide()
      }
    }

    onMouseMove = (event: MouseEvent) => {
      if (this.drag || this.view.state.readOnly) return
      if (event.target === this.handle || this.handle.contains(event.target as Node)) return
      const content = this.view.contentDOM.getBoundingClientRect()
      const pos = this.view.posAtCoords({ x: content.left + 8, y: event.clientY }, false)
      this.show(blockAt(this.view.state, pos))
    }

    onMouseLeave = (event: MouseEvent) => {
      if (this.drag || event.relatedTarget === this.handle) return
      this.hide()
    }

    hide = () => {
      if (this.drag) return
      this.handle.classList.remove('cm-block-handle--visible')
      this.block = null
    }

    show(block: Block | null) {
      if (!block || this.view.state.readOnly) {
        this.hide()
        return
      }
      this.block = block
      const top = this.topOf(block.from)
      const dom = this.view.dom.getBoundingClientRect()
      const content = this.view.contentDOM.getBoundingClientRect()
      const rtl = this.view.textDirection === 1
      this.handle.style.top = `${top}px`
      this.handle.style.left = rtl
        ? `${content.right - dom.left + 4}px`
        : `${content.left - dom.left - 24}px`
      this.handle.classList.add('cm-block-handle--visible')
    }

    /** Top of a document position, relative to the editor's own box. */
    topOf(pos: number): number {
      const line = this.view.lineBlockAt(pos)
      const dom = this.view.dom.getBoundingClientRect()
      return line.top + this.view.documentTop - dom.top + Math.min(4, line.height / 4)
    }

    onPointerDown = (event: PointerEvent) => {
      if (!this.block || event.button !== 0) return
      event.preventDefault()
      this.handle.setPointerCapture(event.pointerId)
      this.drag = { start: event.clientY, moved: false, target: null, atEnd: false }
    }

    onPointerMove = (event: PointerEvent) => {
      const drag = this.drag
      if (!drag || !this.block) return
      if (!drag.moved && Math.abs(event.clientY - drag.start) < 5) return
      drag.moved = true
      this.handle.classList.add('cm-block-handle--dragging')
      const content = this.view.contentDOM.getBoundingClientRect()
      const pos = this.view.posAtCoords({ x: content.left + 8, y: event.clientY }, false)
      const blocks = blocksOf(this.view.state)
      const over = blocks.find((b) => pos >= b.from && pos <= b.to) ?? blocks.at(-1) ?? null
      if (!over) return
      const line = this.view.lineBlockAt(over.from)
      const end = this.view.lineBlockAt(over.to)
      const middle = (line.top + end.bottom) / 2 + this.view.documentTop
      const index = blocks.indexOf(over)
      const below = event.clientY > middle
      drag.target = below ? (blocks[index + 1] ?? null) : over
      drag.atEnd = below && !blocks[index + 1]
      const y = drag.target ? this.topOf(drag.target.from) - 4 : this.topOf(over.to) + end.height
      const dom = this.view.dom.getBoundingClientRect()
      this.indicator.style.top = `${y}px`
      this.indicator.style.left = `${content.left - dom.left}px`
      this.indicator.style.width = `${content.width}px`
      this.indicator.classList.add('cm-drop-indicator--visible')
    }

    onPointerUp = () => {
      const drag = this.drag
      const block = this.block
      this.cancelDrag()
      if (!drag || !block) return
      if (!drag.moved) {
        menu.open(blockMenuItems(this.view, block), this.handle, t('blocks.menu'))
        return
      }
      const spec = moveBlockBefore(this.view.state, block, drag.atEnd ? null : drag.target)
      run(this.view, spec)
    }

    cancelDrag = () => {
      this.drag = null
      this.handle.classList.remove('cm-block-handle--dragging')
      this.indicator.classList.remove('cm-drop-indicator--visible')
    }

    destroy() {
      this.view.dom.removeEventListener('mousemove', this.onMouseMove)
      this.view.dom.removeEventListener('mouseleave', this.onMouseLeave)
      this.view.scrollDOM.removeEventListener('scroll', this.hide)
      this.handle.remove()
      this.indicator.remove()
    }
  },
)

function moveCommand(direction: -1 | 1) {
  return (view: EditorView) => {
    if (view.state.readOnly) return false
    const block = blockAt(view.state, view.state.selection.main.head)
    if (!block) return false
    const spec = moveBlock(view.state, block, direction)
    if (!spec) return true
    // Keep the cursor at the same column within the moved block.
    const offset = view.state.selection.main.head - block.from
    view.dispatch({ ...spec, selection: undefined })
    const moved = blockAt(view.state, (spec.selection as { anchor: number }).anchor)
    if (moved) view.dispatch({ selection: { anchor: Math.min(moved.to, moved.from + offset) } })
    return true
  }
}

/** Mod+Shift+↑/↓ moves the block with the cursor, like moving lines in a code editor. */
export const blockKeymap = keymap.of([
  { key: 'Mod-Shift-ArrowUp', run: moveCommand(-1) },
  { key: 'Mod-Shift-ArrowDown', run: moveCommand(1) },
])
