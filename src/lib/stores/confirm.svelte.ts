/**
 * An in-app replacement for `window.confirm`: styled, translatable, and able
 * to say *why* it is asking. Anything can `await confirm.ask(...)`; the dialog
 * itself is mounted once, at the app root.
 */
export interface ConfirmRequest {
  title: string
  body?: string
  /** Extra lines shown as a list under the body, e.g. the facts behind a warning. */
  details?: string[]
  confirmLabel: string
  cancelLabel?: string
  tone?: 'default' | 'warn' | 'danger'
  icon?: string
}

interface Pending extends ConfirmRequest {
  resolve: (ok: boolean) => void
}

class ConfirmStore {
  current = $state<Pending | null>(null)

  ask(request: ConfirmRequest): Promise<boolean> {
    // A second question while one is open answers the first with "no" rather
    // than stacking dialogs.
    this.current?.resolve(false)
    return new Promise((resolve) => {
      this.current = { ...request, resolve }
    })
  }

  answer(ok: boolean): void {
    const pending = this.current
    this.current = null
    pending?.resolve(ok)
  }
}

export const confirm = new ConfirmStore()
