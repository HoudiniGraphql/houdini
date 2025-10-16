import type { Config } from 'houdini'

import type { SvelteTransformPage } from '../../types'
import init from './init'
import session from './session'

export default async function SvelteKitProcessor(config: Config, page: SvelteTransformPage) {
	// if we aren't running on a kit project, don't do anything
	if (page.framework !== 'kit') {
		return
	}

	// modify page with the rest of the stuff
	await Promise.all([session(page), init(page)])
}
