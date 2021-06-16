// externals
import { Config } from 'houdini-common'
import * as recast from 'recast'
import fs from 'fs/promises'
import path from 'path'
// locals
import { CollectedGraphQLDocument } from '../../types'
import { cjsIndexFilePreamble, exportDefaultFrom } from '../../utils'

const AST = recast.types.builders

export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	// we want to export every artifact from the index file.
	let body =
		config.module === 'esm'
			? docs.reduce(
					(content, doc) =>
						content + `\n export { default as ${doc.name}} from './${doc.name}'`,
					''
			  )
			: docs.reduce(
					(content, doc) => content + `\n${exportDefaultFrom(`./${doc.name}`, doc.name)}`,
					cjsIndexFilePreamble
			  )

	// write the result to the artifact path we're configured to write to
	await fs.writeFile(path.join(config.artifactDirectory, 'index.js'), body, 'utf-8')
}
