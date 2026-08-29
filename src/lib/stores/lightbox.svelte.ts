/** Full-screen image viewer state, shared by the editor and the reading view. */
class LightboxStore {
  ids = $state<string[]>([])
  index = $state(0)

  open: boolean = $derived(this.ids.length > 0)
  currentId: string | null = $derived(this.ids[this.index] ?? null)

  show(ids: string[], startId?: string): void {
    if (ids.length === 0) return
    this.ids = ids
    const at = startId ? ids.indexOf(startId) : 0
    this.index = at >= 0 ? at : 0
  }

  next(): void {
    if (this.ids.length > 0) this.index = (this.index + 1) % this.ids.length
  }

  previous(): void {
    if (this.ids.length > 0) this.index = (this.index - 1 + this.ids.length) % this.ids.length
  }

  close(): void {
    this.ids = []
    this.index = 0
  }
}

export const lightbox = new LightboxStore()
