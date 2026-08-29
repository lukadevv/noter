import { notes } from '$lib/stores/notes.svelte'
import { theme } from '$lib/stores/theme.svelte'
import { ui } from '$lib/stores/ui.svelte'
import { PRESETS } from '$lib/theme/presets'
import { emptyTrash, derivedTitle } from '$lib/db/repo/notes'
import { pickImages } from '$lib/images/insert'
import { todayKey } from '$lib/db/repo/daily'
import { addDays } from '$lib/utils/dates'
import type { ViewMode } from '$lib/db/schema'

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

const VIEW_LABELS: Record<ViewMode, string> = {
  doc: 'Document',
  checklist: 'Checklist',
  board: 'Board',
  gallery: 'Gallery',
  code: 'Code',
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
      label: 'New note',
      hint: 'Ctrl+N',
      icon: 'plus',
      group: 'Create',
      run: () => void notes.newNote(),
    },
    {
      id: 'folder.new',
      label: 'New folder',
      icon: 'folder-plus',
      group: 'Create',
      run: () => void notes.newFolder(),
    },
    {
      id: 'daily.today',
      label: "Open today's note",
      hint: 'Ctrl+Shift+D',
      icon: 'calendar',
      group: 'Create',
      available: () => theme.settings.dailyNotes.enabled,
      run: () => open.daily(),
    },
    {
      id: 'scratchpad.open',
      label: 'Open scratchpad',
      hint: 'Ctrl+Shift+Space',
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
      label: 'Add images to this note',
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
      label: 'Pin or unpin this note',
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
      label: 'Archive this note',
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
      label: 'Use this note as a template',
      icon: 'copy',
      group: 'Note',
      available: () => current() !== null,
      run: () => {
        const note = current()
        if (!note) return
        void notes.toggleTemplate(note.id)
        ui.toast(note.template ? 'No longer a template.' : 'Saved as a template.', 'ok')
      },
    },
    {
      id: 'note.trash',
      label: 'Move this note to trash',
      icon: 'trash',
      group: 'Note',
      available: () => current() !== null && current()!.deletedAt === 0,
      run: () => {
        const note = current()
        if (!note) return
        void notes.trash(note.id)
        ui.toast('Moved to trash.', 'info', { label: 'Undo', run: () => void notes.restore(note.id) })
      },
    },
    {
      id: 'go.all',
      label: 'Go to all notes',
      icon: 'file-text',
      group: 'Go',
      run: () => notes.setScope({ kind: 'folder', id: null }),
    },
    {
      id: 'go.archive',
      label: 'Go to archive',
      icon: 'archive',
      group: 'Go',
      run: () => notes.setScope({ kind: 'archive' }),
    },
    {
      id: 'go.trash',
      label: 'Go to trash',
      icon: 'trash',
      group: 'Go',
      run: () => notes.setScope({ kind: 'trash' }),
    },
    {
      id: 'trash.empty',
      label: 'Empty the trash',
      icon: 'trash',
      group: 'App',
      available: () => notes.trashed.length > 0,
      run: async () => {
        const removed = await emptyTrash()
        ui.toast(`${removed} note(s) permanently deleted.`, 'warn')
      },
    },
    {
      id: 'settings.open',
      label: 'Open settings',
      hint: 'Ctrl+,',
      icon: 'settings',
      group: 'App',
      run: () => open.settings(),
    },
    {
      id: 'appearance.toggle',
      label: 'Toggle light and dark',
      icon: 'lightbulb',
      group: 'Appearance',
      run: () => theme.applyThemeId(theme.settings.themeId === 'dark' ? 'light' : 'dark'),
    },
  ]

  // Per-view actions, so "switch this note to a checklist" is one command.
  for (const [view, label] of Object.entries(VIEW_LABELS) as [ViewMode, string][]) {
    actions.push({
      id: `view.${view}`,
      label: `Switch this note to ${label.toLowerCase()} view`,
      icon: view === 'doc' ? 'file-text' : view === 'checklist' ? 'check-square' : view === 'board' ? 'layout-grid' : view === 'gallery' ? 'image' : 'code',
      group: 'View',
      available: () => current() !== null && current()!.view !== view,
      run: () => {
        const note = current()
        if (note) void notes.update(note.id, { view })
      },
    })
  }

  for (const preset of PRESETS) {
    actions.push({
      id: `theme.${preset.id}`,
      label: `Theme: ${preset.name}`,
      icon: 'lightbulb',
      group: 'Appearance',
      available: () => theme.settings.themeId !== preset.id,
      run: () => theme.applyThemeId(preset.id),
    })
  }

  for (const template of notes.templates) {
    actions.push({
      id: `template.${template.id}`,
      label: `New note from "${derivedTitle(template)}"`,
      icon: 'copy',
      group: 'Create',
      run: () => void notes.newFromTemplate(template.id),
    })
  }

  if (theme.settings.dailyNotes.enabled) {
    actions.push(
      {
        id: 'daily.yesterday',
        label: "Open yesterday's note",
        icon: 'calendar',
        group: 'Create',
        run: () => void notes.openDaily(addDays(todayKey(), -1), theme.settings.dailyNotes),
      },
      {
        id: 'daily.tomorrow',
        label: "Open tomorrow's note",
        icon: 'calendar',
        group: 'Create',
        run: () => void notes.openDaily(addDays(todayKey(), 1), theme.settings.dailyNotes),
      },
    )
  }

  return actions.filter((action) => action.available?.() ?? true)
}
