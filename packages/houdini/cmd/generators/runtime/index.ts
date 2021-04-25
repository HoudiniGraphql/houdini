// externals
import path from 'path'
import fs from 'fs/promises'
import * as recast from 'recast'
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../../types'
import generateAdapter from './adapter'

const AST = recast.types.builders

// the runtime generator is responsible for generating a majority of the runtime that the client will use.
// this includes things like query, fragment, mutation, etc. They are generated here instead of
// imported from npm so that they can be pushed through the bundler in order to use package aliases
// and sapper's internal @sapper/app

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// we want to copy the typescript source code for the templates and then compile the files according
	// to the requirements of the platform
	const source = path.resolve(
		__dirname,
		'..',
		'..',
		'..',
		'..',
		'build',
		config.mode === 'kit' ? 'runtime-kit' : 'runtime-sapper'
	)

	// copy the compiled source code to the target directory
	await recursiveCopy(source, config.runtimeDirectory)

	// now that the pre-compiled stuff in in place, we can put in the dynamic content
	// so that it can type check against what is there
	await generateAdapter(config)

	// build up the index file that should just export from the runtime
	const indexFile = AST.program([AST.exportAllDeclaration(AST.literal('./runtime'), null)])

	// write the index file that exports the runtime
	await fs.writeFile(path.join(config.rootDir, 'index.js'), recast.print(indexFile).code, 'utf-8')
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
