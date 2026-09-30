<script lang="ts">
  import Group from './Group.svelte'
  import Field from '../ui/Field.svelte'
  import Switch from '../ui/Switch.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { t } from '$lib/i18n/index.svelte'
</script>

<Group>
  <Field
    label={t('settings.editorTextSizeLabel')}
    hint={t('settings.editorTextSize', { size: theme.settings.editorFontSize })}
    for="font-size"
  >
    <input
      id="font-size"
      type="range"
      min="12"
      max="22"
      step="1"
      value={theme.settings.editorFontSize}
      oninput={(e) => theme.live({ editorFontSize: Number(e.currentTarget.value) })}
      onchange={(e) => theme.update({ editorFontSize: Number(e.currentTarget.value) })}
    />
  </Field>

  <Switch
    label={t('settings.lineNumbers')}
    checked={theme.settings.showLineNumbers}
    onchange={(showLineNumbers) => theme.update({ showLineNumbers })}
  />
</Group>
