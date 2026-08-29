import { deflateSync, inflateSync } from 'fflate'
import { db } from '$lib/db/db'
import type { Asset, Folder, Note, SmartFolder, Theme, Version } from '$lib/db/schema'
import { deriveKey, decryptBytes, encryptBytes, newKdfParams, type KdfParams } from '$lib/crypto/vault'
import { bytesToBase64, base64ToBytes } from '$lib/crypto/base64'
import { loadSettings, saveSettings, type AppSettings } from '$lib/db/repo/settings'

/**
 * The portable `.noter` vault: the entire workspace in one file, for moving
 * between machines.
 *
 * Layout:
 *   "NOTER" | version u8 | flags u8 | headerLen u32be | header JSON | body
 *
 * The header stays in clear text on purpose. It carries the format version and
 * the key-derivation parameters, which are needed *before* a passphrase can be
 * checked, and it lets the import screen describe a backup ("342 notes, 12 March")
 * before asking for one.
 *
 * The body is a JSON manifest followed by the raw image bytes, concatenated with
 * length prefixes — never base64, which would inflate every screenshot by a
 * third. That buffer is deflated and then, when a passphrase is given, encrypted
 * with AES-GCM. GCM authenticates as well as encrypts, so a truncated or
 * tampered file fails to open instead of importing corrupt data.
 */

const MAGIC = new Uint8Array([0x4e, 0x4f, 0x54, 0x45, 0x52]) // "NOTER"
const FORMAT_VERSION = 1
const FLAG_ENCRYPTED = 0x01

export interface VaultHeader {
  version: number
  encrypted: boolean
  createdAt: number
  app: string
  counts: { notes: number; folders: number; assets: number }
  kdf: KdfParams | null
  iv: string | null
}

interface AssetRecord extends Omit<Asset, 'blob' | 'thumb'> {
  /** Byte lengths, so the blobs can be sliced back out of the tail. */
  blobBytes: number
  thumbBytes: number
}

interface Manifest {
  notes: Note[]
  folders: Folder[]
  smartFolders: SmartFolder[]
  themes: Theme[]
  versions: Version[]
  settings: AppSettings
  assets: AssetRecord[]
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, false)
  return bytes
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, false)
}

/** Builds the complete workspace payload: manifest JSON, then the image bytes. */
async function buildBody(): Promise<{ body: Uint8Array; counts: VaultHeader['counts'] }> {
  const [notes, folders, smartFolders, themes, versions, assets, settings] = await Promise.all([
    db.notes.toArray(),
    db.folders.toArray(),
    db.smartFolders.toArray(),
    db.themes.toArray(),
    db.versions.toArray(),
    db.assets.toArray(),
    loadSettings(),
  ])

  const blobs: Uint8Array[] = []
  const assetRecords: AssetRecord[] = []

  for (const asset of assets) {
    const blob = new Uint8Array(await asset.blob.arrayBuffer())
    const thumb = new Uint8Array(await asset.thumb.arrayBuffer())
    blobs.push(blob, thumb)
    const { blob: _blob, thumb: _thumb, ...rest } = asset
    assetRecords.push({ ...rest, blobBytes: blob.length, thumbBytes: thumb.length })
  }

  const manifest: Manifest = {
    notes,
    folders,
    smartFolders,
    themes,
    versions,
    settings,
    assets: assetRecords,
  }

  const json = new TextEncoder().encode(JSON.stringify(manifest))
  const body = concat([u32(json.length), json, ...blobs])

  return {
    body,
    counts: { notes: notes.length, folders: folders.length, assets: assets.length },
  }
}

export interface ExportOptions {
  /** Omitting this produces a compressed but unencrypted file. */
  passphrase?: string
}

export async function exportVault(options: ExportOptions = {}): Promise<Blob> {
  const { body, counts } = await buildBody()
  const compressed = deflateSync(body, { level: 6 })

  let payload: Uint8Array = compressed
  let kdf: KdfParams | null = null
  let iv: string | null = null

  if (options.passphrase) {
    kdf = newKdfParams()
    const key = await deriveKey(options.passphrase, kdf)
    const sealed = await encryptBytes(key, compressed)
    payload = sealed.ct
    iv = bytesToBase64(sealed.iv)
  }

  const header: VaultHeader = {
    version: FORMAT_VERSION,
    encrypted: Boolean(options.passphrase),
    createdAt: Date.now(),
    app: 'noter',
    counts,
    kdf,
    iv,
  }

  const headerBytes = new TextEncoder().encode(JSON.stringify(header))
  const flags = new Uint8Array([options.passphrase ? FLAG_ENCRYPTED : 0])

  return new Blob(
    [
      concat([
        MAGIC,
        new Uint8Array([FORMAT_VERSION]),
        flags,
        u32(headerBytes.length),
        headerBytes,
        payload,
      ]) as BlobPart,
    ],
    { type: 'application/octet-stream' },
  )
}

export class VaultFileError extends Error {}

/** Reads the clear-text header, so a file can be described before it is opened. */
export function readHeader(bytes: Uint8Array): { header: VaultHeader; payloadOffset: number } {
  if (bytes.length < MAGIC.length + 6) throw new VaultFileError('This file is too short to be a Noter backup.')
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new VaultFileError('This is not a Noter backup file.')
  }

  const version = bytes[MAGIC.length]!
  if (version > FORMAT_VERSION) {
    throw new VaultFileError(`This backup was written by a newer version of Noter (format ${version}).`)
  }

  const headerLength = readU32(bytes, MAGIC.length + 2)
  const headerStart = MAGIC.length + 6
  const headerEnd = headerStart + headerLength
  if (headerEnd > bytes.length) throw new VaultFileError('This backup file is truncated.')

  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(headerStart, headerEnd))) as VaultHeader
  return { header, payloadOffset: headerEnd }
}

export type ImportMode = 'merge' | 'replace'

export interface ImportResult {
  notes: number
  folders: number
  assets: number
  skipped: number
}

async function decodeBody(
  bytes: Uint8Array,
  header: VaultHeader,
  payloadOffset: number,
  passphrase?: string,
): Promise<Manifest & { blobs: Uint8Array }> {
  let payload = bytes.subarray(payloadOffset)

  if (header.encrypted) {
    if (!passphrase) throw new VaultFileError('This backup is encrypted. A passphrase is required.')
    if (!header.kdf || !header.iv) throw new VaultFileError('This backup is missing its encryption header.')
    const key = await deriveKey(passphrase, header.kdf)
    try {
      payload = await decryptBytes(key, base64ToBytes(header.iv), payload)
    } catch {
      // AES-GCM refuses to return anything when the tag does not verify, so a
      // wrong passphrase and a corrupt file are indistinguishable here.
      throw new VaultFileError('Wrong passphrase, or the file is damaged.')
    }
  }

  let raw: Uint8Array
  try {
    raw = inflateSync(payload)
  } catch {
    throw new VaultFileError('This backup could not be decompressed.')
  }

  const jsonLength = readU32(raw, 0)
  const manifest = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + jsonLength))) as Manifest
  return { ...manifest, blobs: raw.subarray(4 + jsonLength) }
}

export async function describeVault(file: Blob): Promise<VaultHeader> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return readHeader(bytes).header
}

/**
 * Restores a vault.
 *
 * `merge` keeps whichever copy of a record has the newer `updatedAt`, which is
 * what makes moving between two machines safe. `replace` wipes the workspace
 * first and is only reached through an explicit confirmation.
 */
export async function importVault(
  file: Blob,
  mode: ImportMode = 'merge',
  passphrase?: string,
): Promise<ImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { header, payloadOffset } = readHeader(bytes)
  const manifest = await decodeBody(bytes, header, payloadOffset, passphrase)

  const result: ImportResult = { notes: 0, folders: 0, assets: 0, skipped: 0 }

  await db.transaction(
    'rw',
    [db.notes, db.folders, db.smartFolders, db.themes, db.versions, db.assets, db.settings],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.notes.clear(),
          db.folders.clear(),
          db.smartFolders.clear(),
          db.themes.clear(),
          db.versions.clear(),
          db.assets.clear(),
        ])
      }

      for (const folder of manifest.folders) {
        const existing = mode === 'merge' ? await db.folders.get(folder.id) : undefined
        if (existing && existing.updatedAt >= folder.updatedAt) {
          result.skipped++
          continue
        }
        await db.folders.put(folder)
        result.folders++
      }

      for (const note of manifest.notes) {
        const existing = mode === 'merge' ? await db.notes.get(note.id) : undefined
        if (existing && existing.updatedAt >= note.updatedAt) {
          result.skipped++
          continue
        }
        await db.notes.put(note)
        result.notes++
      }

      let offset = 0
      for (const record of manifest.assets) {
        const blob = manifest.blobs.subarray(offset, offset + record.blobBytes)
        offset += record.blobBytes
        const thumb = manifest.blobs.subarray(offset, offset + record.thumbBytes)
        offset += record.thumbBytes

        if (mode === 'merge' && (await db.assets.get(record.id))) continue
        const { blobBytes: _b, thumbBytes: _t, ...rest } = record
        await db.assets.put({
          ...rest,
          blob: new Blob([blob as BlobPart], { type: record.mime }),
          thumb: new Blob([thumb as BlobPart], { type: record.mime }),
        })
        result.assets++
      }

      for (const smart of manifest.smartFolders) await db.smartFolders.put(smart)
      for (const theme of manifest.themes) await db.themes.put(theme)
      for (const version of manifest.versions) await db.versions.put(version)

      if (mode === 'replace' && manifest.settings) await saveSettings(manifest.settings)
    },
  )

  return result
}

export function vaultFileName(): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `noter-${stamp}.noter`
}
