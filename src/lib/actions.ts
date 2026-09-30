import { notes } from '$lib/stores/notes.svelte'
import { theme } from '$lib/stores/theme.svelte'
import { ui } from '$lib/stores/ui.svelte'
import { PRESETS } from '$lib/theme/presets'
import { emptyTrash, derivedTitle } from '$lib/db/repo/notes'
import { pickImages } from '$lib/images/insert'
import { todayKey } from '$lib/db/repo/daily'
import { addDays } from '$lib/utils/dates'
import { goTo } from '$lib/nav'
import { t } from '$lib/i18n/index.svelte'

export interface Action {
  id: string
  label: string
  /** Secondary text: a shortcut, or a note of what the action will do. */
  hint?: string
  icon?: string
  group: 'Create' | 'Note' | 'Go' | 'View' | 'Appearance' | 'App'
  /** Hidden when this returns false, so the palette never offers a no-op. */
  available?: () => boolean
  run: () => void | Promise<void>
}

/**
 * The single registry of things the app can do.
 *
 * The command palette, the keyboard shortcuts and the menus all read from here,
 * so an action can never exist in one surface and be missing from another.
 */
export function buildActions(open: { settings: () => void; daily: () => void }): Action[] {
  const current = () => notes.activeNote

  const actions: Action[] = [
    {
      id: 'note.new',
      label: t('actions.newNote'),
      hint: 'Mod+N',
      icon: 'plus',
      group: 'Create',
      run: () => void notes.newNote(),
    },
    {
      id: 'folder.new',
      label: t('actions.newFolder'),
      icon: 'folder-plus',
      group: 'Create',
      run: () => void notes.newFolder(),
    },
    {
      id: 'daily.today',
      label: t('actions.openToday'),
      hint: 'Mod+Shift+D',
      icon: 'calendar',
      group: 'Create',
      available: () => theme.settings.dailyNotes.enabled,
      run: () => open.daily(),
    },
    {
      id: 'scratchpad.open',
      label: t('actions.openScratchpad'),
      hint: 'Mod+Shift+Space',
      icon: 'lightbulb',
      group: 'Create',
      run: async () => {
        const note = await notes.openScratchpad()
        notes.select(note.id)
        if (ui.narrow) ui.showPane('note')
      },
    },
    {
      id: 'images.add',
      label: t('actions.addImages'),
      icon: 'image',
      group: 'Note',
      available: () => current() !== null,
      run: async () => {
        const note = current()
        if (!note) return
        const snippets = await pickImages()
        if (snippets.length === 0) return
        const trimmed = note.body.replace(/\s+$/, '')
        notes.editBody(note.id, `${trimmed}${trimmed ? '\n\n' : ''}${snippets.join('\n')}`, note.title)
      },
    },
    {
      id: 'note.pin',
      label: t('actions.togglePin'),
      icon: 'pin',
      group: 'Note',
      available: () => current() !== null,
      run: () => {
        const note = current()
        if (note) void notes.togglePin(note.id)
      },
    },
    {
      id: 'note.archive',
      label: t('actions.archive'),
      icon: 'archive',
      group: 'Note',
      available: () => current() !== null && current()!.archivedAt === 0,
      run: () => {
        const note = current()
        if (note) void notes.setArchived(note.id, true)
      },
    },
    {
      id: 'note.template',
      label: t('actions.asTemplate'),
      icon: 'copy',
      group: 'Note',
      available: () => current() !== null,
      run: () => {
        const note = current()
        if (!note) return
        void notes.toggleTemplate(note.id)
        ui.toast(t(note.template ? 'toast.templateRemoved' : 'toast.templateSaved'), 'ok')
      },
    },
    {
      id: 'note.trash',
      label: t('actions.trash'),
      icon: 'trash',
      group: 'Note',
      available: () => current() !== null && current()!.deletedAt === 0,
      run: () => {
        const note = current()
        if (!note) return
        void notes.trash(note.id)
        ui.toast(t('toast.movedToTrash'), 'info', {
          label: t('toast.undo'),
          run: () => void notes.restore(note.id),
        })
      },
    },
    {
      id: 'go.all',
      label: t('actions.goAll'),
      icon: 'file-text',
      group: 'Go',
      run: () => notes.setScope({ kind: 'folder', id: null }),
    },
    {
      id: 'go.archive',
      label: t('actions.goArchive'),
      icon: 'archive',
      group: 'Go',
      run: () => notes.setScope({ kind: 'archive' }),
    },
    {
      id: 'go.trash',
      label: t('actions.goTrash'),
      icon: 'trash',
      group: 'Go',
      run: () => notes.setScope({ kind: 'trash' }),
    },
    {
      id: 'trash.empty',
      label: t('actions.emptyTrash'),
      icon: 'trash',
      group: 'App',
      available: () => notes.trashed.length > 0,
      run: async () => {
        const removed = await emptyTrash()
        ui.toast(t('toast.notesDeleted', { count: removed }), 'warn')
      },
    },
    {
      id: 'settings.open',
      label: t('actions.openSettings'),
      hint: 'Mod+,',
      icon: 'settings',
      group: 'App',
      run: () => open.settings(),
    },
    {
      id: 'appearance.toggle',
      label: t('actions.toggleTheme'),
      icon: 'lightbulb',
      group: 'Appearance',
      run: () => theme.applyThemeId(theme.settings.themeId === 'dark' ? 'light' : 'dark'),
    },
  ]

  actions.push(
    {
      id: 'go.home',
      label: t('actions.goHome'),
      icon: 'house',
      hint: 'Mod+1',
      group: 'Go',
      run: () => goTo('home'),
    },
    {
      id: 'note.lock',
      label: t('actions.toggleLock'),
      icon: 'lock-keyhole',
      hint: 'Mod+Shift+L',
      group: 'Note',
      available: () => current() !== null && !current()!.deletedAt,
      run: () => {
        const note = current()
        if (note) void notes.setEditLock(note.id, note.editLock !== 1)
      },
    },
  )

  for (const preset of PRESETS) {
    actions.push({
      id: `theme.${preset.id}`,
      label: t('actions.themeNamed', { name: preset.name }),
      icon: 'lightbulb',
      group: 'Appearance',
      available: () => theme.settings.themeId !== preset.id,
      run: () => theme.applyThemeId(preset.id),
    })
  }

  for (const template of notes.templates) {
    actions.push({
      id: `template.${template.id}`,
      label: t('actions.fromTemplate', { title: derivedTitle(template) }),
      icon: 'copy',
      group: 'Create',
      run: () => void notes.newFromTemplate(template.id),
    })
  }

  if (theme.settings.dailyNotes.enabled) {
    actions.push(
      {
        id: 'daily.yesterday',
        label: t('actions.openYesterday'),
        icon: 'calendar',
        group: 'Create',
        run: () => void notes.openDaily(addDays(todayKey(), -1), theme.settings.dailyNotes),
      },
      {
        id: 'daily.tomorrow',
        label: t('actions.openTomorrow'),
        icon: 'calendar',
        group: 'Create',
        run: () => void notes.openDaily(addDays(todayKey(), 1), theme.settings.dailyNotes),
      },
    )
  }

  return actions.filter((action) => action.available?.() ?? true)
}
