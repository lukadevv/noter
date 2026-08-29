export interface Debounced<A extends unknown[]> {
  (...args: A): void
  /** Run the pending call immediately, if there is one. */
  flush(): void
  cancel(): void
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: A | null = null

  const run = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (pending) {
      const args = pending
      pending = null
      fn(...args)
    }
  }

  const wrapped = ((...args: A) => {
    pending = args
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(run, ms)
  }) as Debounced<A>

  wrapped.flush = run
  wrapped.cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    pending = null
  }
  return wrapped
}
