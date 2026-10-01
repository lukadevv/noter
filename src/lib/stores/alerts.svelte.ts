import type { Section } from '../../routes/router'

export interface Alert {
  id: string
  section: Section
  tone: 'info' | 'warn' | 'danger' | 'ok'
  icon: string
  title: string
  body?: string
  /** Primary action, e.g. "Taken" or "Write today's note". */
  action?: { label: string; run: () => void }
  /** Lets the user hide this alert (until it changes). */
  dismiss?: () => void
}

type Provider = () => Alert[]

/**
 * Things that want the user's attention: a dose that is due, a timer that is
 * ringing, today's note not written yet.
 *
 * Each feature registers a provider - a function over its own reactive state -
 * and the dashboard, the navigation badges and the palette all read the merged
 * list. Providers are plain functions so a feature can be lazy-loaded and
 * register itself only once it exists.
 */
class AlertsStore {
  #providers = $state<Record<string, Provider>>({})

  register(key: string, provider: Provider): () => void {
    this.#providers = { ...this.#providers, [key]: provider }
    return () => {
      const { [key]: _removed, ...rest } = this.#providers
      this.#providers = rest
    }
  }

  all: Alert[] = $derived(Object.values(this.#providers).flatMap((provider) => provider()))

  /** Urgent alerts per section, for the navigation badges. */
  countFor(section: Section): number {
    return this.all.filter((a) => a.section === section && (a.tone === 'danger' || a.tone === 'warn'))
      .length
  }
}

export const alerts = new AlertsStore()
