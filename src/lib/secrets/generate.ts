/**
 * Passwords: a generator using the platform's CSPRNG, and a strength estimate.
 */
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*-_=+?'

export interface GeneratorOptions {
  length: number
  digits: boolean
  symbols: boolean
}

/** An unbiased random index below `max` (rejection sampling, no modulo bias). */
function randomIndex(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buffer = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buffer)
    if (buffer[0]! < limit) return buffer[0]! % max
  }
}

/**
 * A password with at least one character from each chosen set. Look-alike
 * characters (l, 1, O, 0) are left out, since people do end up typing these.
 */
export function generatePassword({ length, digits, symbols }: GeneratorOptions): string {
  const sets = [LOWER, UPPER, ...(digits ? [DIGITS] : []), ...(symbols ? [SYMBOLS] : [])]
  const pool = sets.join('')
  const size = Math.max(length, sets.length)
  const chars = sets.map((set) => set[randomIndex(set.length)]!)
  while (chars.length < size) chars.push(pool[randomIndex(pool.length)]!)
  // Shuffle so the guaranteed characters are not always first (Fisher–Yates).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}

export type Strength = 'weak' | 'fair' | 'good' | 'strong'

const COMMON = [
  'password',
  'qwerty',
  '123456',
  'letmein',
  'admin',
  'welcome',
  'iloveyou',
  'monkey',
  'dragon',
  'contraseña',
]

/**
 * A rough entropy estimate: the size of the character pool to the power of the
 * length, discounted for repeats, sequences and well-known passwords. Good
 * enough to nudge people; not a cracking model.
 */
export function strengthOf(password: string): { bits: number; level: Strength } {
  if (!password) return { bits: 0, level: 'weak' }
  let pool = 0
  if (/[a-z]/.test(password)) pool += 26
  if (/[A-Z]/.test(password)) pool += 26
  if (/\d/.test(password)) pool += 10
  if (/[^a-zA-Z0-9]/.test(password)) pool += 32
  const unique = new Set(password).size
  let bits = Math.log2(Math.max(pool, 2)) * Math.min(password.length, unique * 1.5)
  if (/(.)\1{2,}/.test(password)) bits *= 0.8
  if (/(?:abc|bcd|cde|123|234|345|456|567|678|789|qwe|wer|asd)/i.test(password)) bits *= 0.8
  if (COMMON.some((word) => password.toLowerCase().includes(word))) bits = Math.min(bits, 20)
  const level: Strength = bits < 40 ? 'weak' : bits < 60 ? 'fair' : bits < 80 ? 'good' : 'strong'
  return { bits: Math.round(bits), level }
}
