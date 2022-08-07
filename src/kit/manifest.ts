import babel from '@babel/core'
// @ts-ignore
import babelTs from '@babel/plugin-transform-typescript'
import path from 'path'

import { Config, parseJS } from '../common'
import * as fs from '../common/fs'

// safely import the files when we're transforming
export async function load_manifest(
	config: Config
): Promise<(filepath: string) => Promise<Record<string, any>>> {
	// if this isn't a sveltekit project, just use imports
	if (config.framework !== 'kit') {
		return (filepath: string) => import(filepath)
	}

	// we need to walk down the route directory and find every +page.ts
	const paths = await walk_route_dir(config)

	// once we have the manifest, all we need to do is import the transpiled version of the file
	return async (filepath: string) => {
		return await import(paths[filepath])
	}
}

async function walk_route_dir(
	config: Config,
	filepath: string = config.routesDir,
	paths: Record<string, string> = {}
): Promise<Record<string, string>> {
	for (const child of await fs.readdir(filepath)) {
		const child_path = path.join(filepath, child)
		// if we run into another directory, keep walking down
		if ((await fs.stat(child_path)).isDirectory()) {
			await walk_route_dir(config, child_path, paths)
		}

		// if we are processing a +page.ts, we need to compile it so we can
		// import the page info when transforming the route component
		else if (child === '+page.ts') {
			// read the contents
			const contents = await fs.readFile(child_path)
			if (!contents) {
				continue
			}

			// transform the result
			let transformed = ''
			try {
				let result = await babel.transformAsync(contents, {
					plugins: [babelTs],
					sourceType: 'module',
				})
				transformed = result?.code || ''
			} catch (e) {
				console.log(e)
			}
			if (!transformed) {
				continue
			}

			// write the transformed version somewhere we will refer to later
			paths[child_path] = compiled_path(config, child_path)
			await fs.writeFile(paths[child_path], transformed)
		}
	}

	return paths
}

function compiled_path(config: Config, filepath: string) {
	return path.join(
		config.compiledAssetsDir,
		path.relative(process.cwd(), filepath).replaceAll(path.sep, '_').replace('.ts', '.js')
	)
}
