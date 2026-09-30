import { liveQuery, type Subscription } from 'dexie'
import { db } from '$lib/db/db'
import type { SecretItem, SecretsMeta } from '$lib/db/schema'
import { uuid } from '$lib/utils/uuid'
import { orderAfterLast } from '$lib/utils/order'
import { theme } from '$lib/stores/theme.svelte'
import { ui } from '$lib/stores/ui.svelte'
import { createVault, openItem, openVault, rewrapVault, sealItem } from './crypto'
import { t } from '$lib/i18n/index.svelte'
import { vaultStatus } from './status.svelte'

export type SecretKind = 'login' | 'card' | 'note' | 'identity' | 'wifi'

export interface SecretField {
  /** Built-in key ('username', 'password'…) or a random id for custom fields. */
  key: string
  /** Shown instead of the built-in label; used by custom fields. */
  label: string
  value: string
  /** Masked until revealed, and wiped from the clipboard after copying. */
  secret: boolean
  custom: boolean
}

export interface SecretData {
  kind: SecretKind
  title: string
  favorite: boolean
  fields: SecretField[]
}

export interface OpenSecret extends SecretData {
  id: string
  order: number
  updatedAt: number
}

/** The fields each kind starts with. */
export const KIND_FIELDS: Record<SecretKind, { key: string; secret: boolean; multiline?: boolean }[]> = {
  login: [
    { key: 'username', secret: false },
    { key: 'password', secret: true },
    { key: 'url', secret: false },
    { key: 'notes', secret: false, multiline: true },
  ],
  card: [
    { key: 'cardholder', secret: false },
    { key: 'number', secret: true },
    { key: 'expiry', secret: false },
    { key: 'cvv', secret: true },
    { key: 'pin', secret: true },
    { key: 'notes', secret: false, multiline: true },
  ],
  note: [{ key: 'text', secret: true, multiline: true }],
  identity: [
    { key: 'fullName', secret: false },
    { key: 'documentNumber', secret: true },
    { key: 'issued', secret: false },
    { key: 'expires', secret: false },
    { key: 'notes', secret: false, multiline: true },
  ],
  wifi: [
    { key: 'network', secret: false },
    { key: 'password', secret: true },
    { key: 'notes', secret: false, multiline: true },
  ],
}

export const KIND_ICONS: Record<SecretKind, string> = {
  login: 'key-round',
  card: 'credit-card',
  note: 'sticky-note',
  identity: 'id-card',
  wifi: 'wifi',
}

/**
 * The vault: passwords, cards and anything else that should need a master
 * password to see.
 *
 * The decrypted items and the key exist only in memory while the vault is
 * open. It locks itself after a few idle minutes (checked against a deadline
 * on every access, not just a timer, so a sleeping laptop cannot keep it open)
 * and, by default, whenever the app is hidden. Nothing in here is ever indexed
 * for search, shown in the palette or counted in statistics.
 */
class SecretsStore {
  meta = $state<SecretsMeta | null>(null)
  metaLoaded = $state(false)
  unlocked = $state(false)
  items = $state<OpenSecret[]>([])
  count = $state(0)

  #key: CryptoKey | null = null
  #lockAt = 0
  #timer: ReturnType<typeof setTimeout> | undefined
  #subs: Subscription[] = []
  #started = false
  #decrypting = 0

  start(): void {
    if (this.#started) return
    this.#started = true
    this.#subs.push(
      liveQuery(() => db.secretsMeta.get('main')).subscribe((meta) => {
        this.meta = meta ?? null
        this.metaLoaded = true
      }),
      liveQuery(() => db.secretItems.orderBy('order').toArray()).subscribe((records) => {
        this.count = records.length
        if (this.#key) void this.#decrypt(records)
      }),
    )
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && theme.settings.vault.lockOnHide) this.lock()
    })
  }

  async #decrypt(records: SecretItem[]): Promise<void> {
    const key = this.#key
    if (!key) return
    const run = ++this.#decrypting
    const open: OpenSecret[] = []
    for (const record of records) {
      try {
        const data = await openItem<SecretData>(key, record.id, record.envelope)
        open.push({ ...data, id: record.id, order: record.order, updatedAt: record.updatedAt })
      } catch {
        // An item sealed with another vault's key (e.g. merged from a foreign
        // backup) cannot be read; it is left alone rather than dropped.
      }
    }
    // A newer decryption (or a lock) may have started meanwhile.
    if (run === this.#decrypting && this.#key === key) this.items = open
  }

  // --- Locking ---------------------------------------------------------------

  #arm(): void {
    clearTimeout(this.#timer)
    const minutes = theme.settings.vault.autoLockMinutes
    this.#lockAt = Date.now() + minutes * 60_000
    this.#timer = setTimeout(() => this.lock(), minutes * 60_000)
  }

  /** Call on any interaction inside the vault, so it does not lock mid-use. */
  touch(): void {
    if (!this.unlocked) return
    if (Date.now() > this.#lockAt) this.lock()
    else this.#arm()
  }

  /** The session key, or null once the idle deadline has passed. */
  #keyForUse(): CryptoKey | null {
    if (!this.#key) return null
    if (Date.now() > this.#lockAt) {
      this.lock()
      return null
    }
    this.#arm()
    return this.#key
  }

  lock(): void {
    this.#key = null
    this.#decrypting++
    this.unlocked = false
    vaultStatus.unlocked = false
    this.items = []
    clearTimeout(this.#timer)
  }

  async setup(passphrase: string, iterations?: number): Promise<void> {
    const { meta, key } = await createVault(passphrase, iterations)
    await db.secretsMeta.put(meta)
    this.#open(key)
  }

  async unlock(passphrase: string): Promise<boolean> {
    const meta = this.meta ?? (await db.secretsMeta.get('main')) ?? null
    if (!meta) return false
    const key = await openVault(meta, passphrase)
    if (!key) return false
    this.#open(key)
    return true
  }

  #open(key: CryptoKey): void {
    this.#key = key
    this.unlocked = true
    vaultStatus.unlocked = true
    this.#arm()
    void db.secretItems
      .orderBy('order')
      .toArray()
      .then((records) => this.#decrypt(records))
  }

  async changePassphrase(current: string, next: string): Promise<boolean> {
    if (!this.meta) return false
    const meta = await rewrapVault($state.snapshot(this.meta) as SecretsMeta, current, next)
    if (!meta) return false
    await db.secretsMeta.put(meta)
    return true
  }

  /** Deletes the vault and everything in it. There is no undo. */
  async destroy(): Promise<void> {
    this.lock()
    await db.transaction('rw', db.secretItems, db.secretsMeta, async () => {
      await db.secretItems.clear()
      await db.secretsMeta.clear()
    })
  }

  // --- Items -------------------------------------------------------------------

  async save(data: SecretData, id?: string): Promise<string | null> {
    const key = this.#keyForUse()
    if (!key) return null
    const now = Date.now()
    const itemId = id ?? uuid()
    const envelope = await sealItem(key, itemId, data)
    if (id) {
      await db.secretItems.update(id, { envelope, updatedAt: now })
    } else {
      await db.secretItems.add({
        id: itemId,
        envelope,
        order: orderAfterLast(this.items),
        createdAt: now,
        updatedAt: now,
      })
    }
    return itemId
  }

  /** Deletes an item, offering to put it back: the sealed record is kept in memory for the toast. */
  async remove(id: string): Promise<void> {
    if (!this.#keyForUse()) return
    const record = await db.secretItems.get(id)
    if (!record) return
    await db.secretItems.delete(id)
    ui.toast(t('vault.deleted'), 'info', {
      label: t('toast.undo'),
      run: () => void db.secretItems.put(record),
    })
  }

  async toggleFavorite(item: OpenSecret): Promise<void> {
    const { id, order: _o, updatedAt: _u, ...data } = item
    await this.save({ ...data, favorite: !item.favorite }, id)
  }

  // --- Clipboard ---------------------------------------------------------------

  #clipboardTimer: ReturnType<typeof setTimeout> | undefined

  /**
   * Copies a value. Secrets are wiped from the clipboard after a while; a
   * browser only allows writing it while the page has focus, so if it does
   * not, the wipe happens as soon as the app is focused again.
   */
  async copy(value: string, secret: boolean): Promise<void> {
    this.touch()
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      ui.toast(t('vault.copyFailed'), 'warn')
      return
    }
    const seconds = theme.settings.vault.clipboardSeconds
    if (!secret || seconds <= 0) {
      ui.toast(t('vault.copied'), 'ok')
      return
    }
    ui.toast(t('vault.copiedClears', { seconds }), 'ok')
    clearTimeout(this.#clipboardTimer)
    this.#clipboardTimer = setTimeout(() => {
      const wipe = () => void navigator.clipboard.writeText('').catch(() => {})
      if (document.hasFocus()) wipe()
      else addEventListener('focus', wipe, { once: true })
    }, seconds * 1000)
  }
}

export const secrets = new SecretsStore()
