/**
 * Whether the vault is open, readable without loading the vault itself: the
 * palette and the navigation only need to know, not to decrypt anything.
 */
export const vaultStatus = $state({ unlocked: false })
