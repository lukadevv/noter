import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import { theme } from '$lib/stores/theme.svelte'
import { i18n } from '$lib/i18n/index.svelte'
import { registerServiceWorker } from '$lib/pwa'

// Paint with the previous session's theme and language before anything else
// renders, so the first frame is neither the wrong colour nor the wrong
// direction.
theme.bootFromMirror()
i18n.boot()

const target = document.getElementById('app')
if (!target) throw new Error('Missing #app mount point')

mount(App, { target })

registerServiceWorker()
