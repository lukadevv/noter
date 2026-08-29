/**
 * The full Lucide catalogue, loaded on demand.
 *
 * The icons the interface itself uses are statically imported and tree-shaken
 * (see registry.ts). The other ~1500 are only needed when someone opens the icon
 * picker, so the whole catalogue lives behind this dynamic import and never
 * touches the initial payload.
 */

/** Lucide's icon shape: a list of `[tag, attributes]` pairs. */
export type IconNode = [string, Record<string, string | number>][]

let catalog: Map<string, IconNode> | null = null
let loading: Promise<Map<string, IconNode>> | null = null

function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

export function loadCatalog(): Promise<Map<string, IconNode>> {
  if (catalog) return Promise.resolve(catalog)
  if (loading) return loading

  loading = import('lucide').then((module) => {
    const entries = new Map<string, IconNode>()
    for (const [name, value] of Object.entries(module as Record<string, unknown>)) {
      // The module also exports helpers; only the icon data is an array of pairs.
      if (!Array.isArray(value) || !Array.isArray(value[0])) continue
      // Aliases resolve to the same data; the kebab key deduplicates them.
      entries.set(toKebab(name), value as IconNode)
    }
    catalog = entries
    loading = null
    return entries
  })

  return loading
}

/** Synchronous lookup; returns null until the catalogue has been loaded. */
export function cachedIcon(name: string): IconNode | null {
  return catalog?.get(name) ?? null
}

export function catalogLoaded(): boolean {
  return catalog !== null
}

export const DEFAULT_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
} as const

/** Serialises an icon's node list into SVG markup. */
export function iconToSvg(node: IconNode, size: number, strokeWidth: number): string {
  const children = node
    .map(([tag, attrs]) => {
      const serialised = Object.entries(attrs)
        .map(([key, value]) => `${key}="${String(value).replace(/"/g, '&quot;')}"`)
        .join(' ')
      return `<${tag} ${serialised}/>`
    })
    .join('')

  const attrs = Object.entries({ ...DEFAULT_ATTRS, width: size, height: size, 'stroke-width': strokeWidth })
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

  return `<svg ${attrs}>${children}</svg>`
}
