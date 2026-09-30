/**
 * Cryptography for the vault.
 *
 * Two keys, so the master password can change without re-encrypting anything:
 *
 *  - the data key: random AES-256-GCM, encrypts every item. It exists in
 *    extractable form only for the instant it is created or re-wrapped; the
 *    session copy held while the vault is open is non-extractable.
 *  - the wrapping key: derived from the master password with PBKDF2-SHA256 and
 *    a per-vault salt; it only wraps and unwraps the data key.
 *
 * AES-GCM authenticates, so a wrong password fails to unwrap instead of
 * yielding a garbage key — no separate verifier is needed. Each item is sealed
 * with its own id as additional authenticated data, so ciphertexts cannot be
 * swapped between items undetected.
 */
import { base64ToBytes, bytesToBase64 } from '$lib/crypto/base64'
import { DEFAULT_ITERATIONS, newKdfParams, type KdfParams } from '$lib/crypto/vault'
import type { SecretsMeta } from '$lib/db/schema'

const PREFIX = 'noter:sec:v1:'
const IV_BYTES = 12

async function wrappingKey(passphrase: string, kdf: KdfParams): Promise<CryptoKey> {
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
      salt: base64ToBytes(kdf.salt) as BufferSource,
      iterations: kdf.iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

async function wrap(dataKey: CryptoKey, passphrase: string, kdf: KdfParams) {
  const kek = await wrappingKey(passphrase, kdf)
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const wrapped = await crypto.subtle.wrapKey('raw', dataKey, kek, {
    name: 'AES-GCM',
    iv: iv as BufferSource,
  })
  return { wrapped: bytesToBase64(new Uint8Array(wrapped)), iv: bytesToBase64(iv) }
}

async function unwrap(
  meta: SecretsMeta,
  passphrase: string,
  extractable: boolean,
): Promise<CryptoKey | null> {
  try {
    const kek = await wrappingKey(passphrase, meta.kdf)
    return await crypto.subtle.unwrapKey(
      'raw',
      base64ToBytes(meta.wrapped) as BufferSource,
      kek,
      { name: 'AES-GCM', iv: base64ToBytes(meta.iv) as BufferSource },
      { name: 'AES-GCM', length: 256 },
      extractable,
      ['encrypt', 'decrypt'],
    )
  } catch {
    // A wrong password fails GCM authentication here.
    return null
  }
}

/** Creates a vault: a fresh data key, wrapped by the master password. */
export async function createVault(
  passphrase: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<{ meta: SecretsMeta; key: CryptoKey }> {
  const dataKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
  const kdf = newKdfParams(iterations)
  const { wrapped, iv } = await wrap(dataKey, passphrase, kdf)
  const now = Date.now()
  const meta: SecretsMeta = {
    id: 'main',
    kdf,
    wrapped,
    iv,
    keyId: bytesToBase64(crypto.getRandomValues(new Uint8Array(12))),
    createdAt: now,
    updatedAt: now,
  }
  // Hand back the non-extractable session copy, not the key that was just wrapped.
  const key = (await unwrap(meta, passphrase, false))!
  return { meta, key }
}

/** Opens the vault; null when the password is wrong. */
export async function openVault(meta: SecretsMeta, passphrase: string): Promise<CryptoKey | null> {
  return unwrap(meta, passphrase, false)
}

/** Re-wraps the data key under a new password (and a new salt). Items are untouched. */
export async function rewrapVault(
  meta: SecretsMeta,
  current: string,
  next: string,
): Promise<SecretsMeta | null> {
  const dataKey = await unwrap(meta, current, true)
  if (!dataKey) return null
  const kdf = newKdfParams(meta.kdf.iterations)
  const { wrapped, iv } = await wrap(dataKey, next, kdf)
  return { ...meta, kdf, wrapped, iv, updatedAt: Date.now() }
}

export async function sealItem(key: CryptoKey, id: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ct = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: new TextEncoder().encode(id) as BufferSource,
    },
    key,
    new TextEncoder().encode(JSON.stringify(value)) as BufferSource,
  )
  return `${PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ct))}`
}

export async function openItem<T>(key: CryptoKey, id: string, envelope: string): Promise<T> {
  if (!envelope.startsWith(PREFIX)) throw new Error('Not a vault item')
  const [iv, ct] = envelope.slice(PREFIX.length).split(':')
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(iv!) as BufferSource,
      additionalData: new TextEncoder().encode(id) as BufferSource,
    },
    key,
    base64ToBytes(ct!) as BufferSource,
  )
  return JSON.parse(new TextDecoder().decode(plain)) as T
}
