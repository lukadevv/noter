import { db } from '../db'
import { now, type Theme, type ThemeSeedRecord } from '../schema'
import { uuid } from '$lib/utils/uuid'
import { deriveTokens, type ThemeSeed } from '$lib/theme/tokens'

export async function allThemes(): Promise<Theme[]> {
  return db.themes.toArray()
}

export async function saveTheme(input: { id?: string; name: string; seed: ThemeSeed }): Promise<Theme> {
  const ts = now()
  const existing = input.id ? await db.themes.get(input.id) : undefined

  const theme: Theme = {
    id: existing?.id ?? input.id ?? uuid(),
    name: input.name.trim() || 'Custom theme',
    builtin: false,
    seed: input.seed as ThemeSeedRecord,
    tokens: deriveTokens(input.seed),
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  }

  await db.themes.put(theme)
  return theme
}

export async function deleteTheme(id: string): Promise<void> {
  await db.themes.delete(id)
}

/** Shape written by "Export theme" and accepted by "Import theme". */
export interface ThemeFile {
  format: 'noter-theme'
  version: 1
  name: string
  seed: ThemeSeedRecord
}

/** Validates an imported file rather than trusting its shape. */
export function parseThemeFile(text: string): ThemeFile | null {
  try {
    const parsed = JSON.parse(text) as Partial<ThemeFile>
    if (parsed.format !== 'noter-theme' || !parsed.seed || typeof parsed.name !== 'string') return null

    const seed = parsed.seed
    const colour = (value: unknown): boolean =>
      typeof value === 'object' &&
      value !== null &&
      ['l', 'c', 'h'].every((key) => typeof (value as Record<string, unknown>)[key] === 'number')

    if (seed.mode !== 'light' && seed.mode !== 'dark') return null
    if (typeof seed.neutralHue !== 'number' || typeof seed.neutralChroma !== 'number') return null
    if (!colour(seed.accent) || !colour(seed.danger) || !colour(seed.warn) || !colour(seed.ok)) return null

    return { format: 'noter-theme', version: 1, name: parsed.name, seed }
  } catch {
    return null
  }
}
