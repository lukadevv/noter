/** Compares "1.2.3" style versions (a leading "v" is ignored): negative, zero or positive. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]!
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
  const x = parse(a)
  const y = parse(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export interface ReleaseAsset {
  name: string
  browser_download_url: string
}

/** The file a platform should download from a release, if it has one. */
export function pickAsset(
  assets: ReleaseAsset[],
  platform: 'android' | 'deb' | 'rpm',
): ReleaseAsset | null {
  const ext = platform === 'android' ? '.apk' : `.${platform}`
  return assets.find((asset) => asset.name.toLowerCase().endsWith(ext)) ?? null
}
