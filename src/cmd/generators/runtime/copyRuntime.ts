import { parse } from 'commander'
import path from 'path'
import * as recast from 'recast'
import { fileURLToPath } from 'url'

import { Config, parseJS } from '../../../common'
import * as fs from '../../../common/fs'
import { CollectedGraphQLDocument } from '../../types'
import generateAdapter from './adapter'

type ExportNamedDeclaration = recast.types.namedTypes.ExportNamedDeclaration
type TSDeclareFunction = recast.types.namedTypes.TSDeclareFunction

// @ts-ignore
const currentDir = global.__dirname || path.dirname(fileURLToPath(import.meta.url))

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// when running in the real world, scripts are nested in a sub directory of build, in tests they aren't nested
	// under /src so we need to figure out how far up to go to find the appropriately compiled runtime
	const relative = process.env.TEST
		? path.join(currentDir, '../../../../')
		: // TODO: it's very possible this breaks someones setup. the old version walked up from currentDir
		  // there isn't a consistent number of steps up anymore since the vite plugin and cmd live at different depths
		  // a better approach could be to start at current dir and walk up until we find a `houdini` dir
		  path.join(path.dirname(config.filepath), 'node_modules', 'houdini')

	// we want to copy the typescript source code for the templates and then compile the files according
	// to the requirements of the platform
	const source = path.resolve(
		relative,
		'build',
		config.module === 'esm' ? 'runtime-esm' : 'runtime-cjs'
	)

	// copy the compiled source code to the target directory
	await recursiveCopy(config, source, config.runtimeDirectory)

	// generate the adapter to normalize interactions with the framework
	await Promise.all([generateAdapter(config)])
}

async function recursiveCopy(config: Config, source: string, target: string, notRoot?: boolean) {
	// if the folder containing the target doesn't exist, then we need to create it
	let parentDir = path.join(target, path.basename(source))
	// if we are at the root, then go up one
	if (!notRoot) {
		parentDir = path.join(parentDir, '..')
	}
	try {
		await fs.access(parentDir)
		// the parent directory does not exist
	} catch (e) {
		await fs.mkdir(parentDir)
	}

	// check if we are copying a directory
	if ((await fs.stat(source)).isDirectory()) {
		// look in the contents of the source directory
		await Promise.all(
			(
				await fs.readdir(source)
			).map(async (child) => {
				// figure out the full path of the source
				const childPath = path.join(source, child)

				// TODO: find a better way of handling this. The runtime needs to be able to import the config file
				//       to support features like custom scalars. In order to pull this off, this generator
				//       copies the compiled runtime and then manually adds an import to the config file.
				//       The runtime index file already exports the config file but for some reason vite
				//       can't find the exported value when it comes from inside. It has no problem
				//       finding the config reference exported from $houdini from the preprocessor 🤷
				const isCacheIndex =
					source.substring(source.lastIndexOf(path.sep) + 1) === 'cache' &&
					child === 'index.js'
				const cacheIndexPath = path.join(config.runtimeDirectory, 'cache', 'index.js')

				// if the child is a directory
				if ((await fs.stat(childPath)).isDirectory()) {
					// keep walking down
					await recursiveCopy(config, childPath, parentDir, true)
				}
				// the child is a file, copy it to the parent directory
				else {
					const targetPath = path.join(parentDir, child)
					// Do not write `/runtime/adapter.js` file. It will be generated later depending on the framework.
					if (targetPath.endsWith('/runtime/adapter.js')) {
						return
					}

					let contents = await fs.readFile(childPath)

					// if we are writing to the cache index file, modify the contents
					if (isCacheIndex) {
						const relativePath = path
							.relative(cacheIndexPath, config.filepath)
							.slice('../'.length)
							.split(path.sep)
							.join('/')

						contents =
							(config.module === 'esm'
								? `import config from "${relativePath}"\n`
								: `var config = require('${relativePath}');`) +
							(contents || '').replace('"use strict";', '')
					}

					await fs.writeFile(targetPath, contents || '')
				}
			})
		)
	}
}
