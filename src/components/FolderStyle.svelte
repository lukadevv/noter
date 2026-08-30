<script lang="ts">
  import Icon from './Icon.svelte'
  import IconPicker from './IconPicker.svelte'
  import { updateFolder } from '$lib/db/repo/folders'
  import { oklchToHex } from '$lib/theme/oklch'
  import type { Folder, IconRef } from '$lib/db/schema'
  import { untrack } from 'svelte'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    folder: Folder
    onclose: () => void
  }

  let { folder, onclose }: Props = $props()

  let pickerOpen = $state(false)
  // The dialog edits a copy; nothing is written until Apply.
  let icon = $state<IconRef>(untrack(() => folder.icon))
  let color = $state<string | null>(untrack(() => folder.color))

  /** A spread of hues at one lightness, so no swatch dominates the others. */
  const SWATCHES = [0, 30, 60, 100, 145, 190, 225, 265, 300, 335].map((h) =>
    oklchToHex({ l: 0.7, c: 0.15, h }),
  )

  async function apply() {
    await updateFolder(folder.id, { icon, color })
    onclose()
  }
</script>

<div class="backdrop" role="presentation" onpointerdown={onclose}></div>

<div class="dialog" role="dialog" aria-modal="true" aria-label={t('folderStyle.title')}>
  <header class="head">
    <span class="preview" style={color ? `color: ${color}` : ''}>
      <Icon name={icon} size={18} />
    </span>
    <span class="title truncate">{folder.name}</span>
    <button class="btn btn--ghost btn--icon" aria-label={t('common.close')} onclick={onclose}>
      <Icon name="x" size={15} />
    </button>
  </header>

  <div class="content">
    <div class="field">
      <span class="label">{t('folderStyle.icon')}</span>
      <button class="btn" onclick={() => (pickerOpen = true)}>
        <Icon name={icon} size={15} />
        {t('icons.changeIcon')}
      </button>
    </div>

    <div class="field">
      <span class="label">{t('folderStyle.accent')}</span>
      <p class="hint faint">
        {t('folderStyle.accentHint')}
      </p>
      <div class="swatches">
        <button
          class="swatch swatch--none"
          class:swatch--active={color === null}
          aria-label={t('folderStyle.noAccent')}
          onclick={() => (color = null)}
        >
          <Icon name="x" size={12} />
        </button>
        {#each SWATCHES as hex (hex)}
          <button
            class="swatch"
            class:swatch--active={color === hex}
            style="background: {hex}"
            aria-label="Accent {hex}"
            onclick={() => (color = hex)}
          ></button>
        {/each}
        <label class="swatch swatch--custom">
          <input type="color" value={color ?? '#888888'} oninput={(e) => (color = e.currentTarget.value)} />
        </label>
      </div>
    </div>
  </div>

  <footer class="foot">
    <button class="btn" onclick={onclose}>{t('common.cancel')}</button>
    <button class="btn btn--primary" onclick={apply}>{t('common.apply')}</button>
  </footer>
</div>

{#if pickerOpen}
  <IconPicker
    value={icon}
    onpick={(picked) => {
      icon = picked
      pickerOpen = false
    }}
    onclose={() => (pickerOpen = false)}
  />
{/if}

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
    width: min(94vw, 24rem);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-2);
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  .preview {
    display: flex;
    flex: none;
  }

  .title {
    flex: 1;
    min-width: 0;
    font-weight: 650;
  }

  .content {
    padding: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .field:last-child {
    margin-bottom: 0;
  }

  .label {
    font-size: 12px;
    color: var(--text-dim);
  }

  .hint {
    font-size: 11px;
    line-height: 1.5;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .swatch {
    width: 26px;
    height: 26px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  .swatch--active {
    border-color: var(--text);
  }

  .swatch--none {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--border-strong);
    background: none;
    color: var(--text-faint);
  }

  .swatch--custom {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--border-strong);
    background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
  }

  .swatch--custom input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .foot {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3);
    border-top: 1px solid var(--border);
  }
</style>
