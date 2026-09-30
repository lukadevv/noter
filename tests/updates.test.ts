import { describe, expect, it } from 'vitest'
import { compareVersions, pickAsset } from '$lib/platform/semver'

describe('version comparison', () => {
  it('orders versions numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.3')).toBeGreaterThan(0)
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0)
    expect(compareVersions('1.2', '1.2.1')).toBeLessThan(0)
    expect(compareVersions('2.0.0-beta.1', '1.9.9')).toBeGreaterThan(0)
  })

  it('picks the file each platform downloads', () => {
    const assets = [
      { name: 'noter-1.1.0.apk', browser_download_url: 'a' },
      { name: 'Noter_1.1.0_amd64.deb', browser_download_url: 'b' },
      { name: 'Noter-1.1.0-1.x86_64.rpm', browser_download_url: 'c' },
    ]
    expect(pickAsset(assets, 'android')?.browser_download_url).toBe('a')
    expect(pickAsset(assets, 'deb')?.browser_download_url).toBe('b')
    expect(pickAsset([], 'rpm')).toBeNull()
  })
})
