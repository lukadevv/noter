import type { Component } from 'svelte'

export interface SettingsSectionEntry {
  id: string
  icon: string
  /** i18n key of the section title. */
  label: string
  /** i18n keys whose text the settings search should match for this section. */
  keywords: string[]
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  load: () => Promise<{ default: Component<any> }>
}

/**
 * The settings page, one entry per section. Each section is its own chunk and
 * only the open one is mounted, so opening settings never pays for the backup
 * codecs or the storage scan unless you go there.
 */
export const SETTINGS_SECTIONS: SettingsSectionEntry[] = [
  {
    id: 'general',
    icon: 'settings',
    label: 'settings.sections.general',
    keywords: ['settings.language', 'settings.startSection'],
    load: () => import('./General.svelte'),
  },
  {
    id: 'appearance',
    icon: 'palette',
    label: 'settings.sections.appearance',
    keywords: [
      'settings.theme',
      'settings.density',
      'settings.font',
      'settings.cornerRoundness',
      'settings.motion',
    ],
    load: () => import('./Appearance.svelte'),
  },
  {
    id: 'editor',
    icon: 'pencil',
    label: 'settings.sections.editor',
    keywords: ['settings.editorTextSizeLabel', 'settings.lineNumbers'],
    load: () => import('./EditorSettings.svelte'),
  },
  {
    id: 'daily',
    icon: 'calendar-days',
    label: 'settings.sections.daily',
    keywords: ['settings.daily.title', 'settings.daily.template'],
    load: () => import('./DailySettings.svelte'),
  },
  {
    id: 'timers',
    icon: 'timer',
    label: 'settings.sections.timers',
    keywords: ['settings.timers.alarm', 'settings.timers.customSounds', 'settings.timers.defaultSound'],
    load: () => import('./TimerSettings.svelte'),
  },
  {
    id: 'vault',
    icon: 'shield',
    label: 'settings.sections.vault',
    keywords: ['settings.vault.autoLock', 'settings.vault.clipboard', 'settings.vault.change'],
    load: () => import('./VaultSettings.svelte'),
  },
  {
    id: 'notifications',
    icon: 'bell',
    label: 'settings.sections.notifications',
    keywords: ['settings.notifications.enable'],
    load: () => import('./NotificationSettings.svelte'),
  },
  {
    id: 'backup',
    icon: 'archive',
    label: 'settings.sections.backup',
    keywords: ['settings.backup.title', 'settings.auto.title', 'settings.backup.exportMarkdown'],
    load: () => import('./BackupSection.svelte'),
  },
  {
    id: 'storage',
    icon: 'boxes',
    label: 'settings.sections.storage',
    keywords: ['settings.storage.title', 'settings.storage.cleanUp'],
    load: () => import('./StorageSettings.svelte'),
  },
  {
    id: 'about',
    icon: 'info',
    label: 'settings.sections.about',
    keywords: ['settings.about.privacy', 'settings.about.shortcuts', 'settings.about.license'],
    load: () => import('./About.svelte'),
  },
]
