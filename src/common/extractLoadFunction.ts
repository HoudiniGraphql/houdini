import * as graphql from 'graphql'
import path from 'path'
import * as recast from 'recast'
import { transformWithEsbuild } from 'vite'

import { Config, HoudiniRouteScript } from './config'
import * as fs from './fs'
import { parseJS } from './parse'

type Program = recast.types.namedTypes.Program
type VariableDeclaration = recast.types.namedTypes.VariableDeclaration

export async function extractLoadFunction(
	config: Config,
	filepath: string,
	mockArtifacts?: Record<string, { raw: string }>
): Promise<HoudiniRouteScript> {
	const nil: HoudiniRouteScript = {
		houdini_load: [],
		exports: [],
	}

	// read the source contents
	const contents = await fs.readFile(filepath)
	if (!contents) {
		return nil
	}

	// parse the contents
	let transformed = contents
	if (filepath.endsWith('.ts')) {
		transformed = (await transformWithEsbuild(contents, filepath)).code
	}
	if (transformed === null) {
		return nil
	}
	const parsed = (await parseJS(transformed))?.script
	if (!parsed) {
		return nil
	}

	// analyze the script for its exports and loaded function
	const { exports, load } = await processScript(config, parsed, mockArtifacts)

	return {
		exports,
		// we need to parse the strings we got as graphql documents
		houdini_load: load.map(
			(query) => graphql.parse(query).definitions[0] as graphql.OperationDefinitionNode
		),
	}
}

async function processScript(
	config: Config,
	program: Program,
	mockArtifacts?: Record<string, { raw: string }>
): Promise<{ load: string[]; exports: string[] }> {
	const exports: string[] = []

	// we need a mapping to global imports and their query
	const globalImports: Record<string, string> = {}

	// process the file
	for (const statement of program.body) {
		// import analysis
		if (statement.type === 'ImportDeclaration') {
			const source = statement.source.value?.toString()

			// skip over any imports not from $houdini
			if (!source || !source.startsWith('$houdini')) {
				continue
			}

			for (const specifier of statement.specifiers ?? []) {
				// the name of the query the import points to (if applicable)
				let name = specifier.local?.name || ''
				let query = ''

				// if we are importing a prefixed store
				if (name.startsWith(config.storePrefix)) {
					// the name of the query is the parts after the prefix
					query = name.substring(config.storePrefix.length)
				}

				// if we are importing a store factory
				else if (name.endsWith('Store')) {
					query = name.substring(0, name.length - config.storePrefix.length - 1)
				}

				// if we are import directly from a store path
				else if (
					source.startsWith('$houdini/' + config.storesDirectoryName) &&
					specifier.type === 'ImportDefaultSpecifier'
				) {
					// the local version points to the store
					query = source.substring(`$houdini/${config.storesDirectoryName}`.length - 1)
				}

				// look up the query content if we found a match
				if (query) {
					// compute the artifact path
					const artifact =
						mockArtifacts?.[query] ||
						(await import(path.join(config.artifactDirectory, query + '.js')))

					// save the query
					globalImports[name] = artifact.raw
				}
			}
			continue
		}

		// process local exports
		else if (statement.type === 'ExportNamedDeclaration') {
			// add the export to the list
			if (
				statement.declaration?.type === 'VariableDeclaration' &&
				statement.declaration.declarations.length === 1 &&
				statement.declaration.declarations[0].type === 'VariableDeclarator' &&
				statement.declaration.declarations[0].id.type === 'Identifier'
			) {
				exports.push(statement.declaration.declarations[0].id.name)
			} else if (
				statement.declaration?.type === 'FunctionDeclaration' &&
				statement.declaration.id?.type === 'Identifier'
			) {
				exports.push(statement.declaration.id.name)
			}

			// if the exported value is a relevant statement
			if (statement.declaration?.type === 'VariableDeclaration') {
				const reference = identifyStoreReference(globalImports, statement.declaration)
				if (reference) {
					globalImports[reference.local] = reference.query
				}
			}

			continue
		}

		// local variables
		if (statement?.type === 'VariableDeclaration') {
			const reference = identifyStoreReference(globalImports, statement)
			if (reference) {
				globalImports[reference.local] = reference.query
			}
		}
	}

	// non-locals can come in either as a prefixed import or from the store factory
	console.log(globalImports)

	return { load: [], exports }
}

// a statement is a store reference if its an identifier that matches a global import
// or is a call expression of a global import (store factory)
function identifyStoreReference(
	imports: Record<string, string>,
	statement: VariableDeclaration
): null | { local: string; query: string } {
	// only support standalone declarations
	if (statement.declarations.length !== 1) {
		return null
	}

	// we only care about local variables
	const declaration = statement.declarations[0]
	if (declaration.type !== 'VariableDeclarator' || declaration.id.type !== 'Identifier') {
		return null
	}

	const local = declaration.id.name
	if (local === 'houdini_load') {
		return null
	}

	// pull out the value
	const value = declaration.init
	if (!value) {
		return null
	}

	// check the two cases
	if (value.type === 'Identifier' && value.name in imports) {
		return { local, query: imports[value.name] }
	}
	if (
		value.type === 'CallExpression' &&
		value.callee.type == 'Identifier' &&
		value.callee.name in imports
	) {
		return { local, query: imports[value.callee.name] }
	}

	// it wasn't valid
	return null
}
