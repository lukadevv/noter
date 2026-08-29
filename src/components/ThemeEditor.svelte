<script lang="ts">
  import Icon from './Icon.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { contrastRatio, hexToOklch, oklchToHex, type Oklch } from '$lib/theme/oklch'
  import { deriveTokens, type ThemeSeed } from '$lib/theme/tokens'
  import { parseThemeFile } from '$lib/db/repo/themes'
  import { PRESETS_BY_ID } from '$lib/theme/presets'
  import { untrack } from 'svelte'

  interface Props {
    /** Theme id to start from; a built-in one is copied rather than edited. */
    baseId: string
    onclose: () => void
  }

  let { baseId, onclose }: Props = $props()

  // The editor snapshots its starting point on open; `baseId` changing later
  // would mean a different dialog, not a live re-seed of this one.
  const startingId = untrack(() => baseId)
  const editingBuiltin = PRESETS_BY_ID.has(startingId)
  const startingName = untrack(() => theme.available.find((t) => t.id === startingId)?.name)

  let seed = $state<ThemeSeed>(
    structuredClone(untrack(() => theme.seedFor(startingId)) ?? theme.seedFor('dark')!),
  )
  let name = $state(editingBuiltin ? `${startingName ?? 'Theme'} copy` : (startingName ?? 'Custom theme'))

  let tokens = $derived(deriveTokens(seed))

  // Preview live while the editor is open; the active theme is restored if the
  // user closes without saving.
  $effect(() => {
    theme.preview(seed)
  })

  let textContrast = $derived(contrastRatio(tokens.text!, tokens.bg!))
  let accentContrast = $derived(contrastRatio(tokens['accent-contrast']!, tokens.accent!))

  function setColor(key: 'accent' | 'danger' | 'warn' | 'ok', hex: string) {
    const parsed = hexToOklch(hex)
    if (parsed) seed = { ...seed, [key]: parsed }
  }

  function hexOf(color: Oklch): string {
    return oklchToHex(color)
  }

  async function save() {
    await theme.saveCustom(name, $state.snapshot(seed), editingBuiltin ? undefined : startingId)
    ui.toast('Theme saved.', 'ok')
    onclose()
  }

  function exportTheme() {
    const file = { format: 'noter-theme' as const, version: 1 as const, name, seed: $state.snapshot(seed) }
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${name.toLowerCase().replace(/\s+/g, '-')}.noter-theme.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function importTheme() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return
      const parsed = parseThemeFile(await file.text())
      if (!parsed) {
        ui.toast('That file is not a Noter theme.', 'warn')
        return
      }
      name = parsed.name
      seed = parsed.seed as ThemeSeed
      ui.toast('Theme loaded. Save it to keep it.', 'info')
    })
    input.click()
  }

  function close() {
    theme.cancelPreview()
    onclose()
  }
</script>

<div class="backdrop" role="presentation" onpointerdown={close}></div>

<div class="dialog" role="dialog" aria-modal="true" aria-label="Theme editor">
  <header class="head">
    <input class="name" bind:value={name} aria-label="Theme name" />
    <button class="btn btn--ghost btn--icon" aria-label="Close" onclick={close}>
      <Icon name="x" size={16} />
    </button>
  </header>

  <div class="content">
    <div class="field">
      <span class="label">Base</span>
      <div class="segmented">
        {#each ['light', 'dark'] as const as mode (mode)}
          <button
            class="segment"
            class:segment--active={seed.mode === mode}
            onclick={() => (seed = { ...seed, mode })}
          >
            {mode}
          </button>
        {/each}
      </div>
    </div>

    <div class="field">
      <label for="accent">Accent</label>
      <div class="colour-row">
        <input id="accent" type="color" value={hexOf(seed.accent)} oninput={(e) => setColor('accent', e.currentTarget.value)} />
        <input
          type="range"
          min="0.3"
          max="0.95"
          step="0.01"
          value={seed.accent.l}
          aria-label="Accent lightness"
          oninput={(e) => (seed = { ...seed, accent: { ...seed.accent, l: Number(e.currentTarget.value) } })}
        />
        <input
          type="range"
          min="0"
          max="0.32"
          step="0.005"
          value={seed.accent.c}
          aria-label="Accent chroma"
          oninput={(e) => (seed = { ...seed, accent: { ...seed.accent, c: Number(e.currentTarget.value) } })}
        />
      </div>
      <span class="hint faint">Colour, then lightness and saturation.</span>
    </div>

    <div class="field">
      <label for="neutral-hue">Surface tint · hue {Math.round(seed.neutralHue)}°</label>
      <input
        id="neutral-hue"
        type="range"
        min="0"
        max="360"
        step="1"
        value={seed.neutralHue}
        oninput={(e) => (seed = { ...seed, neutralHue: Number(e.currentTarget.value) })}
      />
      <input
        type="range"
        min="0"
        max="0.05"
        step="0.002"
        value={seed.neutralChroma}
        aria-label="Surface tint strength"
        oninput={(e) => (seed = { ...seed, neutralChroma: Number(e.currentTarget.value) })}
      />
      <span class="hint faint">A slight tint reads far better than pure grey.</span>
    </div>

    <div class="field">
      <span class="label">Status colours</span>
      <div class="colour-row">
        {#each [['danger', 'Danger'], ['warn', 'Warning'], ['ok', 'Success']] as const as [key, label] (key)}
          <label class="swatch">
            <input
              type="color"
              value={hexOf(seed[key])}
              aria-label={label}
              oninput={(e) => setColor(key, e.currentTarget.value)}
            />
            <span class="faint">{label}</span>
          </label>
        {/each}
      </div>
    </div>

    <!-- Contrast is checked as you drag, so an unreadable theme cannot be saved
         by accident. -->
    <div class="checks">
      <div class="check-row" class:check-row--bad={textContrast < 4.5}>
        <Icon name={textContrast >= 4.5 ? 'check' : 'x'} size={14} />
        Body text on background · {textContrast.toFixed(1)}:1
        <span class="faint">{textContrast >= 4.5 ? 'passes AA' : 'below AA (4.5:1)'}</span>
      </div>
      <div class="check-row" class:check-row--bad={accentContrast < 4.5}>
        <Icon name={accentContrast >= 4.5 ? 'check' : 'x'} size={14} />
        Label on accent · {accentContrast.toFixed(1)}:1
        <span class="faint">{accentContrast >= 4.5 ? 'passes AA' : 'below AA (4.5:1)'}</span>
      </div>
    </div>

    <div class="preview">
      <div class="preview-row">
        <button class="btn btn--primary">Primary</button>
        <button class="btn">Secondary</button>
        <span class="pill" style="background: {tokens['accent-soft']}">Selected</span>
      </div>
      <p class="preview-text">
        The quick brown fox jumps over the lazy dog.
        <span class="faint">Secondary text sits here.</span>
      </p>
    </div>
  </div>

  <footer class="foot">
    <button class="btn btn--ghost" onclick={importTheme}>Import</button>
    <button class="btn btn--ghost" onclick={exportTheme}>Export</button>
    <div class="spacer"></div>
    {#if !editingBuiltin}
      <button
        class="btn btn--ghost btn--danger"
        onclick={async () => {
          await theme.deleteCustom(startingId)
          onclose()
        }}
      >
        Delete
      </button>
    {/if}
    <button class="btn" onclick={close}>Cancel</button>
    <button class="btn btn--primary" onclick={save}>Save theme</button>
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
    width: min(94vw, 32rem);
    max-height: 88vh;
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
    flex-wrap: wrap;
  }

  .spacer {
    flex: 1;
  }

  .name {
    flex: 1;
    min-width: 0;
    height: 30px;
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: none;
    font-size: 15px;
    font-weight: 650;
  }

  .name:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg-2);
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .field label,
  .label {
    font-size: 12px;
    color: var(--text-dim);
  }

  .hint {
    font-size: 11px;
  }

  .colour-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .colour-row input[type='range'] {
    flex: 1;
    accent-color: var(--accent);
  }

  input[type='color'] {
    width: 36px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
  }

  input[type='range'] {
    accent-color: var(--accent);
  }

  .swatch {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 11px;
  }

  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
  }

  .segment {
    flex: 1;
    height: 26px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-dim);
    font-size: 12px;
    text-transform: capitalize;
    cursor: pointer;
  }

  .segment--active {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .checks {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-4);
    font-size: 12px;
  }

  .check-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--ok);
  }

  .check-row--bad {
    color: var(--danger);
  }

  .preview {
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
  }

  .preview-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .pill {
    padding: 4px var(--space-3);
    border-radius: var(--radius-full);
    font-size: 12px;
  }

  .preview-text {
    font-size: 13px;
    line-height: 1.6;
  }
</style>
