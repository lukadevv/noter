/**
 * Which app-level dialog is open.
 *
 * Menus are built by shared functions (src/lib/menus), not by the component
 * that happens to show the "…" button, so they cannot flip a local `open` flag.
 * They name the dialog here instead, and the component that owns the data the
 * dialog needs renders it: folder dialogs at the app root, note dialogs in the
 * note view (which holds the decrypted text).
 */
export type DialogKind = 'folderStyle' | 'folderLock' | 'history' | 'share'

class DialogStore {
  current = $state<{ kind: DialogKind; id: string } | null>(null)

  open(kind: DialogKind, id: string): void {
    this.current = { kind, id }
  }

  close(): void {
    this.current = null
  }

  is(kind: DialogKind, id?: string): boolean {
    return this.current?.kind === kind && (id === undefined || this.current.id === id)
  }
}

export const dialogs = new DialogStore()
