// externals
import path from 'path'
import fs from 'fs/promises'
import * as recast from 'recast'
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../../types'

const AST = recast.types.builders

// the runtime generator is responsible for generating a majority of the runtime that the client will use.
// this includes things like query, fragment, mutation, etc. They are generated here instead of
// imported from npm so that they can be pushed through the bundler in order to use package aliases
// and sapper's internal @sapper/app

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// all of the runtime source code is available at the directory locations at ./templates
	const templateDir = path.resolve(__dirname, 'template')
	const templates = await fs.readdir(templateDir)

	// look at every file in the template directory
	for (const filepath of templates) {
		// read the file contents
		const contents = await fs.readFile(path.join(templateDir, filepath), 'utf-8')

		// and write them to the target
		await fs.writeFile(path.join(config.runtimeDirectory, filepath), contents, 'utf-8')
	}

	// build up the index file that should just export from the runtime
	const indexFile = AST.program([AST.exportAllDeclaration(AST.literal('./runtime'), null)])

	// write the index file that exports the runtime
	await fs.writeFile(path.join(config.rootDir, 'index.js'), recast.print(indexFile).code, 'utf-8')
	// and the adapter to normalize sapper and sveltekit
	await generateAdapter(config)
}

async function generateAdapter(config: Config) {
	// the location of the adapter
	const adapterLocation = path.join(config.runtimeDirectory, 'adapter.js')

	// figure out the correct content
	const content = config.mode === 'kit' ? kitAdapter() : sapperAdapter()

	// write the index file that exports the runtime
	await fs.writeFile(adapterLocation, content, 'utf-8')
}

const kitAdapter = () => `const stores = import('$app/stores')

module.exports.getSession = () => {
    stores.session
}
`

const sapperAdapter = () => `const app = require('@sapper/app')

module.exports.getSession = function() {
    const { session } = app.stores()

    return session
}
`
