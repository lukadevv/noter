/**
 * The pomodoro cycle: focus, short break, focus, short break… and a long break
 * after every `longEvery` focus sessions. Pure, so it is tested directly; the
 * timers store runs each phase as an ordinary countdown.
 */
import type { PomodoroPhase } from '$lib/db/schema'
import type { PomodoroSettings } from '$lib/db/repo/settings'

export interface PomodoroStep {
  phase: PomodoroPhase
  /** Focus sessions finished in the current set when this phase starts. */
  cycle: number
}

/** What comes after `current` ends. `cycle` counts finished focus sessions in this set. */
export function nextStep(
  current: PomodoroStep,
  settings: Pick<PomodoroSettings, 'longEvery'>,
): PomodoroStep {
  const every = Math.max(1, settings.longEvery)
  if (current.phase === 'focus') {
    const done = current.cycle + 1
    return done >= every ? { phase: 'long', cycle: done } : { phase: 'short', cycle: done }
  }
  // After a long break the set starts over.
  return { phase: 'focus', cycle: current.phase === 'long' ? 0 : current.cycle }
}

export function phaseMinutes(phase: PomodoroPhase, settings: PomodoroSettings): number {
  switch (phase) {
    case 'focus':
      return settings.focusMinutes
    case 'short':
      return settings.shortMinutes
    case 'long':
      return settings.longMinutes
  }
}

export const PHASE_COLOR: Record<PomodoroPhase, string> = {
  focus: 'var(--danger)',
  short: 'var(--ok)',
  long: 'var(--accent)',
}
