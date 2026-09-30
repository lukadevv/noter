import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * The editor is styled entirely from the app's design tokens, so it follows the
 * active theme (and any per-folder accent) with no per-theme CodeMirror config.
 */
export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    fontSize: 'var(--editor-font-size)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-ui)',
    lineHeight: 'var(--line-height)',
    padding: '0 0 40vh 0',
  },
  '.cm-content': {
    caretColor: 'var(--accent)',
    padding: '0',
    maxWidth: '46rem',
    margin: '0 auto',
  },
  '.cm-line': { padding: '0 var(--space-2)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--text-faint)',
    border: 'none',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-dim)' },
  '.cm-placeholder': { color: 'var(--text-faint)' },
  '.cm-panels': { backgroundColor: 'var(--surface-2)', color: 'var(--text)' },
  '.cm-searchMatch': { backgroundColor: 'var(--warn-soft)', outline: '1px solid var(--warn)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--accent-soft)' },

  // Inline decorations: checkboxes and image previews.
  '.cm-task-checkbox': {
    accentColor: 'var(--accent)',
    width: '1em',
    height: '1em',
    margin: '0 0.15em 0 0',
    verticalAlign: '-0.15em',
    cursor: 'pointer',
  },
  '.cm-inline-image': {
    display: 'inline-block',
    verticalAlign: 'top',
    maxWidth: '100%',
    margin: '0.25em 0',
  },
  '.cm-inline-image img': {
    maxWidth: 'min(100%, 26rem)',
    maxHeight: '18rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    cursor: 'zoom-in',
  },
  '.cm-wikilink': { color: 'var(--accent)', cursor: 'text' },
  '.cm-wikilink:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' },
  // Locked notes follow links on a plain click, so they look clickable.
  '.cm-content[aria-readonly="true"] .cm-wikilink': { cursor: 'pointer' },
  '.cm-tooltip-autocomplete': {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'var(--surface-2)',
    boxShadow: 'var(--shadow-2)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete ul li': {
    padding: '4px 10px',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-ui)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    background: 'var(--accent-soft)',
    color: 'var(--text)',
  },
  '.cm-inline-image--missing::after': {
    content: '"missing image"',
    display: 'inline-block',
    padding: '0.2em 0.5em',
    border: '1px dashed var(--danger)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--danger)',
    fontSize: '0.85em',
  },
})

export const markdownHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading1, fontSize: '1.6em', fontWeight: '700', lineHeight: '1.3' },
    { tag: t.heading2, fontSize: '1.35em', fontWeight: '700', lineHeight: '1.3' },
    { tag: t.heading3, fontSize: '1.15em', fontWeight: '650' },
    { tag: [t.heading4, t.heading5, t.heading6], fontWeight: '650' },
    { tag: t.strong, fontWeight: '700', color: 'var(--text)' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-faint)' },
    { tag: t.link, color: 'var(--accent)', textDecoration: 'underline' },
    { tag: t.url, color: 'var(--accent)' },
    { tag: t.monospace, fontFamily: 'var(--font-mono)', color: 'var(--ok)' },
    { tag: t.quote, color: 'var(--text-dim)', fontStyle: 'italic' },
    { tag: t.list, color: 'var(--text-faint)' },
    // Markdown punctuation stays visible but recedes, so the source reads as prose.
    { tag: [t.processingInstruction, t.meta], color: 'var(--text-faint)' },
  ]),
)
