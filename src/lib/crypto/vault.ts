import { base64ToBytes, bytesToBase64 } from './base64'

/**
 * Passphrase-based encryption, used both for locked folders and for the
 * portable `.noter` backup file.
 *
 * PBKDF2-SHA256 with a high iteration count is the deliberate choice over a
 * faster KDF: it is the only password-hardening primitive WebCrypto exposes, so
 * an Argon2 implementation would mean shipping WASM for a feature that must work
 * offline and start instantly. AES-GCM supplies authentication as well as
 * secrecy, so a corrupted or tampered payload fails loudly instead of decrypting
 * to garbage.
 */
export const DEFAULT_ITERATIONS = 310_000
const IV_BYTES = 12
const SALT_BYTES = 16

export interface KdfParams {
  salt: string
  iterations: number
}

export interface Envelope {
  iv: string
  ct: string
}

export function randomSalt(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)))
}

export function newKdfParams(iterations = DEFAULT_ITERATIONS): KdfParams {
  return { salt: randomSalt(), iterations }
}

export async function deriveKey(passphrase: string, params: KdfParams): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(params.salt) as BufferSource,
      iterations: params.iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBytes(
  key: CryptoKey,
  data: Uint8Array,
): Promise<{ iv: Uint8Array; ct: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data as BufferSource,
  )
  return { iv, ct: new Uint8Array(ct) }
}

export async function decryptBytes(key: CryptoKey, iv: Uint8Array, ct: Uint8Array): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource,
  )
  return new Uint8Array(plain)
}

export async function encryptText(key: CryptoKey, text: string): Promise<Envelope> {
  const { iv, ct } = await encryptBytes(key, new TextEncoder().encode(text))
  return { iv: bytesToBase64(iv), ct: bytesToBase64(ct) }
}

export async function decryptText(key: CryptoKey, envelope: Envelope): Promise<string> {
  const plain = await decryptBytes(key, base64ToBytes(envelope.iv), base64ToBytes(envelope.ct))
  return new TextDecoder().decode(plain)
}

/** Marker prefix so an encrypted body is never mistaken for markdown. */
const PREFIX = 'noter:enc:v1:'

export function packEnvelope(envelope: Envelope): string {
  return `${PREFIX}${envelope.iv}:${envelope.ct}`
}

export function unpackEnvelope(value: string): Envelope | null {
  if (!value.startsWith(PREFIX)) return null
  const rest = value.slice(PREFIX.length)
  const separator = rest.indexOf(':')
  if (separator === -1) return null
  return { iv: rest.slice(0, separator), ct: rest.slice(separator + 1) }
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}

/**
 * Verifies a passphrase by decrypting a known token. Storing this token per
 * folder means a wrong passphrase is rejected immediately, instead of silently
 * producing unreadable notes.
 */
export const VERIFICATION_PLAINTEXT = 'noter-vault-ok'

export async function makeVerifier(key: CryptoKey): Promise<string> {
  return packEnvelope(await encryptText(key, VERIFICATION_PLAINTEXT))
}

export async function checkVerifier(key: CryptoKey, packed: string): Promise<boolean> {
  const envelope = unpackEnvelope(packed)
  if (!envelope) return false
  try {
    return (await decryptText(key, envelope)) === VERIFICATION_PLAINTEXT
  } catch {
    return false
  }
}
