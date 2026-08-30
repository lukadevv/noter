import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { alternateOgLocales, structuredData } from './src/lib/seo'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

/**
 * The CSP is only injected for production builds: Vite's dev server relies on
 * inline bootstrap scripts and a websocket that a strict policy would block.
 *
 * `frame-ancestors` is deliberately absent — browsers ignore it in a <meta> tag,
 * so it belongs in an HTTP response header. See the deployment notes in README.
 */
const CSP = [
  "default-src 'self'",
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: data:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https:",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function csp(): Plugin {
  // The desktop shell declares its own policy in `tauri.conf.json`, which has to
  // allow the IPC protocol this one knows nothing about. Two policies both apply,
  // so the browser-shaped one is left out of that build. See scripts/build-native.mjs.
  const skip = process.env.NOTER_NATIVE === 'tauri'

  return {
    name: 'noter-csp',
    apply: 'build',
    transformIndexHtml(html) {
      if (skip) return html
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

/**
 * Fills in `%SITE_URL%` for the link-preview tags.
 *
 * Open Graph requires an absolute URL for `og:image`, which a static build has
 * no way to know. Set `VITE_SITE_URL` when deploying; without it the tags fall
 * back to relative paths, which most scrapers ignore — so previews simply do not
 * appear rather than pointing somewhere wrong.
 */
function siteUrl(): Plugin {
  const base = () => (process.env.VITE_SITE_URL ?? '').replace(/\/$/, '')

  return {
    name: 'noter-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', base())
    },
    // `robots.txt` and `sitemap.xml` are copied verbatim from public/, so their
    // placeholders are filled in on the emitted files instead.
    closeBundle() {
      const origin = base()
      for (const file of ['robots.txt', 'sitemap.xml']) {
        const path = fileURLToPath(new URL(`./dist/${file}`, import.meta.url))
        if (!existsSync(path)) continue
        const contents = readFileSync(path, 'utf8')
        // With no origin configured, drop the lines that would be meaningless.
        const filled = origin
          ? contents.replaceAll('%SITE_URL%', origin)
          : contents
              .split('\n')
              .filter((line) => !line.includes('%SITE_URL%'))
              .join('\n')
        writeFileSync(path, filled)
      }
    },
  }
}

/**
 * Injects the parts of the head that are computed rather than written by hand:
 * structured data, the locale alternates, and the Search Console token.
 *
 * Building these here keeps `index.html` readable and keeps the feature list in
 * one place instead of drifting between the page and the code.
 */
function seo(): Plugin {
  return {
    name: 'noter-seo',
    transformIndexHtml() {
      const base = (process.env.VITE_SITE_URL ?? '').replace(/\/$/, '')
      const verification = process.env.VITE_GOOGLE_SITE_VERIFICATION ?? ''

      const tags: HtmlTagDescriptor[] = [
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: structuredData(base, version),
          injectTo: 'head',
        },
        ...alternateOgLocales().map((locale) => ({
          tag: 'meta',
          attrs: { property: 'og:locale:alternate', content: locale },
          injectTo: 'head' as const,
        })),
      ]

      // Google's HTML-tag verification. Left out entirely when unset, rather
      // than emitting an empty token that would fail verification confusingly.
      if (verification) {
        tags.push({
          tag: 'meta',
          attrs: { name: 'google-site-verification', content: verification },
          injectTo: 'head-prepend',
        })
      }

      if (base) {
        tags.push({
          tag: 'link',
          attrs: { rel: 'canonical', href: `${base}/` },
          injectTo: 'head',
        })
      }

      return tags
    },
  }
}

export default defineConfig({
  plugins: [
    svelte(),
    csp(),
    siteUrl(),
    seo(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Noter',
        short_name: 'Noter',
        description:
          'A note-taking app that runs entirely in your browser. Folders, images, checklists and ' +
          'search, with your notes stored on your own device and no account to create.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#16161a',
        theme_color: '#16161a',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'files', accept: ['image/*'] }],
          },
        },
        file_handlers: [{ action: '/', accept: { 'text/markdown': ['.md', '.markdown'] } }],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $components: fileURLToPath(new URL('./src/components', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // The budget check reads this to tell the initial payload from lazy chunks.
    manifest: true,
    cssCodeSplit: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // Keep chunk names readable so the budget check can attribute weight.
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
