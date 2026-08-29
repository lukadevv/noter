import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'

// Node exposes WebCrypto under a different global than the browser does.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}
