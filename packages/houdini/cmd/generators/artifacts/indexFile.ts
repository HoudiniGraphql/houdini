// externals
import { Config } from 'houdini-common'
import * as recast from 'recast'
import fs from 'fs/promises'
import path from 'path'
// locals
import { CollectedGraphQLDocument } from '../../types'

const AST = recast.types.builders

export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	// we want to export every artifact from the index file. I struggled for a long time to figure
	// out how to use the AST builder so for now, just build up the string
	const body = docs.reduce(
		(content, doc) => content + `\n export { default as ${doc.name}} from './${doc.name}'`,
		''
	)

	// write the result to the artifact path we're configured to write to
	await fs.writeFile(path.join(config.artifactDirectory, 'index.js'), body, 'utf-8')
}
