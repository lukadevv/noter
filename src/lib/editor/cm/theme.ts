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
    // Room at the start of each line for the block handle, and a long tail so
    // the last line can be scrolled up to eye level.
    padding: '0 12px 40vh 28px',
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
  // Block handle and drop indicator ------------------------------------------
  '.cm-block-handle': {
    position: 'absolute',
    zIndex: '5',
    display: 'grid',
    placeItems: 'center',
    width: '20px',
    height: '22px',
    padding: '0',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-faint)',
    cursor: 'grab',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 120ms, background 120ms',
    touchAction: 'none',
  },
  '.cm-block-handle--visible': { opacity: '1', pointerEvents: 'auto' },
  '.cm-block-handle:hover': { background: 'var(--surface-3)', color: 'var(--text)' },
  '.cm-block-handle--dragging': {
    cursor: 'grabbing',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
  },
  '.cm-drop-indicator': {
    position: 'absolute',
    zIndex: '5',
    height: '3px',
    borderRadius: '2px',
    background: 'var(--accent)',
    opacity: '0',
    pointerEvents: 'none',
  },
  '.cm-drop-indicator--visible': { opacity: '1' },
  // `contain: inline-size` stops a wide board from stretching the text column;
  // the board scrolls sideways inside its own box instead.
  '.cm-content-block': { padding: '0 var(--space-2)', contain: 'inline-size' },

  // Live preview -------------------------------------------------------------
  '.cm-heading-1': { paddingTop: '0.6em' },
  '.cm-heading-2': { paddingTop: '0.5em' },
  '.cm-heading-3': { paddingTop: '0.35em' },
  '.cm-bullet': { color: 'var(--accent)', fontWeight: '700', padding: '0 0.15em' },
  '.cm-rule': {
    display: 'inline-block',
    width: '100%',
    height: '1px',
    verticalAlign: 'middle',
    background: 'var(--border-strong)',
  },
  '.cm-md-link': { color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '3px' },
  '.cm-quote': {
    borderInlineStart: '3px solid var(--border-strong)',
    paddingInlineStart: 'calc(var(--space-2) + 6px)',
    color: 'var(--text-dim)',
  },
  '.cm-callout': {
    background: 'var(--accent-soft)',
    borderInlineStart: '3px solid var(--accent)',
    paddingInlineStart: 'calc(var(--space-2) + 6px)',
  },
  '.cm-callout.cm-block--first': { borderStartStartRadius: 'var(--radius)', paddingTop: '4px' },
  '.cm-callout.cm-block--last': { borderEndStartRadius: 'var(--radius)', paddingBottom: '4px' },
  '.cm-callout--warning, .cm-callout--caution': {
    background: 'var(--warn-soft)',
    borderInlineStartColor: 'var(--warn)',
  },
  '.cm-callout--danger': { background: 'var(--danger-soft)', borderInlineStartColor: 'var(--danger)' },
  '.cm-callout--tip, .cm-callout--success': {
    background: 'var(--ok-soft)',
    borderInlineStartColor: 'var(--ok)',
  },
  '.cm-callout, .cm-callout *': { fontStyle: 'normal' },
  '.cm-callout-label': { fontWeight: '650', color: 'var(--text)', marginInlineEnd: '0.4em' },
  '.cm-codeblock': {
    background: 'var(--surface-2)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.92em',
    paddingInline: 'calc(var(--space-2) + 6px)',
  },
  '.cm-codeblock--first': {
    borderStartStartRadius: 'var(--radius)',
    borderStartEndRadius: 'var(--radius)',
    paddingTop: '4px',
  },
  '.cm-codeblock--last': {
    borderEndStartRadius: 'var(--radius)',
    borderEndEndRadius: 'var(--radius)',
    paddingBottom: '4px',
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

/** Syntax colours for code inside ``` blocks, from the same tokens. */
export const codeHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.modifier], color: 'var(--accent)' },
    { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--ok)' },
    { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--warn)' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--text-faint)', fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--accent-hover)' },
    { tag: [t.typeName, t.className, t.tagName], color: 'var(--danger)' },
    { tag: [t.attributeName, t.propertyName], color: 'var(--text-dim)' },
  ]),
)
