import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import { theme } from '$lib/stores/theme.svelte'
import { registerServiceWorker } from '$lib/pwa'

// Paint with the previous session's theme before anything else renders.
theme.bootFromMirror()

const target = document.getElementById('app')
if (!target) throw new Error('Missing #app mount point')

mount(App, { target })

registerServiceWorker()
