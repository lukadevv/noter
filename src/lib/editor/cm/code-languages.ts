import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
  type StreamParser,
} from '@codemirror/language'

/**
 * Syntax highlighting inside ``` code blocks, one lazily loaded chunk per
 * language. A curated list rather than `@codemirror/language-data`: that
 * package brings a hundred-odd chunks, all of which the service worker would
 * precache for every user.
 */
function legacy(load: () => Promise<StreamParser<unknown>>) {
  return async () => new LanguageSupport(StreamLanguage.define(await load()))
}

export const LANGUAGES: { name: string; alias: string[]; load: () => Promise<LanguageSupport> }[] = [
  {
    name: 'javascript',
    alias: ['js', 'jsx', 'mjs', 'cjs'],
    load: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true }),
  },
  {
    name: 'typescript',
    alias: ['ts', 'tsx'],
    load: async () =>
      (await import('@codemirror/lang-javascript')).javascript({ jsx: true, typescript: true }),
  },
  { name: 'python', alias: ['py'], load: async () => (await import('@codemirror/lang-python')).python() },
  {
    name: 'html',
    alias: ['htm', 'svelte', 'vue'],
    load: async () => (await import('@codemirror/lang-html')).html(),
  },
  { name: 'css', alias: ['scss', 'less'], load: async () => (await import('@codemirror/lang-css')).css() },
  {
    name: 'json',
    alias: ['jsonc', 'json5'],
    load: async () => (await import('@codemirror/lang-json')).json(),
  },
  {
    name: 'sql',
    alias: ['postgres', 'mysql', 'sqlite'],
    load: async () => (await import('@codemirror/lang-sql')).sql(),
  },
  { name: 'rust', alias: ['rs'], load: async () => (await import('@codemirror/lang-rust')).rust() },
  {
    name: 'cpp',
    alias: ['c', 'c++', 'h', 'hpp', 'cc'],
    load: async () => (await import('@codemirror/lang-cpp')).cpp(),
  },
  { name: 'java', alias: [], load: async () => (await import('@codemirror/lang-java')).java() },
  { name: 'php', alias: [], load: async () => (await import('@codemirror/lang-php')).php() },
  { name: 'xml', alias: ['svg', 'plist'], load: async () => (await import('@codemirror/lang-xml')).xml() },
  { name: 'yaml', alias: ['yml'], load: async () => (await import('@codemirror/lang-yaml')).yaml() },
  { name: 'go', alias: ['golang'], load: async () => (await import('@codemirror/lang-go')).go() },
  {
    name: 'bash',
    alias: ['sh', 'shell', 'zsh', 'console'],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/shell')).shell),
  },
  {
    name: 'csharp',
    alias: ['cs', 'c#'],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/clike')).csharp),
  },
  {
    name: 'kotlin',
    alias: ['kt'],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/clike')).kotlin),
  },
  {
    name: 'diff',
    alias: ['patch'],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/diff')).diff),
  },
  {
    name: 'dockerfile',
    alias: ['docker'],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/dockerfile')).dockerFile),
  },
  {
    name: 'lua',
    alias: [],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/lua')).lua),
  },
  {
    name: 'ruby',
    alias: ['rb'],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/ruby')).ruby),
  },
  {
    name: 'swift',
    alias: [],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/swift')).swift),
  },
  {
    name: 'toml',
    alias: [],
    load: legacy(async () => (await import('@codemirror/legacy-modes/mode/toml')).toml),
  },
]

/** Language names offered in the code block picker, in display order. */
export const CODE_LANGUAGE_NAMES = ['plain', ...LANGUAGES.map((l) => l.name), 'markdown']

export const codeLanguages: LanguageDescription[] = LANGUAGES.map((lang) =>
  LanguageDescription.of({ name: lang.name, alias: lang.alias, load: lang.load }),
)
