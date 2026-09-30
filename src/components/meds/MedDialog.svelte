<script lang="ts">
  import { untrack } from 'svelte'
  import Dialog from '../ui/Dialog.svelte'
  import Segmented from '../ui/Segmented.svelte'
  import { meds } from '$lib/meds/store.svelte'
  import type { Med } from '$lib/db/schema'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    med: Med | null
    onclose: () => void
  }

  let { med, onclose }: Props = $props()

  const COLORS = [null, '#e06a5a', '#d9a441', '#5cbf92', '#4fb3d9', '#8b8ce8', '#c27ad8']
  const INTERVALS = [4, 6, 8, 12, 24]
  const LEADS = [0, 15, 60, 180, 300]

  const start = untrack(() => med)
  let name = $state(start?.name ?? '')
  let dose = $state(start?.dose ?? '')
  let interval = $state(start?.intervalHours ?? 24)
  let custom = $state(!INTERVALS.includes(start?.intervalHours ?? 24))
  let lead = $state(start?.leadMinutes ?? 60)
  let trackStock = $state(start ? start.stock !== null : false)
  let stock = $state(start?.stock ?? 30)
  let perDose = $state(start?.perDose ?? 1)
  let color = $state<string | null>(start?.color ?? null)
  let notes = $state(start?.notes ?? '')

  let valid = $derived(name.trim().length > 0 && interval >= 0.25 && interval <= 24 * 14)

  async function save() {
    if (!valid) return
    await meds.save({
      id: start?.id,
      name: name.trim(),
      dose: dose.trim(),
      intervalHours: interval,
      leadMinutes: lead,
      stock: trackStock ? Math.max(0, stock) : null,
      perDose: Math.max(1, perDose),
      color,
      notes: notes.trim(),
    })
    onclose()
  }

  function leadLabel(minutes: number): string {
    if (minutes === 0) return t('meds.leadAtTime')
    return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`
  }
</script>

<Dialog label={t(start ? 'meds.edit' : 'meds.add')} icon="pill" {onclose} testid="med-dialog">
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault()
      void save()
    }}
  >
    <div class="two">
      <label class="field">
        <span>{t('meds.name')}</span>
        <input
          class="input"
          data-autofocus
          bind:value={name}
          placeholder={t('meds.namePlaceholder')}
          maxlength="60"
        />
      </label>
      <label class="field">
        <span>{t('meds.dose')}</span>
        <input class="input" bind:value={dose} placeholder={t('meds.dosePlaceholder')} maxlength="40" />
      </label>
    </div>

    <div class="field">
      <span>{t('meds.every')}</span>
      <div class="row">
        <Segmented
          label={t('meds.every')}
          value={custom ? 0 : interval}
          options={[
            ...INTERVALS.map((h) => ({ value: h, label: `${h} h` })),
            { value: 0, label: t('meds.custom') },
          ]}
          onchange={(value) => {
            custom = value === 0
            if (value !== 0) interval = value
          }}
        />
        {#if custom}
          <label class="inline">
            <input class="input narrow" type="number" min="0.25" step="0.25" bind:value={interval} />
            <span>h</span>
          </label>
        {/if}
      </div>
      <span class="hint">{t('meds.everyHint')}</span>
    </div>

    <label class="field">
      <span>{t('meds.lead')}</span>
      <select class="input" bind:value={lead}>
        {#each LEADS as minutes (minutes)}
          <option value={minutes}>{leadLabel(minutes)}</option>
        {/each}
      </select>
      <span class="hint">{t('meds.leadHint')}</span>
    </label>

    <div class="field">
      <label class="check">
        <input type="checkbox" bind:checked={trackStock} />
        {t('meds.trackStock')}
      </label>
      {#if trackStock}
        <div class="two">
          <label class="field">
            <span>{t('meds.stock')}</span>
            <input class="input" type="number" min="0" bind:value={stock} />
          </label>
          <label class="field">
            <span>{t('meds.perDose')}</span>
            <input class="input" type="number" min="1" bind:value={perDose} />
          </label>
        </div>
      {/if}
    </div>

    <fieldset class="field">
      <legend>{t('timers.color')}</legend>
      <div class="swatches">
        {#each COLORS as swatch (swatch ?? 'none')}
          <button
            type="button"
            class="swatch"
            class:swatch--active={color === swatch}
            class:swatch--none={swatch === null}
            style={swatch ? `--c: ${swatch}` : ''}
            aria-label={swatch ?? t('common.none')}
            aria-pressed={color === swatch}
            onclick={() => (color = swatch)}
          ></button>
        {/each}
      </div>
    </fieldset>

    <label class="field">
      <span>{t('meds.notes')}</span>
      <textarea class="input area" rows="2" bind:value={notes} placeholder={t('meds.notesPlaceholder')}
      ></textarea>
    </label>

    <p class="disclaimer">{t('meds.disclaimer')}</p>

    <div class="actions">
      <button type="button" class="btn" onclick={onclose}>{t('common.cancel')}</button>
      <button type="submit" class="btn btn--primary" disabled={!valid}>{t('common.save')}</button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    border: 0;
  }

  .field > span,
  legend {
    color: var(--text-dim);
    font-size: var(--text-md);
    padding: 0;
    margin-bottom: var(--space-1);
  }

  .hint {
    color: var(--text-faint) !important;
    font-size: var(--text-sm) !important;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .inline {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-faint);
  }

  .narrow {
    width: 5.5rem;
  }

  .area {
    height: auto;
    padding: var(--space-2) var(--space-3);
    resize: vertical;
  }

  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
  }

  .swatches {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .swatch {
    width: 28px;
    height: 28px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--c);
    cursor: pointer;
  }

  .swatch--none {
    background: repeating-linear-gradient(45deg, var(--surface-3) 0 4px, var(--surface-2) 4px 8px);
  }

  .swatch--active {
    border-color: var(--text);
  }

  .disclaimer {
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  @media (max-width: 560px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
</style>
