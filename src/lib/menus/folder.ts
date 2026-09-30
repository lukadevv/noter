import type { MenuItem } from '$lib/ui-types'
import { notes } from '$lib/stores/notes.svelte'
import { ui } from '$lib/stores/ui.svelte'
import { dialogs } from '$lib/stores/dialogs.svelte'
import { keyring } from '$lib/crypto/keyring.svelte'
import { nudgeFolder } from '$lib/db/repo/folders'
import { t } from '$lib/i18n/index.svelte'

/** Keyboard and menu reordering, one slot at a time, keeping focus on the row. */
export async function nudge(id: string, direction: -1 | 1): Promise<void> {
  const moved = await nudgeFolder(id, direction)
  if (!moved) return
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-folder-id="${id}"] .label`)?.focus()
  })
}

/**
 * Everything you can do to a folder. The "…" button and a right-click on the
 * row open this same list, so neither can drift from the other.
 */
export function folderMenuItems(id: string, options: { onrename?: () => void } = {}): MenuItem[] {
  const folder = notes.folders.find((f) => f.id === id)
  if (!folder) return []
  const locked = folder.encrypted === 1 && !keyring.isUnlocked(id)

  return [
    {
      id: 'new-note',
      label: t('sidebar.newNoteHere'),
      icon: 'plus',
      run: () => {
        notes.setScope({ kind: 'folder', id })
        void notes.newNote()
      },
    },
    {
      id: 'new-subfolder',
      label: t('sidebar.newSubfolder'),
      icon: 'folder-plus',
      run: () => void notes.newFolder(id),
    },
    ...(options.onrename
      ? [{ id: 'rename', label: t('sidebar.rename'), icon: 'pencil', run: options.onrename }]
      : []),
    {
      id: 'appearance',
      label: t('sidebar.appearance'),
      icon: 'palette',
      separatorBefore: true,
      run: () => dialogs.open('folderStyle', id),
    },
    {
      id: 'encryption',
      label: t(folder.encrypted ? 'sidebar.encryption' : 'sidebar.encryptFolder'),
      icon: 'lock',
      run: () => dialogs.open('folderLock', id),
    },
    ...(folder.encrypted && !locked
      ? [{ id: 'lock-now', label: t('lock.lockNow'), icon: 'lock', run: () => keyring.lock(id) }]
      : []),
    // Reordering by menu as well as by drag: dragging is unavailable on touch
    // and awkward for anyone who finds fine pointer work hard.
    {
      id: 'move-up',
      label: t('sidebar.moveUp'),
      icon: 'arrow-up',
      separatorBefore: true,
      shortcut: 'Alt+↑',
      run: () => void nudge(id, -1),
    },
    {
      id: 'move-down',
      label: t('sidebar.moveDown'),
      icon: 'arrow-down',
      shortcut: 'Alt+↓',
      run: () => void nudge(id, 1),
    },
    ...(notes.folders.some((f) => f.parentId === id)
      ? [
          {
            id: 'collapse',
            label: t(folder.collapsed ? 'sidebar.expand' : 'sidebar.collapse'),
            icon: folder.collapsed ? 'chevron-down' : 'chevron-up',
            run: () => void notes.toggleCollapsed(id),
          },
        ]
      : []),
    {
      id: 'delete',
      label: t('sidebar.deleteFolder'),
      icon: 'trash',
      danger: true,
      separatorBefore: true,
      run: () => {
        const count = notes.counts.get(id) ?? 0
        void notes.deleteFolder(id)
        ui.toast(
          count > 0 ? t('toast.folderDeletedWithNotes', { count }) : t('toast.folderDeleted'),
          'info',
        )
      },
    },
  ]
}

export function smartFolderMenuItems(id: string): MenuItem[] {
  return [
    {
      id: 'delete',
      label: t('sidebar.deleteSavedSearch'),
      icon: 'trash',
      danger: true,
      run: () => void notes.deleteSmartFolder(id),
    },
  ]
}

export function tagMenuItems(tag: string): MenuItem[] {
  return [
    {
      id: 'open',
      label: t('menu.showNotesTagged', { tag }),
      icon: 'hash',
      run: () => notes.setScope({ kind: 'tag', tag }),
    },
    {
      id: 'search',
      label: t('menu.searchTag'),
      icon: 'search',
      run: () => notes.setScope({ kind: 'search', query: `tag:${tag}` }),
    },
  ]
}
