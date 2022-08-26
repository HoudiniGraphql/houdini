import path from 'path'

import { Config, writeFile } from '../../../common'

export default async function generateAdapter(config: Config) {
	// the location of the adapter
	const adapterLocation = path.join(config.runtimeDirectory, 'adapter.js')

	// figure out which adapter we need to lay down
	const adapter = {
		kit: sveltekitAdapter,
		svelte: svelteAdapter,
	}[config.framework]

	// write the index file that exports the runtime
	await writeFile(adapterLocation, adapter)
}

const sveltekitAdapter = `import { goto as go } from '$app/navigation'
import { get } from 'svelte/store';
import { browser, dev, prerendering } from '$app/environment'
import { error as svelteKitError } from '@sveltejs/kit'


export function goTo(location, options) {
    go(location, options)
}

export const isBrowser = browser

/**
 *  After \`clientStarted = true\`, only client side navigation will happen.
 */
export let clientStarted = false; // Will be true on a client side navigation
if (browser) {
  addEventListener('sveltekit:start', () => {
    clientStarted = true;
  });
}

export const isPrerender = prerendering

export const error = svelteKitError

export const isDev = dev
`

const svelteAdapter = `
import { readable, writable } from 'svelte/store'

export function goTo(location, options) {
	window.location = location
}

export const isBrowser = true

export const clientStarted = true

export const isPrerender = false

export const error = (code, message) => {
	const err = new Error(message)
	error.code = code
	return err
}

// Hopefully everybody is already sing vite...
export const isDev = import.meta.env.DEV
`
