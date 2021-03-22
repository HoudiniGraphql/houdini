// externals
import path from 'path'
import fs from 'fs/promises'
import * as recast from 'recast'
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../../types'
import generateAdapter from './adapter'
import generateEnvironment from './environment'
import { recursiveCopy, compile } from './utils'

const AST = recast.types.builders

// the runtime generator is responsible for generating a majority of the runtime that the client will use.
// this includes things like query, fragment, mutation, etc. They are generated here instead of
// imported from npm so that they can be pushed through the bundler in order to use package aliases
// and sapper's internal @sapper/app

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// all of the runtime source code is available at the directory locations at ./templates
	const source = path.resolve(__dirname, 'template')

	// copy the compiled source code to the target directory
	await recursiveCopy(source, config.runtimeDirectory)

	// now that the pre-compiled stuff in in place, we can put in the dynamic content
	// so that it can type check against what is there
	await Promise.all([generateAdapter(config), generateEnvironment(config, docs)])

	// run the typescript compiler
	compile([path.join(config.runtimeDirectory, 'environment.ts')])

	// build up the index file that should just export from the runtime
	const indexFile = AST.program([AST.exportAllDeclaration(AST.literal('./runtime'), null)])

	// write the index file that exports the runtime
	await fs.writeFile(path.join(config.rootDir, 'index.js'), recast.print(indexFile).code, 'utf-8')
}
