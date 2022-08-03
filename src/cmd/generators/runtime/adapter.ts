// external imports
import path from 'path'
// local imports
import { writeFile } from '../../../common/fs'
import { Config } from '../../../common/config'

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
import { page, session } from '$app/stores';
import { get } from 'svelte/store';
import { browser, prerendering } from '$app/env'

export function getSession() {
    return session
}

export function getPage() {
	return page
}

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
`

const svelteAdapter = `
import { readable, writable } from 'svelte/store'

const session = writable({})
const page = readable({})

export function getSession() {
	return session
}

export function getPage() {
	return page
}

export function goTo(location, options) {
	window.location = location
}

export const isBrowser = true

export const clientStarted = true

export const isPrerender = false
`
