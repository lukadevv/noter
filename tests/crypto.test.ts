import { describe, expect, it } from 'vitest'
import {
  checkVerifier,
  decryptText,
  deriveKey,
  encryptText,
  isEncrypted,
  makeVerifier,
  newKdfParams,
  packEnvelope,
  unpackEnvelope,
} from '$lib/crypto/vault'
import { base64ToBytes, bytesToBase64 } from '$lib/crypto/base64'

// A low iteration count keeps the suite fast; production uses 310,000.
const params = { ...newKdfParams(), iterations: 1000 }

describe('base64', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42])
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes])
  })

  it('handles payloads larger than one chunk', () => {
    // getRandomValues caps at 65,536 bytes per call, so this is filled in slices.
    const bytes = new Uint8Array(70_000)
    for (let offset = 0; offset < bytes.length; offset += 32_768) {
      crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 32_768, bytes.length)))
    }
    const round = base64ToBytes(bytesToBase64(bytes))
    expect(round.length).toBe(bytes.length)
    expect(round[0]).toBe(bytes[0])
    expect(round.at(-1)).toBe(bytes.at(-1))
  })
})

describe('passphrase encryption', () => {
  it('round-trips text', async () => {
    const key = await deriveKey('correct horse battery staple', params)
    const envelope = await encryptText(key, 'the secret note')
    expect(await decryptText(key, envelope)).toBe('the secret note')
  })

  it('produces different ciphertext each time', async () => {
    const key = await deriveKey('pass', params)
    const a = await encryptText(key, 'same text')
    const b = await encryptText(key, 'same text')
    expect(a.ct).not.toBe(b.ct)
    expect(a.iv).not.toBe(b.iv)
  })

  it('refuses to decrypt with the wrong passphrase', async () => {
    const right = await deriveKey('right', params)
    const wrong = await deriveKey('wrong', params)
    const envelope = await encryptText(right, 'secret')
    await expect(decryptText(wrong, envelope)).rejects.toThrow()
  })

  it('refuses to decrypt tampered ciphertext', async () => {
    const key = await deriveKey('pass', params)
    const envelope = await encryptText(key, 'secret')

    const bytes = base64ToBytes(envelope.ct)
    bytes[0] = bytes[0]! ^ 0xff
    await expect(decryptText(key, { ...envelope, ct: bytesToBase64(bytes) })).rejects.toThrow()
  })

  it('derives the same key from the same passphrase and salt', async () => {
    const a = await deriveKey('pass', params)
    const b = await deriveKey('pass', params)
    const envelope = await encryptText(a, 'text')
    expect(await decryptText(b, envelope)).toBe('text')
  })

  it('derives different keys from different salts', async () => {
    const a = await deriveKey('pass', { ...params, salt: bytesToBase64(new Uint8Array(16).fill(1)) })
    const b = await deriveKey('pass', { ...params, salt: bytesToBase64(new Uint8Array(16).fill(2)) })
    await expect(decryptText(b, await encryptText(a, 'text'))).rejects.toThrow()
  })
})

describe('envelope packing', () => {
  it('round-trips through the string form', async () => {
    const key = await deriveKey('pass', params)
    const packed = packEnvelope(await encryptText(key, 'hello'))
    expect(isEncrypted(packed)).toBe(true)
    expect(await decryptText(key, unpackEnvelope(packed)!)).toBe('hello')
  })

  it('does not mistake ordinary markdown for ciphertext', () => {
    expect(isEncrypted('# A heading')).toBe(false)
    expect(unpackEnvelope('# A heading')).toBeNull()
  })
})

describe('verifier', () => {
  it('accepts the right key and rejects the wrong one', async () => {
    const right = await deriveKey('right', params)
    const wrong = await deriveKey('wrong', params)
    const verifier = await makeVerifier(right)

    expect(await checkVerifier(right, verifier)).toBe(true)
    expect(await checkVerifier(wrong, verifier)).toBe(false)
  })

  it('rejects a malformed verifier without throwing', async () => {
    const key = await deriveKey('pass', params)
    expect(await checkVerifier(key, 'garbage')).toBe(false)
  })
})
