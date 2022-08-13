import path from 'path'
import { transformWithEsbuild } from 'vite'

import { Config } from '../../../common'
import * as fs from '../../../common/fs'
import { CollectedGraphQLDocument } from '../../types'

export default async function svelteKitGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// if we're not in a sveltekit project, don't do anything
	if (config.framework !== 'kit') {
		return
	}

	// we need to walk down their
}
