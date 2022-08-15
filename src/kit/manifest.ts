import path from 'path'

import { Config } from '../common'
import * as fs from '../common/fs'

// safely import the files when we're transforming
export async function load_manifest(
	config: Config
): Promise<(filepath: string) => Promise<Record<string, any>>> {
	// if this isn't a sveltekit project, just use imports
	if (config.framework !== 'kit') {
		return (filepath: string) => import(filepath)
	}

	// we need to walk down the route directory and find every route script
	const paths: Record<string, string> = {}
	await config.walkRouteDir({
		async routeScript(filepath) {
			// read the contents
			const contents = await fs.readFile(filepath)
			if (!contents) {
				return
			}

			// typescript files need to be imported from their compiled location
			paths[filepath] = !filepath.endsWith('.ts')
				? filepath
				: config.compiledAssetPath(filepath)
		},
	})

	// once we have the manifest, all we need to do is import the transpiled version of the file
	return async (filepath: string) => {
		return await import(paths[filepath])
	}
}
