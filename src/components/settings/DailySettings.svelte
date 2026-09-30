<script lang="ts">
  import Group from './Group.svelte'
  import Field from '../ui/Field.svelte'
  import Switch from '../ui/Switch.svelte'
  import Kbd from '../ui/Kbd.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { notes } from '$lib/stores/notes.svelte'
  import { derivedTitle } from '$lib/db/repo/notes'
  import { formatDailyTitle, todayKey } from '$lib/db/repo/daily'
  import { ROOT } from '$lib/db/schema'
  import type { DailyNoteSettings } from '$lib/db/repo/settings'
  import { t } from '$lib/i18n/index.svelte'

  let daily = $derived(theme.settings.dailyNotes)

  function set(patch: Partial<DailyNoteSettings>) {
    theme.update({ dailyNotes: { ...daily, ...patch } })
  }
</script>

<Group description={t('settings.daily.about')}>
  <Switch
    label={t('settings.daily.enable')}
    checked={daily.enabled}
    onchange={(enabled) => set({ enabled })}
  />

  {#if daily.enabled}
    <Field label={t('settings.daily.folder')} for="daily-folder">
      <select
        id="daily-folder"
        class="input"
        value={daily.folderId}
        onchange={(e) => set({ folderId: e.currentTarget.value })}
      >
        <option value={ROOT}>{t('settings.daily.noFolder')}</option>
        {#each notes.visibleFolders as folder (folder.id)}
          <option value={folder.id}>{' '.repeat(folder.depth * 2)}{folder.name}</option>
        {/each}
      </select>
    </Field>

    <Field
      label={t('settings.daily.titleFormat', { preview: formatDailyTitle(todayKey(), daily.titleFormat) })}
      hint={t('settings.daily.formatTokens')}
      for="daily-format"
    >
      <input
        id="daily-format"
        class="input"
        value={daily.titleFormat}
        onchange={(e) => set({ titleFormat: e.currentTarget.value })}
      />
    </Field>

    {#if notes.templates.length > 0}
      <Field label={t('settings.daily.template')} for="daily-template">
        <select
          id="daily-template"
          class="input"
          value={daily.templateId ?? ''}
          onchange={(e) => set({ templateId: e.currentTarget.value || null })}
        >
          <option value="">{t('common.none')}</option>
          {#each notes.templates as template (template.id)}
            <option value={template.id}>{derivedTitle(template)}</option>
          {/each}
        </select>
      </Field>
    {/if}

    <p class="faint shortcut">
      {t('settings.daily.shortcutLabel')}
      <Kbd keys="Mod+Shift+D" />
    </p>
  {/if}
</Group>

<style>
  .shortcut {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-md);
  }
</style>
