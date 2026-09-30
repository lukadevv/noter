import { expect, test } from '@playwright/test'
import { createNoteWith, openApp, settleAutosave } from './helpers'

/**
 * The offline story is the one thing that cannot be checked any other way: the
 * service worker, the precache manifest and the injected CSP only exist in a
 * real production build served over HTTP.
 */
test.describe('offline and PWA', () => {
  // The service worker is only registered in a production build.
  test.skip(process.env.E2E_DEV === '1', 'requires the production build')

  test('serves the app and its notes with the network cut', async ({ page, context }) => {
    await openApp(page)
    await createNoteWith(page, 'Written before going offline')

    // Wait for the worker to take control, otherwise the reload races it.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByTestId('view-all')).toBeVisible()
    await expect(page.getByTestId('note-item').first()).toContainText('Written before going offline')
  })

  test('keeps editing working while offline', async ({ page, context }) => {
    await openApp(page)
    await createNoteWith(page, 'Offline note')
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))

    await context.setOffline(true)
    await page.locator('.cm-content').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' edited with no network')

    await settleAutosave(page, 'edited with no network')

    await page.reload()
    await page.getByTestId('note-item').first().click()
    await expect(page.locator('.cm-content')).toContainText('edited with no network')
  })

  test('serves the manifest from the cache', async ({ page, context }) => {
    await openApp(page)
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
    await context.setOffline(true)

    const manifest = await page.evaluate(async () => {
      const response = await fetch('/manifest.webmanifest')
      return response.ok ? ((await response.json()) as { name: string; display: string }) : null
    })

    expect(manifest?.name).toBe('Noter')
    expect(manifest?.display).toBe('standalone')
  })

  test('declares the share target and file handlers', async ({ page }) => {
    await openApp(page)

    const manifest = await page.evaluate(async () => {
      const response = await fetch('/manifest.webmanifest')
      return (await response.json()) as {
        share_target?: { action: string; method: string }
        file_handlers?: { action: string }[]
        icons: { sizes: string; purpose?: string }[]
      }
    })

    expect(manifest.share_target?.method).toBe('POST')
    expect(manifest.file_handlers?.length).toBeGreaterThan(0)
    // A maskable icon is what stops Android cropping the artwork badly.
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  })

  test('serves every icon the metadata points at', async ({ page }) => {
    await openApp(page)

    const links = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"], link[rel="manifest"]')].map(
        (link) => link.getAttribute('href') ?? '',
      ),
    )
    expect(links).toContain('/favicon.ico')
    expect(links).toContain('/icons/apple-touch-icon.png')

    const manifest = await page.evaluate(async () => {
      const response = await fetch('/manifest.webmanifest')
      return (await response.json()) as { icons: { src: string }[] }
    })

    // A broken icon path is invisible until someone tries to install the app.
    const targets = [...links, ...manifest.icons.map((icon) => `/${icon.src}`), '/og.png']
    for (const target of targets) {
      const status = await page.evaluate(async (url) => (await fetch(url)).status, target)
      expect(status, `${target} should be served`).toBe(200)
    }
  })

  test('shows the product logo as the sidebar brand mark', async ({ page }) => {
    await openApp(page)

    // Inline SVG, so it can never be a broken image; check it actually drew.
    const mark = page.locator('.brand svg.logo')
    await expect(mark).toBeVisible()
    await expect(mark.locator('path')).toHaveCount(1)
  })

  test('carries link-preview metadata', async ({ page }) => {
    await openApp(page)

    const meta = await page.evaluate(() => {
      const get = (selector: string) => document.querySelector(selector)?.getAttribute('content') ?? null
      return {
        title: get('meta[property="og:title"]'),
        description: get('meta[property="og:description"]'),
        image: get('meta[property="og:image"]'),
        card: get('meta[name="twitter:card"]'),
        width: get('meta[property="og:image:width"]'),
      }
    })

    expect(meta.title).toContain('Noter')
    expect(meta.description).toBeTruthy()
    expect(meta.image).toContain('og.png')
    expect(meta.card).toBe('summary_large_image')
    expect(meta.width).toBe('1200')
  })

  test('publishes structured data search engines can read', async ({ page }) => {
    await openApp(page)

    const graph = await page.evaluate(() => {
      const script = document.querySelector('script[type="application/ld+json"]')
      return script
        ? (JSON.parse(script.textContent ?? '{}') as { '@graph': Record<string, unknown>[] })
        : null
    })

    expect(graph).not.toBeNull()
    const app = graph!['@graph'].find((node) => node['@type'] === 'SoftwareApplication')
    expect(app, 'no SoftwareApplication node').toBeDefined()
    expect(app!.name).toBe('Noter')
    expect(app!.isAccessibleForFree).toBe(true)
    // Free apps need an explicit zero-price offer; validators do not assume it.
    expect(app!.offers).toMatchObject({ price: '0' })
    expect((app!.inLanguage as string[]).length).toBe(10)
    expect((app!.featureList as string[]).length).toBeGreaterThan(4)
  })

  test('serves robots.txt and a sitemap', async ({ page }) => {
    await openApp(page)

    for (const path of ['/robots.txt', '/sitemap.xml']) {
      const status = await page.evaluate(async (url) => (await fetch(url)).status, path)
      expect(status, `${path} should be served`).toBe(200)
    }

    const sitemap = await page.evaluate(async () => (await fetch('/sitemap.xml')).text())
    expect(sitemap).toContain('http://www.sitemaps.org/schemas/sitemap/0.9')
  })

  test('declares its language alternates', async ({ page }) => {
    await openApp(page)

    const alternates = await page.evaluate(() =>
      [...document.querySelectorAll('meta[property="og:locale:alternate"]')].map((meta) =>
        meta.getAttribute('content'),
      ),
    )

    // Nine alternates beside the default locale.
    expect(alternates).toHaveLength(9)
    expect(alternates).toContain('ar_AR')
  })

  test('ships a Content-Security-Policy that blocks inline scripts', async ({ page }) => {
    await openApp(page)

    const csp = await page.evaluate(
      () =>
        document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '',
    )

    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain('unsafe-eval')
    // frame-ancestors is header-only; shipping it in a meta tag would just warn.
    expect(csp).not.toContain('frame-ancestors')
  })

  test('loads the editor from a separate chunk, not the initial bundle', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => {
      if (request.url().endsWith('.js')) requested.push(request.url())
    })

    await openApp(page)
    // Nothing has opened an editor yet, so CodeMirror must not have been fetched.
    expect(requested.some((url) => /setup-.*\.js$/.test(url))).toBe(false)

    await page.getByTestId('new-note-empty').click()
    await expect(page.locator('.cm-content')).toBeVisible()
    expect(requested.some((url) => /setup-.*\.js$/.test(url))).toBe(true)
  })

  test('does not download the icon catalogue until the picker is opened', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => {
      if (request.url().endsWith('.js')) requested.push(request.url())
    })

    await openApp(page)
    await page.getByTestId('new-folder').click()
    expect(requested.some((url) => /lucide-.*\.js$/.test(url))).toBe(false)

    const row = page.getByRole('tree').getByTestId('folder-row').first()
    await row.hover()
    await row.getByLabel('Folder actions').click()
    await page.getByTestId('menu-item').filter({ hasText: 'Appearance' }).click()
    await page.getByRole('button', { name: 'Change icon' }).click()

    await expect(page.getByLabel('Search icons')).toHaveAttribute('placeholder', /Search \d{3,} icons/)
    expect(requested.some((url) => /lucide-.*\.js$/.test(url))).toBe(true)
  })
})
