<script lang="ts">
  import Icon from '../Icon.svelte'
  import BoardView from '../BoardView.svelte'
  import GalleryView from '../GalleryView.svelte'
  import { t } from '$lib/i18n/index.svelte'

  /**
   * A ```board or ```gallery block, drawn inside the editor.
   *
   * It edits only the text between its fences: every change is handed back as
   * the new inner text and the editor turns that into a normal, undoable edit
   * of the note. The "</>" button shows the markdown instead, for hand edits.
   */
  interface Props {
    kind: 'board' | 'gallery'
    source: string
    readOnly: boolean
    onchange: (inner: string) => void
    onraw: () => void
    ondelete: () => void
    onpickimages: () => Promise<string[]>
  }

  let { kind, source, readOnly, onchange, onraw, ondelete, onpickimages }: Props = $props()

  async function addImages() {
    const refs = await onpickimages()
    if (refs.length === 0) return
    const trimmed = source.replace(/\s+$/, '')
    onchange(`${trimmed}${trimmed ? '\n' : ''}${refs.join('\n')}`)
  }

  function removeImage(id: string) {
    const lines = source.split('\n').map((line) => line.replace(`![[img:${id}]]`, '').trimEnd())
    onchange(lines.filter((line, i) => line || i === 0).join('\n'))
  }
</script>

<div class="block block--{kind}" data-testid="{kind}-block">
  <header class="bar">
    <Icon name={kind === 'board' ? 'square-kanban' : 'images'} size={14} />
    <span class="label">{t(kind === 'board' ? 'blocks.board' : 'blocks.gallery')}</span>
    <span class="spacer"></span>
    {#if !readOnly}
      <button
        class="tool"
        aria-label={t('blocks.editSource')}
        title={t('blocks.editSource')}
        onclick={onraw}
      >
        <Icon name="code" size={14} />
      </button>
      <button class="tool" aria-label={t('blocks.delete')} title={t('blocks.delete')} onclick={ondelete}>
        <Icon name="trash" size={14} />
      </button>
    {/if}
  </header>
  {#if kind === 'board'}
    <BoardView body={source} {readOnly} inline onchange={(next) => onchange(next)} />
  {:else}
    <GalleryView body={source} {readOnly} inline onadd={addImages} onremove={removeImage} />
  {/if}
</div>

<style>
  .block {
    margin: var(--space-2) 0;
    padding: var(--space-2) var(--space-3) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    font-family: var(--font-ui);
    font-size: var(--font-size);
    line-height: var(--line-height);
    white-space: normal;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    color: var(--text-faint);
    font-size: var(--text-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .spacer {
    flex: 1;
  }

  .tool {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
    opacity: 0;
    transition:
      opacity var(--dur-1),
      background var(--dur-1);
  }

  .block:hover .tool,
  .block:focus-within .tool {
    opacity: 1;
  }

  .tool:hover {
    background: var(--surface-3);
    color: var(--text);
  }

  @media (pointer: coarse) {
    .tool {
      opacity: 1;
    }
  }
</style>
