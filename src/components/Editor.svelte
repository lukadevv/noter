<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { t } from '$lib/i18n/index.svelte'
  import type { NoteEditor } from '$lib/editor/cm/setup'

  interface Props {
    /** The note on screen. Changing it swaps states inside the same editor. */
    noteId: string
    body: string
    /** Locked for editing: readable and selectable, but typing is refused. */
    locked?: boolean
    placeholder?: string
    lineNumbers?: boolean
    onchange: (body: string) => void
    onflush: () => void
    /** The user tried to type into a locked note. */
    onblocked?: () => void
    onlink?: (target: string) => void
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
    locked = false,
    placeholder = undefined,
    lineNumbers = false,
    onchange,
    onflush,
    onblocked,
    onlink,
    onimages,
    onurl,
    titles,
    tags,
  }: Props = $props()

  let host = $state<HTMLElement | null>(null)
  let editor = $state<NoteEditor | null>(null)
  /** Guards against a stale dynamic import resolving after the component is gone. */
  let disposed = false

  $effect(() => {
    const element = host
    if (!element || editor) return

    // CodeMirror is the heaviest dependency in the app, so it is fetched only
    // when an editor is actually opened, never as part of the initial bundle.
    void (async () => {
      const { createEditor } = await import('$lib/editor/cm/setup')
      if (disposed || !host) return
      editor = createEditor(element, {
        noteId: untrack(() => noteId),
        doc: untrack(() => body),
        locked: untrack(() => locked),
        placeholder: placeholder ?? t('note.placeholder'),
        lineNumbers: untrack(() => lineNumbers),
        onChange: (doc) => onchange(doc),
        onFlush: () => onflush(),
        onBlocked: () => onblocked?.(),
        onLink: (target) => onlink?.(target),
        images:
          onimages && onurl
            ? { onImages: (files) => onimages(files), onUrl: (url) => onurl(url) }
            : undefined,
        completion: titles && tags ? { titles, tags } : undefined,
      })
    })()
  })

  // A different note swaps in its own state; the same note with different text
  // (a restore, a renamed link) is applied as a minimal edit.
  $effect(() => {
    if (!editor) return
    const id = noteId
    const text = body
    untrack(() => editor?.open(id, text))
  })

  $effect(() => {
    editor?.setLocked(locked)
  })

  $effect(() => {
    editor?.setLineNumbers(lineNumbers)
  })

  onDestroy(() => {
    disposed = true
    onflush()
    editor?.destroy()
    editor = null
  })
</script>

<div class="editor" data-locked={locked || undefined} bind:this={host}></div>
{#if !editor}
  <div class="loading faint">{t('note.loadingEditor')}</div>
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
