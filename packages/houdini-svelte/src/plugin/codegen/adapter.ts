import { fs } from 'houdini'
import path from 'path'

import { PluginGenerateInput } from '.'

export default async function generateAdapter({ config, framework }: PluginGenerateInput) {
	// we only need to generate an adapter for kit (the default one is fine for vanilla svelte)
	if (framework !== 'kit') {
		return
	}

	// the location of the adapter
	const adapterLocation = path.join(config.pluginRuntimeDirectory('houdini-svelte'), 'adapter.js')

	// figure out which adapter we need to lay down
	const adapter = {
		kit: sveltekitAdapter,
	}[framework]

	// write the index file that exports the runtime
	await fs.mkdirp(path.dirname(adapterLocation))
	await fs.writeFile(adapterLocation, adapter)
}

const sveltekitAdapter = `import { goto as go } from '$app/navigation'
import { get } from 'svelte/store';
import { browser, prerendering } from '$app/environment'
import { page } from '$app/stores'
import { error as svelteKitError } from '@sveltejs/kit'

export function goTo(location, options) {
    go(location, options)
}

export const isBrowser = browser

export let clientStarted = false;

export function setClientStarted() {
	clientStarted = true
}

export const isPrerender = prerendering

export const error = svelteKitError
`
