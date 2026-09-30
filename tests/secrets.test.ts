import { describe, expect, it } from 'vitest'
import { createVault, openItem, openVault, rewrapVault, sealItem } from '$lib/secrets/crypto'
import { generatePassword, strengthOf } from '$lib/secrets/generate'

// Few iterations: the KDF's cost is not what these tests are about.
const FAST = 1000

describe('vault crypto', () => {
  it('opens with the right password only', async () => {
    const { meta, key } = await createVault('correct horse battery staple', FAST)
    const sealed = await sealItem(key, 'item-1', { title: 'Bank', password: 's3cret' })
    expect(sealed).not.toContain('s3cret')

    const reopened = await openVault(meta, 'correct horse battery staple')
    expect(reopened).not.toBeNull()
    expect(await openItem(reopened!, 'item-1', sealed)).toEqual({ title: 'Bank', password: 's3cret' })
    expect(await openVault(meta, 'wrong password')).toBeNull()
  })

  it('keeps the session key non-extractable', async () => {
    const { key } = await createVault('another good password', FAST)
    expect(key.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
  })

  it('refuses an item moved to another id', async () => {
    const { key } = await createVault('another good password', FAST)
    const sealed = await sealItem(key, 'a', { value: 1 })
    await expect(openItem(key, 'b', sealed)).rejects.toThrow()
  })

  it('changes the password without re-encrypting items', async () => {
    const { meta, key } = await createVault('old password here', FAST)
    const sealed = await sealItem(key, 'x', { note: 'kept' })
    const next = await rewrapVault(meta, 'old password here', 'new password here')
    expect(next).not.toBeNull()
    expect(await openVault(next!, 'old password here')).toBeNull()
    const opened = await openVault(next!, 'new password here')
    expect(await openItem(opened!, 'x', sealed)).toEqual({ note: 'kept' })
    expect(await rewrapVault(meta, 'not it', 'whatever')).toBeNull()
  })
})

describe('password generator', () => {
  it('honours length and character sets', () => {
    const password = generatePassword({ length: 24, digits: true, symbols: true })
    expect(password).toHaveLength(24)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/\d/)
    expect(password).toMatch(/[^a-zA-Z0-9]/)
    expect(generatePassword({ length: 16, digits: false, symbols: false })).toMatch(/^[a-zA-Z]{16}$/)
  })

  it('rates passwords sensibly', () => {
    expect(strengthOf('password123').level).toBe('weak')
    expect(strengthOf('aaaaaaaa').level).toBe('weak')
    expect(strengthOf(generatePassword({ length: 20, digits: true, symbols: true })).level).toBe('strong')
  })
})
