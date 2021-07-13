// externals
import { Config } from 'houdini-common'
import * as recast from 'recast'
import path from 'path'
// locals
import { CollectedGraphQLDocument } from '../../types'
import { cjsIndexFilePreamble, exportDefaultFrom, writeFile } from '../../utils'

const AST = recast.types.builders

export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	const nonGeneratedDocs = docs.filter((doc) => !doc.generated)

	// we want to export every artifact from the index file.
	let body =
		config.module === 'esm'
			? nonGeneratedDocs.reduce(
					(content, doc) =>
						content + `\n export { default as ${doc.name}} from './${doc.name}'`,
					''
			  )
			: nonGeneratedDocs.reduce(
					(content, doc) => content + `\n${exportDefaultFrom(`./${doc.name}`, doc.name)}`,
					cjsIndexFilePreamble
			  )

	// write the result to the artifact path we're configured to write to
	await writeFile(path.join(config.artifactDirectory, 'index.js'), body)
}
