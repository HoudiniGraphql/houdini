// external imports
import path from 'path'
import fs from 'fs/promises'
import { Config } from 'houdini-common'

export default async function generateAdapter(config: Config) {
	// the location of the adapter
	const adapterLocation = path.join(config.runtimeDirectory, 'adapter.mjs')

	// figure out which adapter we need to lay down
	const adapter = config.mode === 'sapper' ? sapperAdapter : sveltekitAdapter

	// write the index file that exports the runtime
	await fs.writeFile(adapterLocation, adapter, 'utf-8')
}

const sapperAdapter = `import { stores, goTo } from '@sapper/app'

export function getSession() {
    return stores().session
}

export function goTo(location, options) {
    goTo(location, options)
}
`

const sveltekitAdapter = `import { goTo } from '$app/navigation'
import { session } from '$app/stores'

export function getSession() {
    return session
}

export function goTo(location, options) {
    goTo(location, options)
}
`
