// external imports
import path from 'path'
import fs from 'fs/promises'
import { Config } from 'houdini-common'

export default async function generateAdapter(config: Config) {
	// the location of the adapter
	const adapterLocation = path.join(config.runtimeDirectory, 'adapter.mjs')

	// figure out the correct content
	const content = config.mode === 'kit' ? kitAdapter() : sapperAdapter()

	// write the index file that exports the runtime
	await fs.writeFile(adapterLocation, content, 'utf-8')
}

const kitAdapter = () => `import stores from '$app/stores'
import navigation from '$app/navigation'

export function getSession() {
    return stores.session
}

export function goTo(location, options) {
	navigation.goTo(location, options)
`

const sapperAdapter = () => `import { stores } from '@sapper/app'

export function getSession() {
    return stores().session
}

export function goTo(location, options) {
    goTo(location, options)
}
`
