<script lang="ts">
  import Icon from './Icon.svelte'
  import { findTasks, removeCompletedTasks, toggleTaskAtLine } from '$lib/md/tasks'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    body: string
    readOnly?: boolean
    onchange: (body: string) => void
  }

  let { body, readOnly = false, onchange }: Props = $props()

  let hideDone = $state(false)
  let draft = $state('')

  let tasks = $derived(findTasks(body))
  let done = $derived(tasks.filter((t) => t.done).length)
  let percent = $derived(tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100))
  let visible = $derived(hideDone ? tasks.filter((t) => !t.done) : tasks)

  /** Lines that are not tasks, shown above the list so notes keep their context. */
  let intro = $derived.by(() => {
    const taskLines = new Set(tasks.map((t) => t.line))
    return body
      .split('\n')
      .filter((line, index) => !taskLines.has(index) && line.trim())
      .join('\n')
      .trim()
  })

  function addTask() {
    const text = draft.trim()
    if (!text) return
    const trimmed = body.replace(/\s+$/, '')
    onchange(`${trimmed}${trimmed ? '\n' : ''}- [ ] ${text}`)
    draft = ''
  }

  function editTask(line: number, text: string) {
    const lines = body.split('\n')
    const source = lines[line]
    if (source === undefined) return
    lines[line] = source.replace(/(\[[ xX]\]\s*).*$/, `$1${text}`)
    onchange(lines.join('\n'))
  }

  function removeTask(line: number) {
    const lines = body.split('\n')
    lines.splice(line, 1)
    onchange(lines.join('\n'))
  }
</script>

<div class="checklist">
  <header class="summary">
    <div class="bar" role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
      <div class="fill" style="width: {percent}%"></div>
    </div>
    <span class="stat faint numeric">{done} / {tasks.length}</span>
    {#if done > 0}
      <button class="btn btn--ghost" onclick={() => (hideDone = !hideDone)}>
        {t(hideDone ? 'checklist.showDone' : 'checklist.hideDone')}
      </button>
      {#if !readOnly}
        <button class="btn btn--ghost btn--danger" onclick={() => onchange(removeCompletedTasks(body))}>
          {t('checklist.clearDone')}
        </button>
      {/if}
    {/if}
  </header>

  <div class="scroller">
    {#if intro}
      <p class="intro muted">{intro}</p>
    {/if}

    <ul class="tasks">
      {#each visible as task (task.line)}
        <li class="task" class:task--done={task.done} style="--indent: {task.indent.length}">
          <input
            type="checkbox"
            checked={task.done}
            disabled={readOnly}
            aria-label={task.text || t('checklist.task')}
            onchange={() => onchange(toggleTaskAtLine(body, task.line))}
          />
          <input
            class="text"
            value={task.text}
            disabled={readOnly}
            placeholder={t('checklist.emptyTask')}
            onchange={(e) => editTask(task.line, e.currentTarget.value)}
          />
          {#if !readOnly}
            <button
              class="remove"
              aria-label={t('checklist.deleteTask')}
              onclick={() => removeTask(task.line)}
            >
              <Icon name="x" size={13} />
            </button>
          {/if}
        </li>
      {/each}
    </ul>

    {#if tasks.length === 0}
      <p class="empty faint">
        {t('checklist.empty')}
      </p>
    {/if}

    {#if !readOnly}
      <!-- The button is the point: Enter alone is unreachable with a mouse and
           does not exist on a phone keyboard's default layout. -->
      <form
        class="add"
        onsubmit={(e) => {
          e.preventDefault()
          addTask()
        }}
      >
        <Icon name="plus" size={15} />
        <input class="new" bind:value={draft} placeholder={t('checklist.addTask')} />
        <button class="btn btn--primary add-button" disabled={!draft.trim()}>
          {t('common.add')}
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .checklist {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .summary {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    max-width: 46rem;
    width: 100%;
    margin: 0 auto;
    padding: 0 var(--space-4) var(--space-3);
  }

  .bar {
    flex: 1;
    height: 5px;
    border-radius: var(--radius-full);
    background: var(--surface-2);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--accent);
    border-radius: inherit;
    transition: width var(--transition);
  }

  .stat {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    max-width: 46rem;
    width: 100%;
    margin: 0 auto;
    padding: 0 var(--space-4) var(--space-6);
  }

  .intro {
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    white-space: pre-wrap;
  }

  .tasks {
    list-style: none;
  }

  .task {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-inline-start: calc(var(--indent) * 8px);
    border-radius: var(--radius);
  }

  .task:hover {
    background: var(--surface);
  }

  .task input[type='checkbox'] {
    flex: none;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .text {
    flex: 1;
    min-width: 0;
    height: calc(30px * var(--density));
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: var(--editor-font-size);
  }

  .text:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg-2);
  }

  .task--done .text {
    color: var(--text-faint);
    text-decoration: line-through;
  }

  .remove {
    display: flex;
    flex: none;
    padding: 5px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    cursor: pointer;
  }

  /* Hidden until hover only where hovering exists. On a touch screen there is
     no hover state, so the control would simply never appear. */
  @media (hover: hover) and (pointer: fine) {
    .remove {
      opacity: 0;
    }

    .task:hover .remove,
    .remove:focus-visible {
      opacity: 1;
    }
  }

  .remove:hover {
    background: var(--danger-soft);
    color: var(--danger);
  }

  .add {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding-inline-start: var(--space-1);
    color: var(--text-faint);
  }

  .new {
    flex: 1;
    height: calc(30px * var(--density));
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: var(--editor-font-size);
  }

  .new:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg-2);
  }

  .add-button {
    flex: none;
  }

  .add-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .empty {
    padding: var(--space-4) 0;
    font-size: 13px;
  }
</style>
