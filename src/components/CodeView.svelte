<script lang="ts">
  import Icon from './Icon.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    body: string
    lang: string | null
    readOnly?: boolean
    onchange: (body: string) => void
    onlang: (lang: string) => void
  }

  let { body, lang, readOnly = false, onchange, onlang }: Props = $props()

  const LANGUAGES = [
    'plain',
    'bash',
    'c',
    'cpp',
    'csharp',
    'css',
    'diff',
    'dockerfile',
    'go',
    'html',
    'java',
    'javascript',
    'json',
    'kotlin',
    'lua',
    'markdown',
    'php',
    'python',
    'ruby',
    'rust',
    'sql',
    'swift',
    'toml',
    'typescript',
    'xml',
    'yaml',
  ]

  /**
   * A code note is a single fenced block. The fence is kept in the markdown so
   * the note still reads correctly in every other view and in an export.
   */
  const FENCE = /^```([\w+-]*)\n([\s\S]*?)\n?```\s*$/

  let parsed = $derived.by(() => {
    const match = FENCE.exec(body.trim())
    if (match) return { lang: match[1] || lang || 'plain', code: match[2]! }
    return { lang: lang ?? 'plain', code: body }
  })

  function write(code: string, language: string) {
    onchange(`\`\`\`${language === 'plain' ? '' : language}\n${code}\n\`\`\``)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(parsed.code)
      ui.toast(t('toast.codeCopied'), 'ok')
    } catch {
      ui.toast(t('toast.clipboardDenied'), 'warn')
    }
  }
</script>

<div class="code">
  <header class="bar">
    <select
      class="input lang"
      value={parsed.lang}
      disabled={readOnly}
      aria-label={t('code.language')}
      onchange={(e) => {
        onlang(e.currentTarget.value)
        write(parsed.code, e.currentTarget.value)
      }}
    >
      {#each LANGUAGES as language (language)}
        <option value={language}>{language}</option>
      {/each}
    </select>
    <div class="spacer"></div>
    <button class="btn btn--ghost" onclick={copy}>
      <Icon name="copy" size={14} />
      {t('code.copy')}
    </button>
  </header>

  <textarea
    class="editor"
    value={parsed.code}
    readonly={readOnly}
    spellcheck="false"
    placeholder={t('code.placeholder')}
    oninput={(e) => write(e.currentTarget.value, parsed.lang)}></textarea>
</div>

<style>
  .code {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    max-width: 60rem;
    width: 100%;
    margin: 0 auto;
    padding: 0 var(--space-4) var(--space-4);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-bottom: var(--space-2);
  }

  .lang {
    width: auto;
    min-width: 9rem;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .spacer {
    flex: 1;
  }

  .editor {
    flex: 1;
    min-height: 0;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: calc(var(--editor-font-size) - 1px);
    line-height: 1.6;
    resize: none;
    tab-size: 2;
    white-space: pre;
    overflow: auto;
  }

  .editor:focus {
    outline: none;
    border-color: var(--accent);
  }
</style>
