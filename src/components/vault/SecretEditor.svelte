<script lang="ts">
  import { untrack } from 'svelte'
  import Dialog from '../ui/Dialog.svelte'
  import Icon from '../Icon.svelte'
  import {
    secrets,
    KIND_FIELDS,
    KIND_ICONS,
    type OpenSecret,
    type SecretField,
    type SecretKind,
  } from '$lib/secrets/store.svelte'
  import { generatePassword, strengthOf } from '$lib/secrets/generate'
  import { uuid } from '$lib/utils/uuid'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    item: OpenSecret | null
    onclose: () => void
    onsaved: (id: string) => void
  }

  let { item, onclose, onsaved }: Props = $props()

  const start = untrack(() => item)
  let kind = $state<SecretKind>(start?.kind ?? 'login')
  let title = $state(start?.title ?? '')
  let fields = $state<SecretField[]>(
    start ? structuredClone($state.snapshot(start.fields)) : fieldsFor('login'),
  )
  let revealed = $state<Record<string, boolean>>({})
  let generator = $state({ length: 20, digits: true, symbols: true })
  let generatorFor = $state<string | null>(null)

  function fieldsFor(next: SecretKind): SecretField[] {
    return KIND_FIELDS[next].map((f) => ({
      key: f.key,
      label: '',
      value: '',
      secret: f.secret,
      custom: false,
    }))
  }

  function changeKind(next: SecretKind) {
    // Keep anything already typed into fields the new kind also has.
    const typed = new Map(fields.map((f) => [f.key, f.value]))
    kind = next
    fields = fieldsFor(next).map((f) => ({ ...f, value: typed.get(f.key) ?? '' }))
  }

  const multiline = (key: string) => KIND_FIELDS[kind].find((f) => f.key === key)?.multiline ?? false
  const labelOf = (field: SecretField) => (field.custom ? field.label : t(`vault.fields.${field.key}`))

  function addField() {
    fields = [
      ...fields,
      { key: uuid(), label: t('vault.customField'), value: '', secret: false, custom: true },
    ]
  }

  function generate(key: string) {
    const value = generatePassword(generator)
    fields = fields.map((f) => (f.key === key ? { ...f, value } : f))
    revealed = { ...revealed, [key]: true }
  }

  async function save() {
    const data = {
      kind,
      title: title.trim() || t(`vault.kinds.${kind}`),
      favorite: start?.favorite ?? false,
      fields: fields.filter((f) => !f.custom || f.value || f.label),
    }
    const id = await secrets.save(data, start?.id)
    if (id) onsaved(id)
    onclose()
  }
</script>

<Dialog
  label={t(start ? 'vault.editItem' : 'vault.newItem')}
  icon={KIND_ICONS[kind]}
  size="lg"
  {onclose}
  testid="secret-editor"
>
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault()
      void save()
    }}
    oninput={() => secrets.touch()}
  >
    {#if !start}
      <div class="kinds" role="radiogroup" aria-label={t('vault.kind')}>
        {#each Object.keys(KIND_FIELDS) as option (option)}
          <button
            type="button"
            role="radio"
            aria-checked={kind === option}
            class="kind"
            class:kind--active={kind === option}
            onclick={() => changeKind(option as SecretKind)}
          >
            <Icon name={KIND_ICONS[option as SecretKind]} size={16} />
            <span>{t(`vault.kinds.${option}`)}</span>
          </button>
        {/each}
      </div>
    {/if}

    <label class="field">
      <span>{t('vault.title')}</span>
      <input
        class="input"
        data-autofocus
        bind:value={title}
        placeholder={t(`vault.titlePlaceholder.${kind}`)}
        maxlength="80"
      />
    </label>

    {#each fields as field, index (field.key)}
      <div class="field">
        {#if field.custom}
          <div class="custom-head">
            <input
              class="input label-input"
              bind:value={fields[index]!.label}
              aria-label={t('vault.fieldName')}
            />
            <label class="small-check">
              <input type="checkbox" bind:checked={fields[index]!.secret} />
              {t('vault.hidden')}
            </label>
            <button
              type="button"
              class="btn btn--ghost btn--icon"
              aria-label={t('common.delete')}
              onclick={() => (fields = fields.filter((_, i) => i !== index))}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        {:else}
          <span>{labelOf(field)}</span>
        {/if}
        {#if multiline(field.key)}
          <textarea
            class="input area"
            rows="4"
            bind:value={fields[index]!.value}
            aria-label={labelOf(field)}></textarea>
        {:else}
          <div class="with-button">
            <input
              class="input"
              class:mono={field.secret}
              type={field.secret && !revealed[field.key] ? 'password' : 'text'}
              autocomplete="off"
              spellcheck="false"
              aria-label={labelOf(field)}
              data-testid="field-{field.key}"
              bind:value={fields[index]!.value}
            />
            {#if field.secret}
              <button
                type="button"
                class="btn btn--ghost btn--icon"
                aria-label={t(revealed[field.key] ? 'vault.hide' : 'vault.show')}
                onclick={() => (revealed = { ...revealed, [field.key]: !revealed[field.key] })}
              >
                <Icon name={revealed[field.key] ? 'eye-off' : 'eye'} size={15} />
              </button>
            {/if}
            {#if field.key === 'password'}
              <button
                type="button"
                class="btn btn--icon"
                aria-label={t('vault.generate')}
                title={t('vault.generate')}
                onclick={() => {
                  generatorFor = generatorFor === field.key ? null : field.key
                  if (!field.value) generate(field.key)
                }}
              >
                <Icon name="dices" size={15} />
              </button>
            {/if}
          </div>
          {#if field.key === 'password' && field.value}
            {@const strength = strengthOf(field.value)}
            <span class="strength strength--{strength.level}">{t(`vault.strength.${strength.level}`)}</span>
          {/if}
          {#if generatorFor === field.key}
            <div class="generator">
              <label
                >{t('vault.length', { length: generator.length })}
                <input
                  type="range"
                  min="8"
                  max="48"
                  bind:value={generator.length}
                  oninput={() => generate(field.key)}
                />
              </label>
              <label class="small-check"
                ><input
                  type="checkbox"
                  bind:checked={generator.digits}
                  onchange={() => generate(field.key)}
                />0-9</label
              >
              <label class="small-check"
                ><input
                  type="checkbox"
                  bind:checked={generator.symbols}
                  onchange={() => generate(field.key)}
                />!@#</label
              >
              <button type="button" class="btn" onclick={() => generate(field.key)}>
                <Icon name="refresh-cw" size={14} />{t('vault.regenerate')}
              </button>
            </div>
          {/if}
        {/if}
      </div>
    {/each}

    <div>
      <button type="button" class="btn btn--ghost" onclick={addField}>
        <Icon name="plus" size={14} />{t('vault.addField')}
      </button>
    </div>

    <div class="actions">
      <button type="button" class="btn" onclick={onclose}>{t('common.cancel')}</button>
      <button type="submit" class="btn btn--primary" data-testid="save-secret">{t('common.save')}</button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .kinds {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: var(--space-2);
  }

  .kind {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: none;
    color: var(--text-dim);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .kind--active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--text);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field > span {
    color: var(--text-dim);
    font-size: var(--text-md);
  }

  .with-button,
  .custom-head {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .label-input {
    max-width: 16rem;
    height: 26px;
    font-size: var(--text-md);
  }

  .small-check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-faint);
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  .mono {
    font-family: var(--font-mono);
  }

  .area {
    height: auto;
    padding: var(--space-2) var(--space-3);
    resize: vertical;
  }

  .strength {
    font-size: var(--text-sm);
  }

  .strength--weak {
    color: var(--danger);
  }

  .strength--fair {
    color: var(--warn);
  }

  .strength--good,
  .strength--strong {
    color: var(--ok);
  }

  .generator {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-2);
    color: var(--text-dim);
    font-size: var(--text-sm);
  }

  .generator label:first-child {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
