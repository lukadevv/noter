import type { MenuItem } from '$lib/ui-types'
import type { Note } from '$lib/db/schema'
import { ROOT } from '$lib/db/schema'
import { notes } from '$lib/stores/notes.svelte'
import { ui } from '$lib/stores/ui.svelte'
import { dialogs } from '$lib/stores/dialogs.svelte'
import { t } from '$lib/i18n/index.svelte'

/** One entry per folder, indented by depth, plus "No folder". */
export function folderTargets(run: (folderId: string) => void, current?: string): MenuItem[] {
  return [
    {
      id: 'root',
      label: t('list.noFolder'),
      icon: 'file-text',
      checked: current === ROOT,
      run: () => run(ROOT),
    },
    ...notes.visibleFolders.map((folder, index) => ({
      id: folder.id,
      label: `${'  '.repeat(folder.depth)}${folder.name}`,
      icon: 'folder',
      checked: current === folder.id,
      separatorBefore: index === 0,
      run: () => run(folder.id),
    })),
  ]
}

function trashWithUndo(id: string) {
  void notes.trash(id)
  ui.toast(t('toast.movedToTrash'), 'info', {
    label: t('toast.undo'),
    run: () => void notes.restore(id),
  })
}

export interface NoteMenuOptions {
  /** Extra items only the open note offers (images, history, share…). */
  extra?: MenuItem[]
}

/**
 * Everything you can do to a note. The list row, its right-click and the note
 * header's "…" all open this list; Pin stays first, as people expect it there.
 */
export function noteMenuItems(note: Note, options: NoteMenuOptions = {}): MenuItem[] {
  const id = note.id
  if (note.deletedAt) {
    return [
      { id: 'restore', label: t('common.restore'), icon: 'restore', run: () => void notes.restore(id) },
      {
        id: 'delete-forever',
        label: t('note.menu.deleteForever'),
        icon: 'trash',
        danger: true,
        separatorBefore: true,
        run: () => void notes.deleteForever(id),
      },
    ]
  }

  return [
    {
      id: 'pin',
      label: t(note.pinned ? 'note.menu.unpin' : 'note.menu.pin'),
      icon: 'pin',
      run: () => void notes.togglePin(id),
    },
    {
      id: 'archive',
      label: t(note.archivedAt ? 'note.menu.unarchive' : 'note.menu.archive'),
      icon: 'archive',
      run: () => void notes.setArchived(id, note.archivedAt === 0),
    },
    {
      id: 'move',
      label: t('menu.moveTo'),
      icon: 'folder',
      submenu: folderTargets((folderId) => {
        void notes.move(id, folderId).then(() => ui.toast(t('toast.noteMoved'), 'ok'))
      }, note.folderId),
    },
    {
      id: 'template',
      label: t(note.template ? 'menu.unmarkTemplate' : 'menu.markTemplate'),
      icon: 'copy',
      run: () => void notes.toggleTemplate(id),
    },
    ...(options.extra ?? []),
    {
      id: 'history',
      label: t('note.menu.history'),
      icon: 'history',
      separatorBefore: !options.extra?.length,
      run: () => {
        notes.select(id)
        dialogs.open('history', id)
      },
    },
    {
      id: 'share',
      label: t('note.menu.share'),
      icon: 'link',
      run: () => {
        notes.select(id)
        dialogs.open('share', id)
      },
    },
    {
      id: 'trash',
      label: t('note.menu.trash'),
      icon: 'trash',
      danger: true,
      separatorBefore: true,
      run: () => trashWithUndo(id),
    },
  ]
}
