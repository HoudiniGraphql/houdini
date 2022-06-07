// externals
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
// locals
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import generateAdapter from './adapter'

// @ts-ignore
const currentDir = global.__dirname || path.dirname(fileURLToPath(import.meta.url))

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// when running in the real world, scripts are nested in a sub directory of build, in tests they aren't nested
	// under /src so we need to figure out how far up to go to find the appropriately compiled runtime
	const relative = process.env.TEST ? '../../../../' : '../'

	// we want to copy the typescript source code for the templates and then compile the files according
	// to the requirements of the platform
	const source = path.resolve(
		currentDir,
		relative,
		'build',
		config.module === 'esm' ? 'runtime-esm' : 'runtime-cjs'
	)

	// copy the compiled source code to the target directory
	await recursiveCopy(config, source, config.runtimeDirectory)

	// generate the adapter to normalize interactions with the framework
	await generateAdapter(config)
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
			(await fs.readdir(source)).map(async (child) => {
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
				if ((await fs.lstat(childPath)).isDirectory()) {
					// keep walking down
					await recursiveCopy(config, childPath, parentDir, true)
				}
				// the child is a file, copy it to the parent directory
				else {
					const targetPath = path.join(parentDir, child)

					let contents = await fs.readFile(childPath, 'utf-8')

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
							contents.replace('"use strict";', '')
					}

					await writeFile(targetPath, contents)
				}
			})
		)
	}
}
