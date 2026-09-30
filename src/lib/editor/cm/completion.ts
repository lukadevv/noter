import { autocompletion, type CompletionSource } from '@codemirror/autocomplete'

/**
 * The editor's one autocompletion extension. CodeMirror allows a single
 * `override` list, so every source — links, tags, the `/` block menu — is
 * registered here rather than each adding its own `autocompletion()`.
 */
export function completions(sources: CompletionSource[]) {
  return autocompletion({ override: sources, icons: false, activateOnTyping: true })
}
