import { isCapacitor, isTauri } from './native'

/**
 * Handing a generated file to the user, on every shell the app ships in.
 *
 * In a browser tab an anchor with a `download` attribute is all it takes. The
 * native shells have no download manager behind that attribute — clicking such
 * a link in a system webview does nothing at all — so each one needs its own
 * route out: a save dialog on the desktop, and the share sheet on Android,
 * which is what lets the file reach Downloads, Drive or a chat from a sandboxed
 * app without asking for storage permissions.
 */

/** Thrown when the file could not be written. Cancelling is not an error. */
export class SaveCancelled extends Error {}

/**
 * `btoa` needs a binary string, and spreading a multi-megabyte archive into
 * `String.fromCharCode` overflows the argument limit, so it is fed in chunks.
 */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

async function saveWithTauri(blob: Blob, filename: string): Promise<void> {
  const [{ save }, { invoke }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/api/core'),
  ])
  const path = await save({ defaultPath: filename })
  // The dialog returns null when dismissed.
  if (!path) throw new SaveCancelled()
  // Writing goes through the app's own command rather than the filesystem
  // plugin: the path came from the dialog the user just answered, so there is
  // nothing left for a scope to decide.
  await invoke('write_export', {
    path,
    contents: toBase64(new Uint8Array(await blob.arrayBuffer())),
  })
}

async function saveWithCapacitor(blob: Blob, filename: string): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  // The cache directory needs no permission and is cleaned up by the system;
  // the file only has to live long enough for the share sheet to copy it.
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: toBase64(new Uint8Array(await blob.arrayBuffer())),
    directory: Directory.Cache,
  })
  await Share.share({ title: filename, files: [uri] })
}

function saveWithAnchor(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Saves `blob` under `filename`. Resolves once the file has been written or
 * handed off; rejects with {@link SaveCancelled} if the user backed out.
 */
export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (isTauri()) return saveWithTauri(blob, filename)
  if (isCapacitor()) return saveWithCapacitor(blob, filename)
  saveWithAnchor(blob, filename)
}
