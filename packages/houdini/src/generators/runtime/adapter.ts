// external imports
import path from 'path'
import fs from 'fs/promises'
import { Config } from 'houdini-common'

export default async function generateAdapter(config: Config) {
	// the location of the adapter
	const adapterLocation = path.join(config.runtimeDirectory, 'adapter.mjs')

	// write the index file that exports the runtime
	await fs.writeFile(adapterLocation, adapter, 'utf-8')
}

const adapter = `import { stores } from '@sapper/app'

export function getSession() {
    return stores().session
}

export function goTo(location, options) {
    goTo(location, options)
}
`
