import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

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
  return {
    name: 'noter-csp',
    apply: 'build',
    transformIndexHtml(html) {
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

export default defineConfig({
  plugins: [
    svelte(),
    csp(),
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
        description: 'Local-first offline notes with folders, images and themes.',
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
