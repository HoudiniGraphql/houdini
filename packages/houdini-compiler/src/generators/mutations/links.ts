// external imports
import { Config } from 'houdini-common'
import mkdirp from 'mkdirp'
import fs from 'fs/promises'
import * as recast from 'recast'
import path from 'path'
// local imports
import { PatchAtom } from '.'

const typeBuilders = recast.types.builders

export async function generateLinks(config: Config, patches: PatchAtom[]) {
	await mkdirp(config.mutationLinksDirectory)

	// we need to find a mapping of mutations to every document that it could need to import
	const links = patches.reduce<{ [key: string]: string[] }>(
		(acc, { mutationName, queryName }) => {
			// grab the old value
			const old = acc[mutationName] || []
			// if we've already seen this document
			if (old.indexOf(queryName) !== -1) {
				// move along
				return acc
			}

			// add the query name to the list
			return {
				...acc,
				[mutationName]: [...old, queryName],
			}
		},
		{}
	)

	// every mutation with links needs a file
	await Promise.all(
		Object.keys(links).map(async (mutationName) => {
			// the documents that have patches relevant to this mutation
			const queries = links[mutationName]

			// build up the file contents
			const file = typeBuilders.program([
				typeBuilders.exportDefaultDeclaration(
					typeBuilders.objectExpression(
						queries.map((queryName) => {
							// the path of the patch describing the link
							const patchPath = path.relative(
								config.mutationLinksDirectory,
								config.patchPath({
									mutation: mutationName,
									query: queryName,
								})
							)

							return typeBuilders.objectProperty(
								typeBuilders.stringLiteral(queryName),
								typeBuilders.callExpression(typeBuilders.identifier('import'), [
									typeBuilders.stringLiteral(patchPath),
								])
							)
						})
					)
				),
			])

			// a link file exports an object that maps document names to a promise
			// pointing to the patch

			// write the file
			await fs.writeFile(config.mutationLinksPath(mutationName), recast.print(file).code)
		})
	)
}
