import {
	Config,
	EmbeddedGraphqlDocument,
	ensureArtifactImport,
	ensureImports,
	ensureStoreImport,
} from '../../../common'
import * as graphql from 'graphql'
import * as recast from 'recast'
import { CollectedGraphQLDocument } from '../../types'
import { parse as parseJS } from '@babel/parser'
import { readFile } from '../../../../build/cmd/utils'
import { ExportNamedDeclaration } from '@babel/types'
import { Statement } from '@babel/types'
import { namedTypes } from 'ast-types/gen/namedTypes'
import { StatementKind } from 'ast-types/gen/kinds'
import { Program } from '@babel/types'
import { writeFile } from 'fs-extra'

const AST = recast.types.builders

export default async function sveltekitGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// we will only generate things if the project is using svelte kit
	if (config.framework !== 'kit') {
		return
	}

	// a file can have multiple documents in it so we need to first group by filename
	const byFilename = docs.reduce<{ [filename: string]: CollectedGraphQLDocument[] }>(
		(prev, doc) => {
			// if the doc is not a user generated store, skip it
			if (!doc.generateStore) {
				return prev
			}

			const old = prev[doc.filename] || []
			return {
				...prev,
				[doc.filename]: [...old, doc],
			}
		},
		{}
	)

	const routes = Object.entries(byFilename)
		.filter(([filename, doc]) => config.isRoute(filename, ''))
		.map(([route]) => route)

	// process every route we run into
	await Promise.all(
		routes.map(async (filename) => {
			// we need to generate a data file that loads every document in the route
			// the file will likely already exist so a lot of the complexity we'll have to manage
			// here is to find a way to safely update the parts we need without destroying the user's code
			const dataFilePath = config.routeDataPath(filename)
			const dataFileContents = await readFile(dataFilePath)

			// if the file does not exist, create it
			if (!dataFileContents) {
				await writeFile(dataFilePath, '')
			}
		})
	)
}
