import type { Config } from 'houdini'

import type { SvelteTransformPage } from '../types'
import init from './init'
import load from './load'
import session from './session'

export default async function SvelteKitProcessor(config: Config, page: SvelteTransformPage) {
	// if we aren't running on a kit project, don't do anything
	if (page.framework !== 'kit') {
		return
	}

	// add the load before we do anything else since it will create any functions we need
	// to mix into
	await load(page)

	// modify page with the rest of the stuff
	await Promise.all([session(page), init(page)])
}
