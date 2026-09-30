import { NoterDB, db } from '$lib/db/db'

let counter = 0

/**
 * Points the shared `db` instance at a fresh store.
 *
 * Every table is swapped, not a hand-picked list: a table left pointing at the
 * default database would make a transaction span two databases, which Dexie
 * rejects, and new tables would silently be missed.
 */
export async function useFreshDb(prefix = 'noter-test'): Promise<NoterDB> {
  const fresh = new NoterDB(`${prefix}-${counter++}`)
  await fresh.open()
  const swap: Record<string, unknown> = { transaction: fresh.transaction.bind(fresh) }
  for (const table of fresh.tables) swap[table.name] = table
  Object.assign(db, swap)
  return fresh
}
