import * as recast from 'recast'

import { getConfig } from '../lib'
import { TransformPage } from '../vite'

export default async function houdiniLoader(content: string): Promise<string> {
	// if there is no $houdini import, ignore it
	if (!content.includes('$houdini')) {
		return content
	}

	// load the current config
	const config = await getConfig()

	// bundle up the contextual stuff
	const ctx: TransformPage = {
		content,
		watch_file: () => {},
		config: config,
		filepath: '',
	}

	// run the plugin pipeline
	for (const plugin of config.plugins) {
		if (!plugin.transform_file) {
			continue
		}
		const { code } = await plugin.transform_file(ctx)
		ctx.content = code
	}

	// print the result and move on
	return ctx.content
}
