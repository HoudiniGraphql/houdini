// external imports
import path from 'path'
import fs from 'fs/promises'
// local imports
import { Config } from '../../../common'
import { writeFile } from '../../utils'

export default async function generateAdapter(config: Config) {
	// the location of the adapter
	const adapterLocation = path.join(config.runtimeDirectory, 'adapter.js')

	// delete the existing adapter
	try {
		await fs.stat(adapterLocation)
		await fs.rm(adapterLocation)
	} catch {}

	// figure out which adapter we need to lay down
	const adapter = {
		sapper: sapperAdapter,
		kit: sveltekitAdapter,
		svelte: svelteAdapter,
	}[config.framework]

	// write the index file that exports the runtime
	await writeFile(adapterLocation, adapter)
}

const sapperAdapter = `import { stores, goto as go } from '@sapper/app'
import { get } from 'svelte/store';

export function getSession() {
    return stores().session
}

export function getPage() {
	return stores().page
}

export function goTo(location, options) {
    go(location, options)
}

export const isBrowser = process.browser

export const clientStarted = true; // Not tested in Sapper.
`

const sveltekitAdapter = `import { goto as go } from '$app/navigation'
import { page, session } from '$app/stores';
import { get } from 'svelte/store';
import { browser } from '$app/env'

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
`
