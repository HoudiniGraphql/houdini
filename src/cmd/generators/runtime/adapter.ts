// external imports
import path from 'path'
// local imports
import { Config } from '../../../common'
import { writeFile } from '../../utils'

export default async function generateAdapter(config: Config) {
	// the location of the adapter
	const adapterLocation = path.join(config.runtimeDirectory, 'adapter.mjs')

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
`

const sveltekitAdapter = `import { goto as go } from '$app/navigation'
import { getStores } from '$app/stores'
import { browser } from '$app/env'

export function getSession() {
    return getStores().session
}

export function getPage() {
	return getStores().page
}

export function goTo(location, options) {
    go(location, options)
}

export const isBrowser = browser
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
`
