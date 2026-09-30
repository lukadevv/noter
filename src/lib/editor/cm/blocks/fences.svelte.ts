import { mount, unmount } from 'svelte'
import { isolateHistory } from '@codemirror/commands'
import { StateEffect, StateField, type EditorState, type Text } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from '@codemirror/view'
import ContentBlock from '$components/blocks/ContentBlock.svelte'
import { CONTENT_FENCES, findFences, type Fence } from '$lib/md/fences'
import { minimalChange } from '../diff'

/**
 * Board and gallery blocks inside the editor.
 *
 * A ```board or ```gallery fence is replaced by a live Svelte component while
 * the cursor is outside it. The component edits the text between the fences;
 * each change becomes a minimal, undoable edit of the note. Toggling "</>"
 * (or moving the cursor into the fence) shows the markdown for hand edits.
 */

/** Scanning the document is cheap, but not free on every selection change. */
const fenceCache = new WeakMap<Text, Fence[]>()
export function contentFences(doc: Text): Fence[] {
  let fences = fenceCache.get(doc)
  if (!fences) {
    fences = findFences(doc.toString()).filter((f) => f.closed && CONTENT_FENCES.has(f.info))
    fenceCache.set(doc, fences)
  }
  return fences
}

/** Positions (fence starts) currently shown as raw markdown. */
export const setRaw = StateEffect.define<{ pos: number; raw: boolean }>()

const rawField = StateField.define<number[]>({
  create: () => [],
  update(positions, tr) {
    let next = tr.docChanged ? positions.map((p) => tr.changes.mapPos(p)) : positions
    for (const effect of tr.effects) {
      if (!effect.is(setRaw)) continue
      next = effect.value.raw
        ? [...next.filter((p) => p !== effect.value.pos), effect.value.pos]
        : next.filter((p) => p !== effect.value.pos)
    }
    // Moving the cursor out of a raw block renders it again.
    if (next.length > 0 && (tr.selection || tr.docChanged)) {
      const head = tr.state.selection.main.head
      const fences = contentFences(tr.state.doc)
      next = next.filter((pos) => {
        const fence = fences.find((f) => f.from === pos)
        return fence !== undefined && head >= fence.from && head <= fence.to
      })
    }
    return next
  },
})

export interface BlockServices {
  pickImages: () => Promise<string[]>
}

interface Mounted {
  props: { kind: 'board' | 'gallery'; source: string; readOnly: boolean }
  instance: ReturnType<typeof mount>
}
const mounted = new WeakMap<HTMLElement, Mounted>()

/** The fence a widget's DOM stands for, looked up fresh: positions shift as the note changes. */
function fenceFor(view: EditorView, dom: HTMLElement): Fence | null {
  const pos = view.posAtDOM(dom)
  return contentFences(view.state.doc).find((f) => f.from === pos || (f.from <= pos && pos <= f.to)) ?? null
}

function commit(view: EditorView, dom: HTMLElement, inner: string) {
  const fence = fenceFor(view, dom)
  if (!fence || view.state.readOnly) return
  let change = minimalChange(fence.inner, inner)
  let insert = change.insert
  // An empty fence has no line between its markers; give new content one.
  if (fence.inner === '' && fence.innerFrom === fence.innerTo && inner) insert = `${inner}\n`
  change = { from: fence.innerFrom + change.from, to: fence.innerFrom + change.to, insert }
  view.dispatch({
    changes: change,
    userEvent: 'input.block',
    // Each board action is its own undo step, not merged with the typing around it.
    annotations: isolateHistory.of('full'),
  })
}

class ContentBlockWidget extends WidgetType {
  constructor(
    readonly kind: 'board' | 'gallery',
    readonly inner: string,
    readonly readOnly: boolean,
    readonly services: BlockServices,
  ) {
    super()
  }

  override eq(other: ContentBlockWidget): boolean {
    return other.kind === this.kind && other.inner === this.inner && other.readOnly === this.readOnly
  }

  override toDOM(view: EditorView): HTMLElement {
    const dom = document.createElement('div')
    dom.className = 'cm-content-block'
    const props = $state({ kind: this.kind, source: this.inner, readOnly: this.readOnly })
    const instance = mount(ContentBlock, {
      target: dom,
      props: {
        get kind() {
          return props.kind
        },
        get source() {
          return props.source
        },
        get readOnly() {
          return props.readOnly
        },
        onchange: (inner: string) => commit(view, dom, inner),
        onraw: () => {
          const fence = fenceFor(view, dom)
          if (!fence) return
          view.dispatch({
            effects: setRaw.of({ pos: fence.from, raw: true }),
            selection: { anchor: fence.innerFrom },
          })
          view.focus()
        },
        ondelete: () => {
          const fence = fenceFor(view, dom)
          if (!fence) return
          const end = Math.min(view.state.doc.length, fence.to + 1)
          view.dispatch({ changes: { from: fence.from, to: end }, userEvent: 'delete.block' })
        },
        onpickimages: () => this.services.pickImages(),
      },
    })
    mounted.set(dom, { props, instance })
    // Images load after the first measure; tell the editor when the block grows.
    new ResizeObserver(() => view.requestMeasure()).observe(dom)
    return dom
  }

  override updateDOM(dom: HTMLElement): boolean {
    const entry = mounted.get(dom)
    if (!entry || entry.props.kind !== this.kind) return false
    // Update in place: recreating the DOM would drop focus from a card being typed.
    entry.props.source = this.inner
    entry.props.readOnly = this.readOnly
    return true
  }

  override destroy(dom: HTMLElement): void {
    const entry = mounted.get(dom)
    if (entry) void unmount(entry.instance)
    mounted.delete(dom)
  }

  override get estimatedHeight(): number {
    return this.kind === 'board' ? 260 : 180
  }

  override ignoreEvent(): boolean {
    // Clicks, typing and drags inside the block belong to the block.
    return true
  }
}

function build(state: EditorState, services: BlockServices): DecorationSet {
  const raw = state.field(rawField)
  const head = state.selection.main.head
  const ranges = []
  for (const fence of contentFences(state.doc)) {
    if (raw.includes(fence.from)) continue
    // The cursor strictly inside shows the source, e.g. when find lands in it.
    if (head > fence.from && head < fence.to) continue
    ranges.push(
      Decoration.replace({
        widget: new ContentBlockWidget(
          fence.info as 'board' | 'gallery',
          fence.inner,
          state.readOnly,
          services,
        ),
        block: true,
      }).range(fence.from, fence.to),
    )
  }
  return Decoration.set(ranges)
}

export function contentBlocks(services: BlockServices) {
  const field = StateField.define<DecorationSet>({
    create: (state) => build(state, services),
    update(decorations, tr) {
      if (
        tr.docChanged ||
        tr.selection ||
        tr.effects.some((e) => e.is(setRaw)) ||
        tr.startState.readOnly !== tr.state.readOnly
      ) {
        return build(tr.state, services)
      }
      return decorations
    },
    provide: (f) => [
      EditorView.decorations.from(f),
      EditorView.atomicRanges.of((view) => view.state.field(f)),
    ],
  })

  // Escape inside a raw block renders it again and puts the cursor after it.
  const escape = keymap.of([
    {
      key: 'Escape',
      run: (view) => {
        const head = view.state.selection.main.head
        const fence = contentFences(view.state.doc).find(
          (f) => view.state.field(rawField).includes(f.from) && head >= f.from && head <= f.to,
        )
        if (!fence) return false
        const after = Math.min(view.state.doc.length, fence.to + 1)
        view.dispatch({ effects: setRaw.of({ pos: fence.from, raw: false }), selection: { anchor: after } })
        return true
      },
    },
  ])

  return [rawField, field, escape]
}
