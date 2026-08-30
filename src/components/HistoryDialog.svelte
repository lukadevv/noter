<script lang="ts">
  import Icon from './Icon.svelte'
  import { diffLines, diffSummary, listVersions } from '$lib/db/repo/versions'
  import { relativeTime } from '$lib/utils/dates'
  import { notes } from '$lib/stores/notes.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import type { Version } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    noteId: string
    /** Current text, so the newest snapshot can be diffed against live content. */
    currentTitle: string
    currentBody: string
    onclose: () => void
  }

  let { noteId, currentTitle, currentBody, onclose }: Props = $props()

  let versions = $state<Version[]>([])
  let selected = $state<Version | null>(null)
  let loading = $state(true)

  $effect(() => {
    void listVersions(noteId).then((list) => {
      versions = list
      selected = list[0] ?? null
      loading = false
    })
  })

  let lines = $derived(selected ? diffLines(selected.body, currentBody) : [])
  let summary = $derived(diffSummary(lines))

  async function restore() {
    if (!selected) return
    notes.editBody(noteId, selected.body, selected.title)
    ui.toast(t('history.restoreNote'), 'ok')
    onclose()
  }
</script>

<div class="backdrop" role="presentation" onpointerdown={onclose}></div>

<div
  class="dialog"
  data-testid="history-dialog"
  role="dialog"
  aria-modal="true"
  aria-label={t('history.title')}
>
  <header class="head">
    <Icon name="restore" size={16} />
    <span class="title">{t('history.title')}</span>
    <button class="btn btn--ghost btn--icon" aria-label={t('common.close')} onclick={onclose}>
      <Icon name="x" size={15} />
    </button>
  </header>

  <div class="body">
    <aside class="list">
      {#if loading}
        <p class="empty faint">{t('common.loading')}</p>
      {:else if versions.length === 0}
        <p class="empty faint">
          {t('history.empty')}
        </p>
      {:else}
        {#each versions as version (version.id)}
          <button
            class="entry"
            data-testid="version-entry"
            class:entry--active={selected?.id === version.id}
            onclick={() => (selected = version)}
          >
            <span class="when">{relativeTime(version.createdAt, Date.now(), t)}</span>
            <span class="stamp faint">{new Date(version.createdAt).toLocaleString()}</span>
          </button>
        {/each}
      {/if}
    </aside>

    <div class="diff">
      {#if selected}
        <div class="diff-head">
          <span class="faint">{t('history.comparedWith')}</span>
          <span class="counts numeric">
            <span class="added">+{summary.added}</span>
            <span class="removed">−{summary.removed}</span>
          </span>
        </div>

        {#if selected.title !== currentTitle}
          <p class="title-change faint">
            {t('history.titleChange')}
            <span class="removed">{selected.title || t('common.untitled')}</span> →
            <span class="added">{currentTitle || t('common.untitled')}</span>
          </p>
        {/if}

        <pre class="lines">{#each lines as line, index (index)}<span class="line line--{line.kind}"
              >{line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '} {line.text}
</span>{/each}</pre>
      {:else}
        <p class="empty faint">{t('history.selectVersion')}</p>
      {/if}
    </div>
  </div>

  <footer class="foot">
    <span class="faint">{t('history.restoreNote')}</span>
    <div class="spacer"></div>
    <button class="btn" data-testid="history-close" onclick={onclose}>{t('common.close')}</button>
    <button class="btn btn--primary" data-testid="history-restore" disabled={!selected} onclick={restore}>
      {t('history.restoreVersion')}
    </button>
  </footer>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 52;
    background: var(--overlay);
  }

  .dialog {
    position: fixed;
    z-index: 53;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    width: min(96vw, 52rem);
    height: min(86vh, 40rem);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-2);
    overflow: hidden;
  }

  .head,
  .foot {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .head {
    border-bottom: 1px solid var(--border);
  }

  .foot {
    border-top: 1px solid var(--border);
    font-size: 12px;
    flex-wrap: wrap;
  }

  .title {
    flex: 1;
    font-weight: 650;
  }

  .spacer {
    flex: 1;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
  }

  .list {
    border-inline-end: 1px solid var(--border);
    overflow-y: auto;
    padding: var(--space-1);
  }

  .entry {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius);
    background: none;
    text-align: start;
    cursor: pointer;
  }

  .entry:hover {
    background: var(--surface-2);
  }

  .entry--active {
    background: var(--accent-soft);
  }

  .when {
    font-size: 13px;
    color: var(--text);
  }

  .stamp {
    font-size: 11px;
  }

  .diff {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: var(--space-3);
  }

  .diff-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--space-2);
    font-size: 12px;
  }

  .counts {
    display: flex;
    gap: var(--space-2);
    font-variant-numeric: tabular-nums;
  }

  .title-change {
    padding-bottom: var(--space-2);
    font-size: 12px;
  }

  .lines {
    flex: 1;
    min-height: 0;
    margin: 0;
    overflow: auto;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .line {
    display: block;
  }

  .line--added,
  .added {
    color: var(--ok);
  }

  .line--added {
    background: var(--ok-soft);
  }

  .line--removed,
  .removed {
    color: var(--danger);
  }

  .line--removed {
    background: var(--danger-soft);
  }

  .empty {
    padding: var(--space-4);
    font-size: 12px;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .body {
      grid-template-columns: 1fr;
      grid-template-rows: 34% minmax(0, 1fr);
    }

    .list {
      border-inline-end: none;
      border-bottom: 1px solid var(--border);
    }
  }
</style>
