<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import type { EditorView } from '@codemirror/view'

  interface Props {
    /** Changing this id swaps the document; body changes alone must not. */
    noteId: string
    body: string
    placeholder?: string
    lineNumbers?: boolean
    onchange: (body: string) => void
    onflush: () => void
    /** Handles images pasted, dropped or linked into the editor. */
    onimages?: (files: File[]) => Promise<string[]>
    onurl?: (url: string) => Promise<string | null>
    /** Live sources for `[[link]]` and `#tag` completion. */
    titles?: () => string[]
    tags?: () => string[]
  }

  let {
    noteId,
    body,
    placeholder = 'Start writing…',
    lineNumbers = false,
    onchange,
    onflush,
    onimages,
    onurl,
    titles,
    tags,
  }: Props = $props()

  let host = $state<HTMLElement | null>(null)
  let view: EditorView | null = null
  let ready = $state(false)
  /** Guards against a stale dynamic import resolving after the component is gone. */
  let disposed = false

  $effect(() => {
    const element = host
    if (!element || view) return

    // CodeMirror is the heaviest dependency in the app, so it is fetched only
    // when an editor is actually opened, never as part of the initial bundle.
    void (async () => {
      const { createEditor } = await import('$lib/editor/cm/setup')
      if (disposed || !host) return
      view = createEditor(element, {
        doc: untrack(() => body),
        placeholder,
        lineNumbers,
        onChange: (doc) => onchange(doc),
        onFlush: () => onflush(),
        images:
          onimages && onurl
            ? { onImages: (files) => onimages(files), onUrl: (url) => onurl(url) }
            : undefined,
        completion: titles && tags ? { titles, tags } : undefined,
      })
      ready = true
    })()
  })

  // Swap the document when a different note is opened. Reading `body` untracked
  // keeps our own keystrokes from re-entering and resetting the cursor.
  $effect(() => {
    void noteId
    if (!view || !ready) return
    void (async () => {
      const { setDoc } = await import('$lib/editor/cm/setup')
      if (view) setDoc(view, untrack(() => body))
    })()
  })

  onDestroy(() => {
    disposed = true
    onflush()
    view?.destroy()
    view = null
  })
</script>

<div class="editor" bind:this={host}></div>
{#if !ready}
  <div class="loading faint">Loading editor…</div>
{/if}

<style>
  .editor {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .editor :global(.cm-editor) {
    height: 100%;
  }

  .loading {
    position: absolute;
    inset: auto 0 var(--space-4) 0;
    text-align: center;
    font-size: 12px;
    pointer-events: none;
  }
</style>
