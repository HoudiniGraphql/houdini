// externals
import path from 'path'
import fs from 'fs/promises'
import { Config } from 'houdini-common'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
// locals
import { CollectedGraphQLDocument } from '../../types'

// @ts-ignore
const currentDir = __dirname || dirname(fileURLToPath(import.meta.url))

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// when running in the real world, scripts are nested in a sub directory of build, in tests they aren't nested
	// under /src so we need to figure out how far up to go to find the appropriately compiled runtime
	const relative = process.env.TEST ? '../../..' : './'

	// we want to copy the typescript source code for the templates and then compile the files according
	// to the requirements of the platform
	const source = path.resolve(
		currentDir,
		relative,
		'build',
		config.mode === 'kit' ? 'runtime-esm' : 'runtime-cjs'
	)

	// copy the compiled source code to the target directory
	await recursiveCopy(source, config.runtimeDirectory)
}

async function recursiveCopy(source: string, target: string, notRoot?: boolean) {
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

				// if the child is a directory
				if ((await fs.lstat(childPath)).isDirectory()) {
					// keep walking down
					await recursiveCopy(childPath, parentDir, true)
				}
				// the child is a file, copy it to the parent directory
				else {
					const targetPath = path.join(parentDir, child)

					await fs.writeFile(targetPath, await fs.readFile(childPath, 'utf-8'))
				}
			})
		)
	}
}
